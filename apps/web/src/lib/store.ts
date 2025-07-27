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
  PLATFORM_CATALOG,
  PLATFORM_SYNC_MAX_AGE_HOURS,
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

function defaultConnections(): PlatformConnection[] {
  return PLATFORM_CATALOG.map((p) => ({
    platformId: p.id,
    status: "disconnected" as const,
    syncEnabled: false,
  }));
}

/**
 * In-memory store for MVP. Swap for Postgres without changing API shapes.
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
    return this.profile;
  }

  listJobs() {
    return this.jobs;
  }

  getJob(id: string) {
    return this.jobs.find((j) => j.id === id);
  }

  upsertJobs(incoming: JobListing[]) {
    for (const job of incoming) {
      const idx = this.jobs.findIndex(
        (j) => j.externalUrl === job.externalUrl || j.id === job.id
      );
      if (idx >= 0) this.jobs[idx] = job;
      else this.jobs.unshift(job);
    }
    return this.jobs;
  }

  listPlatforms() {
    return this.platforms;
  }

  getPlatform(platformId: PlatformId) {
    return this.platforms.find((p) => p.platformId === platformId);
  }

  /**
   * Demo connect — production would redirect to OAuth and store tokens securely.
   */
  connectPlatform(
    platformId: PlatformId,
    opts?: { handle?: string; profileUrl?: string }
  ): PlatformConnection | { error: string } {
    const conn = this.getPlatform(platformId);
    if (!conn) return { error: "Unknown platform" };
    const def = PLATFORM_CATALOG.find((p) => p.id === platformId);
    const now = new Date().toISOString();
    const handle =
      opts?.handle ??
      (platformId === "github"
        ? "alexrivera"
        : platformId === "x"
          ? "alexrivera"
          : "alexrivera");

    conn.status = "connected";
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

    // First connect triggers an immediate sync so profile is warm.
    this.syncPlatforms({
      force: true,
      only: [platformId],
      triggeredBy: "manual",
    });

    void def;
    return { ...conn };
  }

  disconnectPlatform(platformId: PlatformId): PlatformConnection | { error: string } {
    const conn = this.getPlatform(platformId);
    if (!conn) return { error: "Unknown platform" };
    conn.status = "disconnected";
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

  /**
   * Sync all connected platforms with syncEnabled.
   * Skips fresh ones unless force=true.
   */
  syncPlatforms(opts?: {
    force?: boolean;
    only?: PlatformId[];
    triggeredBy?: SyncRunReport["triggeredBy"];
  }): SyncRunReport {
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
      const { profile, result } = applyPlatformSync(this.profile, conn);
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

  /** Called before drafts / automation / apply packages. */
  ensureFreshPlatformData(
    triggeredBy: SyncRunReport["triggeredBy"] = "pre_apply"
  ): SyncRunReport {
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
      platforms: this.platforms,
    };
  }

  draftsTodayCount() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.drafts.filter((d) => new Date(d.createdAt) >= start).length;
  }

  canCreateDraft(): { ok: boolean; reason?: string } {
    if (this.draftsTodayCount() >= VOLUME_CAPS.maxDraftsPerDay) {
      return {
        ok: false,
        reason: `Daily quality cap reached (${VOLUME_CAPS.maxDraftsPerDay}/day).`,
      };
    }
    return { ok: true };
  }

  prepareDraft(jobId: string): ApplicationDraft | { error: string } {
    // Daily platform sync before any resume / apply package is built.
    this.ensureFreshPlatformData("pre_apply");

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

    const built = buildTailoredResume(this.profile, job);
    const now = new Date().toISOString();
    const resumeId = `rv_${Date.now()}`;

    const resume: ResumeVersion = {
      id: resumeId,
      userId: DEMO_USER_ID,
      jobListingId: jobId,
      templateId: built.templateId,
      content: built.content,
      plainText: built.plainText,
      atsScore: built.atsScore,
      humanizedScore: built.humanizedScore,
      createdAt: now,
    };
    this.resumes.unshift(resume);

    const status =
      built.shortlistProbability < SHORTLIST_THRESHOLDS.reviewBelow
        ? "requires_review"
        : "ready";

    const draft: ApplicationDraft = {
      id: `app_${Date.now()}`,
      userId: DEMO_USER_ID,
      jobListingId: jobId,
      resumeVersionId: resumeId,
      coverLetter: `Hi ${job.company} team — I'm excited about the ${job.title} role. ${built.recommendation}`,
      status,
      matchScore: built.atsScore,
      shortlistProbability: built.shortlistProbability,
      shortlistFactors: built.shortlistFactors,
      filledFormData: {
        name: this.profile.fullName,
        email: "alex@example.com",
        phone: this.profile.phone ?? "",
        linkedin: this.profile.linkedinUrl ?? "",
        github: this.profile.githubUrl ?? "",
        location: this.profile.location ?? "",
        resume_text: built.plainText.slice(0, 4000),
        cover_letter: "",
      },
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    draft.filledFormData!.cover_letter = draft.coverLetter ?? "";
    this.drafts.unshift(draft);
    return draft;
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
    return d;
  }

  markFailed(id: string, message: string) {
    const d = this.getDraft(id);
    if (!d) return null;
    d.status = "failed";
    d.errorMessage = message;
    d.updatedAt = new Date().toISOString();
    d.retryCount += 1;
    return d;
  }

  getApplyPackage(id: string): ApplyPackage | null {
    // Ensure data is still fresh before packaging for the extension.
    this.ensureFreshPlatformData("pre_apply");
    const d = this.getDraft(id);
    if (!d) return null;
    const job = this.getJob(d.jobListingId);
    if (!job) return null;
    const resume = this.resumes.find((r) => r.id === d.resumeVersionId);
    return {
      applicationId: d.id,
      jobUrl: job.externalUrl,
      jobTitle: job.title,
      company: job.company,
      filledFormData: d.filledFormData ?? {},
      resumePlainText: resume?.plainText,
      coverLetter: d.coverLetter,
      autoSubmit: false,
    };
  }

  listResumes() {
    return this.resumes;
  }

  startAutomation() {
    this.automationEnabled = true;
    // Daily sync all enabled platforms first, then draft.
    const sync = this.ensureFreshPlatformData("pre_automation");
    const results = [];
    for (const job of this.jobs.slice(0, VOLUME_CAPS.maxDraftsPerDay)) {
      const r = this.prepareDraft(job.id);
      results.push(r);
    }
    return { enabled: true, results, sync };
  }
}

const globalForStore = globalThis as unknown as { __vexaStore?: MemoryStore };

export const store = globalForStore.__vexaStore ?? new MemoryStore();
if (process.env.NODE_ENV !== "production") {
  globalForStore.__vexaStore = store;
}
