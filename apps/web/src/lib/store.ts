import type {
  ApplicationDraft,
  ApplyPackage,
  JobListing,
  Profile,
  ResumeVersion,
} from "@vexa/shared";
import { VOLUME_CAPS, SHORTLIST_THRESHOLDS } from "@vexa/shared";
import { buildTailoredResume } from "@vexa/intelligence";
import {
  DEMO_DRAFTS,
  DEMO_JOBS,
  DEMO_PROFILE,
  DEMO_USER_ID,
} from "./demo-data";

/**
 * In-memory store for MVP. Swap for Postgres without changing API shapes.
 */
class MemoryStore {
  profile: Profile = structuredClone(DEMO_PROFILE);
  jobs: JobListing[] = structuredClone(DEMO_JOBS);
  drafts: ApplicationDraft[] = structuredClone(DEMO_DRAFTS);
  resumes: ResumeVersion[] = [];
  automationEnabled = false;

  getProfile() {
    return this.profile;
  }

  updateProfile(patch: Partial<Profile>) {
    this.profile = { ...this.profile, ...patch, id: this.profile.id, userId: this.profile.userId };
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
    // Prepare drafts for top matching demo jobs within caps.
    const results = [];
    for (const job of this.jobs.slice(0, VOLUME_CAPS.maxDraftsPerDay)) {
      const r = this.prepareDraft(job.id);
      results.push(r);
    }
    return { enabled: true, results };
  }
}

const globalForStore = globalThis as unknown as { __vexaStore?: MemoryStore };

export const store = globalForStore.__vexaStore ?? new MemoryStore();
if (process.env.NODE_ENV !== "production") {
  globalForStore.__vexaStore = store;
}
