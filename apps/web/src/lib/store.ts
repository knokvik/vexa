import type {
  ApplicationDraft,
  ApplyPackage,
  JobListing,
  PlatformConnection,
  PlatformId,
  Profile,
  ResumeVersion,
  SyncRunReport,
} from "@vexa/shared";
import {
  VOLUME_CAPS,
  SHORTLIST_THRESHOLDS,
  APPLY_TIERS,
  PLATFORM_CATALOG,
  PLATFORM_SYNC_MAX_AGE_HOURS,
  classifyApplySurface,
} from "@vexa/shared";
import { buildTailoredResume } from "@vexa/intelligence";
import {
  DEMO_DRAFTS,
  DEMO_JOBS,
  DEMO_PROFILE,
  DEMO_USER_ID,
} from "./demo-data";
import {
  applyPlatformSync,
  buildSyncReport,
  isStale,
} from "./platform-sync";
import { deleteTokens, hasTokens } from "./oauth/token-store";
import { isOAuthProvider } from "./oauth/config";
import { fetchRealPlatformProfile } from "./oauth/fetch-profile";
import { createTask, runStep, completeTask } from "./task-memory";
import { llmHumanize, llmShortlistNote } from "./llm-pipeline";
import { rememberEvent } from "./app-memory";
import { normalizeJobFields } from "./job-normalize";
import { buildFormFill } from "./form-fill";
import * as durable from "./durable/bridge";
import {
  addOutcome,
  listOutcomes,
  computeWeeklyStats,
  type OutcomeEvent,
} from "./durable/db";

function defaultConnections(): PlatformConnection[] {
  return PLATFORM_CATALOG.map((p) => ({
    platformId: p.id,
    status: "disconnected" as const,
    syncEnabled: false,
  }));
}

/**
 * App store — in-memory for speed, durable JSON tables for jobs/drafts/outcomes.
 * Phase 1: survives restarts for jobs, applications, scores, outcomes, profile, resumes.
 */
class MemoryStore {
  profile: Profile = structuredClone(DEMO_PROFILE);
  jobs: JobListing[] = structuredClone(DEMO_JOBS);
  drafts: ApplicationDraft[] = structuredClone(DEMO_DRAFTS);
  resumes: ResumeVersion[] = [];
  automationEnabled = false;
  platforms: PlatformConnection[] = defaultConnections();
  lastSyncReport: SyncRunReport | null = null;
  /** When true (default), prep/apply waits for daily platform sync. */
  syncBeforeApply = true;
  private hydrated = false;
  private hydratePromise: Promise<void> | null = null;

  /** Load durable state once (jobs/drafts/profile/resumes). */
  async ensureHydrated() {
    if (this.hydrated) return;
    if (this.hydratePromise) return this.hydratePromise;
    this.hydratePromise = (async () => {
      try {
        const data = await durable.hydrateFromDisk();
        if (data.jobs.length) {
          // Prefer durable jobs; keep demos only if disk empty
          this.jobs = data.jobs;
        } else {
          // Seed durable with demo jobs on first run
          await durable.persistJobs(this.jobs);
        }
        if (data.drafts.length) {
          this.drafts = data.drafts;
        }
        if (data.resumes.length) {
          this.resumes = data.resumes;
        }
        if (data.profile) {
          this.profile = data.profile;
        } else {
          await durable.persistProfile(this.profile);
        }
      } catch {
        /* keep demos */
      }
      this.hydrated = true;
    })();
    return this.hydratePromise;
  }

  getProfile() {
    return this.profile;
  }

  updateProfile(patch: Partial<Profile>) {
    this.profile = {
      ...this.profile,
      ...patch,
      id: this.profile.id,
      userId: this.profile.userId,
    };
    void durable.persistProfile(this.profile);
    return this.profile;
  }

  listJobs() {
    return this.jobs;
  }

  getJob(id: string) {
    return this.jobs.find((j) => j.id === id);
  }

  upsertJobs(incoming: JobListing[]) {
    // Data-cleaning pass: real company names, not portal brands (Ashby/ZipRecruiter/…)
    for (const job of incoming) {
      const cleaned = normalizeJobFields({
        company: job.company,
        title: job.title,
        externalUrl: job.externalUrl,
      });
      job.company = cleaned.company;
      job.title = cleaned.title;

      const idx = this.jobs.findIndex(
        (j) => j.externalUrl === job.externalUrl || j.id === job.id
      );
      if (idx >= 0) this.jobs[idx] = job;
      else this.jobs.unshift(job);
    }
    void durable.persistJobs(this.jobs);
    return this.jobs;
  }

