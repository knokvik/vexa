/**
 * Bridge between MemoryStore shapes and durable tables.
 */

import type { ApplicationDraft, JobListing, Profile, ResumeVersion } from "@vexa/shared";
import { classifyApplySurface } from "@vexa/shared";
import type { ApplicationRow, JobRow, ScoreRow } from "./types";
import * as db from "./db";

export function jobToRow(job: JobListing, status: JobRow["status"] = "new"): JobRow {
  const loc =
    job.location?.raw ||
    [job.location?.city, job.location?.state, job.location?.country]
      .filter(Boolean)
      .join(", ") ||
    (job.location?.remote ? "Remote" : "");
  return {
    id: job.id,
    source: String(job.source || "manual"),
    company: job.company,
    title: job.title,
    location: loc,
    url: job.externalUrl,
    jd_raw: job.description || "",
    discovered_at: job.scrapedAt || new Date().toISOString(),
    status,
    listing_json: JSON.stringify(job),
  };
}

export function rowToJob(row: JobRow): JobListing | null {
  try {
    return JSON.parse(row.listing_json) as JobListing;
  } catch {
    return null;
  }
}

export function draftToRow(
  draft: ApplicationDraft,
  extra?: {
    template_used?: string;
    resume_variant_id?: string;
    tier?: number;
  }
): ApplicationRow {
  const surface = // infer tier from status + defaults
    draft.status === "requires_review" ? 2 : 1;
  return {
    id: draft.id,
    job_id: draft.jobListingId,
    resume_variant_id:
      extra?.resume_variant_id || draft.resumeVersionId || "",
    template_used: extra?.template_used || "tpl-harvard",
    tier: extra?.tier ?? surface,
    submitted_at: draft.submittedAt || null,
    submission_method: draft.submittedAt ? "extension_prefill" : null,
    confirmation_seen: draft.confirmationId ? 1 : 0,
    confirmation_evidence: draft.confirmationId || null,
    draft_json: JSON.stringify(draft),
  };
}

export function rowToDraft(row: ApplicationRow): ApplicationDraft | null {
  try {
    return JSON.parse(row.draft_json) as ApplicationDraft;
  } catch {
    return null;
  }
}

export function scoreFromDraft(
  jobId: string,
  shortlist: number,
  factors?: Array<{ factor: string; score: number }>,
  missing: string[] = [],
  reasoning = ""
): ScoreRow {
  const by = (name: string, fallback: number) =>
    factors?.find((f) => f.factor.includes(name))?.score ?? fallback;
  return {
    job_id: jobId,
    skills_match: by("skill", shortlist),
    seniority_fit: by("senior", shortlist),
    location_comp_fit: by("location", 1),
    domain_fit: by("domain", shortlist),
    overall_confidence: shortlist,
    reasoning,
    missing_requirements: JSON.stringify(missing),
    scored_at: new Date().toISOString(),
    model_used: "local-shortlist",
  };
}

export function tierForJob(url: string, shortlist: number): number {
  const surface = classifyApplySurface(url);
  if (surface === "linkedin" || surface === "indeed") return 3;
  if (shortlist >= 0.85) return 1;
  if (shortlist >= 0.6) return 2;
  return 2;
}

/** Hydrate in-memory store arrays from durable disk */
export async function hydrateFromDisk(): Promise<{
  jobs: JobListing[];
  drafts: ApplicationDraft[];
  resumes: ResumeVersion[];
  profile: Profile | null;
}> {
  const jobRows = await db.listJobs();
  const jobs = jobRows
    .map(rowToJob)
    .filter(Boolean) as JobListing[];

  const appRows = await db.listApplications();
  const drafts = appRows
    .map(rowToDraft)
    .filter(Boolean) as ApplicationDraft[];

  let resumes: ResumeVersion[] = [];
  try {
    resumes = JSON.parse(await db.loadResumesJson()) as ResumeVersion[];
  } catch {
    resumes = [];
  }

  let profile: Profile | null = null;
  const pj = await db.loadProfileJson();
  if (pj) {
    try {
      profile = JSON.parse(pj) as Profile;
    } catch {
      profile = null;
    }
  }

  return { jobs, drafts, resumes, profile };
}

export async function persistJob(job: JobListing, status?: JobRow["status"]) {
  await db.upsertJob(jobToRow(job, status));
}

export async function persistJobs(jobs: JobListing[]) {
  await db.upsertJobs(jobs.map((j) => jobToRow(j)));
}

export async function persistDraft(
  draft: ApplicationDraft,
  meta?: { template_used?: string; tier?: number }
) {
  await db.upsertApplication(draftToRow(draft, meta));
  if (draft.shortlistProbability != null) {
    await db.insertScore(
      scoreFromDraft(
        draft.jobListingId,
        draft.shortlistProbability,
        draft.shortlistFactors,
        [],
        `match=${draft.matchScore}`
      )
    );
  }
}

export async function persistProfile(profile: Profile) {
  await db.saveProfileJson(JSON.stringify(profile));
}

export async function persistResumes(resumes: ResumeVersion[]) {
  await db.saveResumesJson(JSON.stringify(resumes.slice(0, 100)));
}