  /** Re-run cleaning over stored jobs (dashboard top companies fix). */
  reprocessJobCompanies() {
    for (const job of this.jobs) {
      const cleaned = normalizeJobFields({
        company: job.company,
        title: job.title,
        externalUrl: job.externalUrl,
      });
      job.company = cleaned.company;
      job.title = cleaned.title;
    }
    void durable.persistJobs(this.jobs);
    return this.jobs.length;
  }

  listPlatforms() {
    return this.platforms;
  }

  getPlatform(platformId: PlatformId) {
    return this.platforms.find((p) => p.platformId === platformId);
  }

  /**
   * Complete real OAuth connection after callback stored tokens.
   */
  async connectWithOAuthTokens(
    platformId: PlatformId,
    tokens: { accessToken: string; refreshToken?: string; expiresAt?: string }
  ): Promise<PlatformConnection | { error: string }> {
    const conn = this.getPlatform(platformId);
    if (!conn) return { error: "Unknown platform" };
    if (!isOAuthProvider(platformId)) {
      return { error: "Provider does not support OAuth" };
    }

    try {
      const real = await fetchRealPlatformProfile(
        platformId,
        tokens.accessToken
      );
      const now = new Date().toISOString();

      conn.status = "connected";
      conn.authMode = "oauth";
      conn.syncEnabled = true;
      conn.connectedAt = now;
      conn.lastSyncedAt = now;
      conn.externalHandle = real.handle;
      conn.externalProfileUrl = real.profileUrl;
      conn.lastSyncSummary = real.fields;
      conn.errorMessage = undefined;
      conn.nextSyncAt = new Date(
        Date.now() + PLATFORM_SYNC_MAX_AGE_HOURS * 60 * 60 * 1000
      ).toISOString();

      // Apply first profile pull
      this.profile = {
        ...this.profile,
        ...real.profilePatch,
        fullName: real.profilePatch.fullName || this.profile.fullName,
        skills: [...this.profile.skills],
        interests: [...this.profile.interests],
      };
      if (real.skillsToMerge) {
        const existing = new Set(
          this.profile.skills.map((s) => s.name.toLowerCase())
        );
        for (const name of real.skillsToMerge) {
          if (!existing.has(name.toLowerCase())) {
            this.profile.skills.push({
              id: `oauth_${name.toLowerCase().replace(/\s+/g, "_")}`,
              name,
              proficiency: "intermediate",
              category: "technical",
            });
          }
        }
      }
      if (real.interestsToMerge) {
        this.profile.interests = [
          ...new Set([...this.profile.interests, ...real.interestsToMerge]),
        ];
      }

      this.lastSyncReport = buildSyncReport(
        [
          {
            platformId,
            ok: true,
            syncedAt: now,
            fieldsUpdated: real.fields,
          },
        ],
        "manual",
        false
      );

      return { ...conn };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "OAuth profile fetch failed";
      conn.status = "error";
      conn.errorMessage = msg;
      return { error: msg };
    }
  }

  /**
   * @deprecated Prefer real OAuth. Demo connect only when ALLOW_DEMO_OAUTH=true.
   */
  connectPlatform(
    platformId: PlatformId,
    opts?: { handle?: string; profileUrl?: string }
  ): PlatformConnection | { error: string } {
    if (process.env.ALLOW_DEMO_OAUTH !== "true") {
      if (isOAuthProvider(platformId)) {
        return {
          error:
            "Use real OAuth Connect (or set ALLOW_DEMO_OAUTH=true for offline demo)",
        };
      }
      return {
        error:
          "This platform has no public OAuth yet. Tracked for partner access.",
      };
    }

    const conn = this.getPlatform(platformId);
    if (!conn) return { error: "Unknown platform" };
    const now = new Date().toISOString();
    const handle = opts?.handle ?? "alexrivera";

    conn.status = "connected";
    conn.authMode = "demo";
    conn.syncEnabled = true;
    conn.connectedAt = now;
    conn.externalHandle = handle;
    conn.externalProfileUrl =
      opts?.profileUrl ??
      (platformId === "linkedin"
        ? `https://linkedin.com/in/${handle}`
        : platformId === "x"
          ? `https://x.com/${handle}`
          : platformId === "github"
            ? `https://github.com/${handle}`
            : undefined);
    conn.errorMessage = undefined;
    conn.nextSyncAt = new Date(
      Date.now() + PLATFORM_SYNC_MAX_AGE_HOURS * 60 * 60 * 1000
    ).toISOString();

    // Fire-and-forget sync for demo
    void this.syncPlatforms({
      force: true,
      only: [platformId],
      triggeredBy: "manual",
    });

    return { ...conn };
  }

  disconnectPlatform(platformId: PlatformId): PlatformConnection | { error: string } {
    const conn = this.getPlatform(platformId);
    if (!conn) return { error: "Unknown platform" };
    deleteTokens(DEMO_USER_ID, platformId);
    conn.status = "disconnected";
    conn.authMode = undefined;
    conn.syncEnabled = false;
    conn.connectedAt = undefined;
    conn.lastSyncedAt = undefined;
    conn.nextSyncAt = undefined;
    conn.externalHandle = undefined;
    conn.externalProfileUrl = undefined;
    conn.errorMessage = undefined;
    conn.lastSyncSummary = undefined;
    return { ...conn };
  }

  setPlatformSyncEnabled(
    platformId: PlatformId,
    syncEnabled: boolean
  ): PlatformConnection | { error: string } {
    const conn = this.getPlatform(platformId);
    if (!conn) return { error: "Unknown platform" };
    if (conn.status !== "connected" && syncEnabled) {
      return { error: "Connect the platform before enabling daily sync" };
    }
    conn.syncEnabled = syncEnabled;
    return { ...conn };
  }

  setSyncBeforeApply(enabled: boolean) {
    this.syncBeforeApply = enabled;
    return this.syncBeforeApply;
  }

  async syncPlatforms(opts?: {
    force?: boolean;
    only?: PlatformId[];
    triggeredBy?: SyncRunReport["triggeredBy"];
  }): Promise<SyncRunReport> {
    const triggeredBy = opts?.triggeredBy ?? "manual";
    const targets = this.platforms.filter((p) => {
      if (opts?.only && !opts.only.includes(p.platformId)) return false;
      if (p.status !== "connected" && p.status !== "error") return false;
      if (!p.syncEnabled) return false;
      if (!opts?.force && !isStale(p)) return false;
      return true;
    });

    if (targets.length === 0) {
      const report = buildSyncReport(
        [],
        triggeredBy,
        true,
        "No connected platforms need sync (fresh within 24h or none enabled)"
      );
      this.lastSyncReport = report;
      return report;
    }

    const results = [];
    for (const conn of targets) {
      conn.status = "syncing";
      const { profile, result } = await applyPlatformSync(this.profile, conn);
      this.profile = profile;
      if (result.ok) {
        conn.status = "connected";
        conn.lastSyncedAt = result.syncedAt;
        conn.lastSyncSummary = result.fieldsUpdated;
        conn.errorMessage = undefined;
        conn.nextSyncAt = new Date(
          Date.now() + PLATFORM_SYNC_MAX_AGE_HOURS * 60 * 60 * 1000
        ).toISOString();
      } else {
        conn.status = "error";
        conn.errorMessage = result.error;
      }
      results.push(result);
    }

    const report = buildSyncReport(results, triggeredBy, false);
    this.lastSyncReport = report;
    return report;
  }

  async ensureFreshPlatformData(
    triggeredBy: SyncRunReport["triggeredBy"] = "pre_apply"
  ): Promise<SyncRunReport> {
    if (!this.syncBeforeApply) {
      return buildSyncReport([], triggeredBy, true, "Sync-before-apply is off");
    }
    return this.syncPlatforms({ force: false, triggeredBy });
  }

  getSyncStatus() {
    const connected = this.platforms.filter((p) => p.status === "connected");
    const stale = connected.filter((p) => isStale(p));
    return {
      syncBeforeApply: this.syncBeforeApply,
      maxAgeHours: PLATFORM_SYNC_MAX_AGE_HOURS,
      connectedCount: connected.length,
      syncEnabledCount: this.platforms.filter((p) => p.syncEnabled).length,
      staleCount: stale.length,
      lastSyncReport: this.lastSyncReport,
      platforms: this.platforms.map((p) => ({
        ...p,
        hasServerTokens: hasTokens(DEMO_USER_ID, p.platformId),
      })),
    };
  }

  draftsTodayCount() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.drafts.filter(
      (d) =>
        new Date(d.createdAt) >= start &&
        d.status !== "failed" &&
        // duplicate is a soft return on an existing draft — don't double-count
        d.status !== "duplicate"
    ).length;
  }

  canCreateDraft(): { ok: boolean; reason?: string } {
    if (this.draftsTodayCount() >= VOLUME_CAPS.maxDraftsPerDay) {
      return {
        ok: false,
        reason: `Daily quality cap reached (${VOLUME_CAPS.maxDraftsPerDay}/day). Quality over spray — open Inbox to apply packages, or continue tomorrow.`,
      };
    }
    return { ok: true };
  }

  async prepareDraft(
    jobId: string
  ): Promise<ApplicationDraft | { error: string; taskId?: string }> {
    await this.ensureHydrated();
    await this.ensureFreshPlatformData("pre_apply");

    const cap = this.canCreateDraft();
    if (!cap.ok) return { error: cap.reason! };

    const job = this.getJob(jobId);
    if (!job) return { error: "Job not found" };

    const existing = this.drafts.find(
      (d) =>
        d.jobListingId === jobId &&
        !["failed", "expired", "duplicate"].includes(d.status)
    );
    if (existing) {
      return { ...existing, status: "duplicate", errorMessage: "Already drafted" };
    }

    // Task memory: if free models switch mid-run, completed steps are reused.
    const task = await createTask(
      "prepare_draft",
      ["tailor", "humanize", "package"],
      { jobId, company: job.company, title: job.title }
    );

    try {
      const preferredTemplate =
        this.profile.templatePriorities?.[0] || "tpl-harvard";
      const built = await runStep(task, "tailor", async () => ({
        output: buildTailoredResume(this.profile, job, {
          templateId: preferredTemplate,
        }),
        notes: `local tailor+ATS template=${preferredTemplate}`,
      }));

      const human = await runStep(task, "humanize", async () => {
        const h = await llmHumanize(built.plainText);
        return {
          output: h,
          modelUsed: h.model,
          notes: `source=${h.source}`,
        };
      });

      const plainText = human.text;
      const humanizedScore = human.score;

      // Optional tiny shortlist note — skip if shortlist already high to save tokens
      let recommendation = built.recommendation;
      if (built.shortlistProbability < 0.85) {
        const note = await llmShortlistNote(
          job.title,
          job.company,
          built.shortlistProbability
        );
        if (note) recommendation = note;
      }

      const draft = await runStep(task, "package", async () => {
        const now = new Date().toISOString();
        const resumeId = `rv_${Date.now()}`;
        const resume: ResumeVersion = {
          id: resumeId,
          userId: DEMO_USER_ID,
          jobListingId: jobId,
          templateId: built.templateId,
          content: built.content,
          plainText,
          atsScore: built.atsScore,
          humanizedScore,
          createdAt: now,
        };
        this.resumes.unshift(resume);

        // Risk tiers: LinkedIn/Indeed always review; direct ATS uses thresholds
        const surface = classifyApplySurface(job.externalUrl);
        const p = built.shortlistProbability;
        let status: ApplicationDraft["status"] = "ready";
        if (surface === "linkedin" || surface === "indeed") {
          // Tier 3 — draft only, you always submit; force review flag
          status = "requires_review";
        } else if (p < APPLY_TIERS.tier2Min) {
          status = "requires_review";
        } else if (p < APPLY_TIERS.tier1Min) {
          status =
            p < SHORTLIST_THRESHOLDS.reviewBelow ? "requires_review" : "ready";
        } else {
          // Tier 1 high confidence direct ATS — still never auto-submits
          status = "ready";
        }

        // Invention / parse errors → force review
        if (
          built.inventionFlags?.some((i) => i.severity === "error") ||
          built.parseSafety?.ok === false
        ) {
          status = "requires_review";
        }

        const coverLetter = `Hi ${job.company} team — ${recommendation}`;
        // ATS form-fill engine: Greenhouse / Lever / Ashby / generic field answers + eval
        const form = buildFormFill({
          profile: this.profile,
          job,
          coverLetter,
          resumePlainText: plainText,
        });

        // Weak open-ended form answers → force review
        if (form.eval.avgOverall < 60 || form.eval.reviewCount >= 4) {
          status = "requires_review";
        }

        const d: ApplicationDraft = {
          id: `app_${Date.now()}`,
          userId: DEMO_USER_ID,
          jobListingId: jobId,
          resumeVersionId: resumeId,
          coverLetter,
          status,
          matchScore: built.atsScore,
          shortlistProbability: built.shortlistProbability,
          shortlistFactors: built.shortlistFactors,
          filledFormData: form.filledFormData,
          formAnswers: form.answers,
          formEval: form.eval,
          formSurface: form.surface,
          retryCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        this.drafts.unshift(d);
        await durable.persistDraft(d, {
          template_used: built.templateId,
          tier: durable.tierForJob(job.externalUrl, built.shortlistProbability),
        });
        await durable.persistJob(job, "drafted");
        await durable.persistResumes(this.resumes);
        return { output: d, notes: `task=${task.id}` };
      });

      await completeTask(task, "done");
      // Persist company + draft into long-lived app memory vault
      await rememberEvent({
        type: "draft_prepared",
        company: job.company,
        title: job.title,
        jobId: job.id,
        url: job.externalUrl,
        status: draft.status,
        note: `draft=${draft.id} ats=${draft.matchScore}`,
        meta: {
          draftId: draft.id,
          shortlist: draft.shortlistProbability,
          taskId: task.id,
        },
      });
      return draft;
    } catch (e) {
      await completeTask(task, "failed");
      return {
        error: e instanceof Error ? e.message : "prepareDraft failed",
        taskId: task.id,
      };
    }
  }

  listDrafts() {
    return this.drafts;
  }

  getDraft(id: string) {
    return this.drafts.find((d) => d.id === id);
  }

  markSubmitted(id: string, confirmationId?: string) {
    const d = this.getDraft(id);
    if (!d) return null;
    d.status = "submitted";
    d.submittedAt = new Date().toISOString();
    d.updatedAt = d.submittedAt;
    d.confirmationId = confirmationId ?? `manual_${Date.now()}`;
    void durable.persistDraft(d);
    const job = this.getJob(d.jobListingId);
    if (job) void durable.persistJob(job, "submitted");
    return d;
  }

  markFailed(id: string, message: string) {
    const d = this.getDraft(id);
    if (!d) return null;
    d.status = "failed";
    d.errorMessage = message;
    d.updatedAt = new Date().toISOString();
    d.retryCount += 1;
    void durable.persistDraft(d);
    return d;
  }

  /** Phase 1 — log funnel outcome for learning */
  async logOutcome(
    applicationId: string,
    event: OutcomeEvent,
    note?: string,
    eventAt?: string
  ) {
    await this.ensureHydrated();
    const d = this.getDraft(applicationId);
    if (!d) return { error: "Application not found" as const };
    const row = {
      id: `out_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      application_id: applicationId,
      event,
      event_at: eventAt || new Date().toISOString(),
      note: note || "",
    };
    await addOutcome(row);
    return { ok: true as const, outcome: row };
  }

  async listOutcomes(applicationId?: string) {
    await this.ensureHydrated();
    return listOutcomes(applicationId);
  }

  async weeklyStats() {
    await this.ensureHydrated();
    return computeWeeklyStats();
  }

  async getApplyPackage(id: string): Promise<ApplyPackage | null> {
    await this.ensureFreshPlatformData("pre_apply");
    const d = this.getDraft(id);
    if (!d) return null;
    const job = this.getJob(d.jobListingId);
    if (!job) return null;
    const resume = this.resumes.find((r) => r.id === d.resumeVersionId);

    // Rebuild form answers if missing (older drafts) or enrich package
    let formAnswers = d.formAnswers;
    let formEval = d.formEval;
    let formSurface = d.formSurface;
    let filled = d.filledFormData ?? {};
    if (!formAnswers?.length || !Object.keys(filled).length) {
      const form = buildFormFill({
        profile: this.profile,
        job,
        coverLetter: d.coverLetter,
        resumePlainText: resume?.plainText,
      });
      formAnswers = form.answers;
      formEval = form.eval;
      formSurface = form.surface;
      filled = { ...form.filledFormData, ...filled };
      d.filledFormData = filled;
      d.formAnswers = formAnswers;
      d.formEval = formEval;
      d.formSurface = formSurface;
      void durable.persistDraft(d);
    }

    return {
      applicationId: d.id,
      jobUrl: job.externalUrl,
      jobTitle: job.title,
      company: job.company,
      filledFormData: filled,
      formAnswers,
      formEval,
      formSurface,
      resumePlainText: resume?.plainText,
      coverLetter: d.coverLetter,
      autoSubmit: false,
    };
  }

  /** Regenerate form answers for a draft (profile/job updated). */
  async rebuildFormAnswers(applicationId: string) {
    await this.ensureHydrated();
    const d = this.getDraft(applicationId);
    if (!d) return { error: "Not found" as const };
    const job = this.getJob(d.jobListingId);
    if (!job) return { error: "Job not found" as const };
    const resume = this.resumes.find((r) => r.id === d.resumeVersionId);
    const form = buildFormFill({
      profile: this.profile,
      job,
      coverLetter: d.coverLetter,
      resumePlainText: resume?.plainText,
    });
    d.filledFormData = form.filledFormData;
    d.formAnswers = form.answers;
    d.formEval = form.eval;
    d.formSurface = form.surface;
    d.updatedAt = new Date().toISOString();
    void durable.persistDraft(d);
    return { ok: true as const, draft: d, form };
  }

  listResumes() {
    return this.resumes;
  }

  addResume(resume: ResumeVersion) {
    this.resumes.unshift(resume);
    void durable.persistResumes(this.resumes);
    return resume;
  }

  /**
   * Batch prepare drafts — ATS-first, undrafted only, quality caps.
   * Never auto-submits. LinkedIn surfaces still become requires_review only.
   */
  async startAutomation(opts?: {
    maxDrafts?: number;
    preferDirectAts?: boolean;
    jobIds?: string[];
  }) {
    this.automationEnabled = true;
    await this.ensureHydrated();
    const sync = await this.ensureFreshPlatformData("pre_automation");
    const max = Math.min(
      opts?.maxDrafts ?? VOLUME_CAPS.maxDraftsPerDay,
      VOLUME_CAPS.maxDraftsPerDay
    );
    const preferAts = opts?.preferDirectAts !== false;

    const draftedJobIds = new Set(
      this.drafts
        .filter((d) => !["failed", "expired"].includes(d.status))
        .map((d) => d.jobListingId)
    );

    let candidates = opts?.jobIds?.length
      ? opts.jobIds
          .map((id) => this.getJob(id))
          .filter((j): j is JobListing => !!j)
      : [...this.jobs];

    // Skip already drafted
    candidates = candidates.filter((j) => !draftedJobIds.has(j.id));

    if (preferAts) {
      const rank = (url: string) => {
        const s = classifyApplySurface(url);
        if (s === "direct_ats") return 0;
        if (s === "other") return 1;
        if (s === "unknown") return 2;
        // linkedin / indeed last — still draftable as review-only
        return 3;
      };
      candidates.sort(
        (a, b) => rank(a.externalUrl) - rank(b.externalUrl)
      );
    }

    const results: Array<
      ApplicationDraft | { error: string; taskId?: string; jobId?: string }
    > = [];
    let prepared = 0;
    for (const job of candidates) {
      if (prepared >= max) break;
      const cap = this.canCreateDraft();
      if (!cap.ok) {
        results.push({ error: cap.reason!, jobId: job.id });
        break;
      }
      const r = await this.prepareDraft(job.id);
      if (!("error" in r) && r.status !== "duplicate") {
        prepared += 1;
      }
      results.push(
        "error" in r ? { ...r, jobId: job.id } : r
      );
    }

    await rememberEvent({
      type: "search",
      query: "automation:batch_draft",
      note: `prepared=${prepared} attempted=${results.length}`,
      meta: { prepared, preferAts, max },
    });

    return { enabled: true, results, sync, prepared };
  }

  /** Jobs not yet drafted, ranked for apply-friendly surfaces */
  listUndraftedJobs(limit = 20) {
    const drafted = new Set(
      this.drafts
        .filter((d) => !["failed", "expired"].includes(d.status))
        .map((d) => d.jobListingId)
    );
    return this.jobs
      .filter((j) => !drafted.has(j.id))
      .sort((a, b) => {
        const ra = classifyApplySurface(a.externalUrl);
        const rb = classifyApplySurface(b.externalUrl);
        const score = (s: string) =>
          s === "direct_ats" ? 0 : s === "other" ? 1 : 2;
        return score(ra) - score(rb);
      })
      .slice(0, limit);
  }
}

const globalForStore = globalThis as unknown as { __vexaStore?: MemoryStore };

/** Reuse data across HMR but always pick up latest class methods in dev. */
function getStore(): MemoryStore {
  if (globalForStore.__vexaStore) {
    if (process.env.NODE_ENV !== "production") {
      Object.setPrototypeOf(globalForStore.__vexaStore, MemoryStore.prototype);
    }
    return globalForStore.__vexaStore;
  }
  const s = new MemoryStore();
  globalForStore.__vexaStore = s;
  return s;
}

export const store = getStore();
