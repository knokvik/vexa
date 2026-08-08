/**
 * Durable JSON database (SQL-shaped tables).
 * Survives process restarts. Path: apps/web/data/durable/vexa.json
 *
 * Interface is repository-style so a real SQLite backend can replace this later
 * without changing call sites.
 */

import { promises as fs } from "fs";
import type {
  ApplicationRow,
  DurableSnapshot,
  FollowUpRow,
  JobRow,
  OutcomeEvent,
  OutcomeRow,
  ScoreRow,
} from "./types";
import { dataPath } from "@/lib/data-root";

const DATA_DIR = dataPath("durable");
const DB_PATH = dataPath("durable", "vexa.json");

function emptySnapshot(): DurableSnapshot {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    jobs: [],
    scores: [],
    applications: [],
    outcomes: [],
    follow_ups: [],
    profile_json: null,
    resumes_json: "[]",
    platforms_json: null,
  };
}

let cache: DurableSnapshot | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function loadDb(): Promise<DurableSnapshot> {
  if (cache) return cache;
  await ensureDir();
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    cache = { ...emptySnapshot(), ...JSON.parse(raw) } as DurableSnapshot;
  } catch {
    cache = emptySnapshot();
  }
  return cache;
}

export async function saveDb(mutator: (db: DurableSnapshot) => void): Promise<DurableSnapshot> {
  writeQueue = writeQueue.then(async () => {
    const db = await loadDb();
    mutator(db);
    db.updatedAt = new Date().toISOString();
    cache = db;
    try {
      await ensureDir();
      const tmp = `${DB_PATH}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
      await fs.rename(tmp, DB_PATH);
    } catch {
      /* serverless /tmp race — in-memory cache still valid for this instance */
    }
  });
  await writeQueue;
  return cache!;
}

export function getDbPath() {
  return DB_PATH;
}

// ── Jobs ──────────────────────────────────────────────

export async function upsertJob(row: JobRow) {
  await saveDb((db) => {
    const i = db.jobs.findIndex((j) => j.id === row.id || j.url === row.url);
    if (i >= 0) db.jobs[i] = { ...db.jobs[i], ...row };
    else db.jobs.unshift(row);
  });
}

export async function upsertJobs(rows: JobRow[]) {
  await saveDb((db) => {
    for (const row of rows) {
      const i = db.jobs.findIndex((j) => j.id === row.id || j.url === row.url);
      if (i >= 0) db.jobs[i] = { ...db.jobs[i], ...row };
      else db.jobs.unshift(row);
    }
  });
}

export async function listJobs(): Promise<JobRow[]> {
  return (await loadDb()).jobs;
}

export async function getJob(id: string): Promise<JobRow | null> {
  return (await loadDb()).jobs.find((j) => j.id === id) ?? null;
}

// ── Scores ────────────────────────────────────────────

export async function insertScore(row: ScoreRow) {
  await saveDb((db) => {
    db.scores.unshift(row);
    // keep last 500
    db.scores = db.scores.slice(0, 500);
  });
}

export async function latestScore(jobId: string): Promise<ScoreRow | null> {
  const db = await loadDb();
  return db.scores.find((s) => s.job_id === jobId) ?? null;
}

// ── Applications ──────────────────────────────────────

export async function upsertApplication(row: ApplicationRow) {
  await saveDb((db) => {
    const i = db.applications.findIndex((a) => a.id === row.id);
    if (i >= 0) db.applications[i] = { ...db.applications[i], ...row };
    else db.applications.unshift(row);
  });
}

export async function listApplications(): Promise<ApplicationRow[]> {
  return (await loadDb()).applications;
}

export async function getApplication(id: string): Promise<ApplicationRow | null> {
  return (await loadDb()).applications.find((a) => a.id === id) ?? null;
}

// ── Outcomes ──────────────────────────────────────────

export async function addOutcome(row: OutcomeRow) {
  await saveDb((db) => {
    db.outcomes.unshift(row);
    const app = db.applications.find((a) => a.id === row.application_id);
    if (app) app.latest_outcome = row.event;
  });
}

export async function listOutcomes(applicationId?: string): Promise<OutcomeRow[]> {
  const db = await loadDb();
  if (!applicationId) return db.outcomes;
  return db.outcomes.filter((o) => o.application_id === applicationId);
}

// ── Follow-ups ────────────────────────────────────────

export async function upsertFollowUp(row: FollowUpRow) {
  await saveDb((db) => {
    const i = db.follow_ups.findIndex((f) => f.outreach_id === row.outreach_id);
    if (i >= 0) db.follow_ups[i] = row;
    else db.follow_ups.unshift(row);
  });
}

export async function listDueFollowUps(asOf = new Date()): Promise<FollowUpRow[]> {
  const db = await loadDb();
  const t = asOf.toISOString();
  return db.follow_ups.filter((f) => !f.sent && f.scheduled_at <= t);
}

export async function listFollowUps(): Promise<FollowUpRow[]> {
  return (await loadDb()).follow_ups;
}

// ── Profile / resumes / platforms blobs ───────────────

export async function saveProfileJson(json: string) {
  await saveDb((db) => {
    db.profile_json = json;
  });
}

export async function loadProfileJson(): Promise<string | null> {
  return (await loadDb()).profile_json;
}

export async function saveResumesJson(json: string) {
  await saveDb((db) => {
    db.resumes_json = json;
  });
}

export async function loadResumesJson(): Promise<string> {
  return (await loadDb()).resumes_json || "[]";
}

export async function savePlatformsJson(json: string) {
  await saveDb((db) => {
    db.platforms_json = json;
  });
}

export async function loadPlatformsJson(): Promise<string | null> {
  return (await loadDb()).platforms_json;
}

// ── Cold email company cap ────────────────────────────

export async function countCompanyOutreachLastDays(
  company: string,
  days = 7
): Promise<number> {
  const db = await loadDb();
  const since = Date.now() - days * 86400000;
  const key = company.trim().toLowerCase();
  // Count follow_ups + outcomes linked via apps is heavy; use follow_ups + apps draft
  // Also count cold-email drafts from follow_ups company field
  return db.follow_ups.filter(
    (f) =>
      f.company.trim().toLowerCase() === key &&
      new Date(f.scheduled_at).getTime() > since - 5 * 86400000
  ).length;
}

// ── Weekly stats ──────────────────────────────────────

export type WeeklyStats = {
  totalApplications: number;
  withOutcomes: number;
  /** All-time submitted applications (status in draft_json) */
  submitted: number;
  ready: number;
  needsReview: number;
  jobsTracked: number;
  byEvent: Record<string, number>;
  byConfidenceBand: Array<{
    band: string;
    applications: number;
    responses: number; // phone+onsite+offer
    responseRate: number;
  }>;
  byTemplate: Array<{
    template: string;
    applications: number;
    responses: number;
  }>;
  coldEmails: {
    followUpsDue: number;
    followUpsPending: number;
    total: number;
  };
  /** phone_screen + onsite + offer as “replies / positive signal” */
  replies: number;
  rejected: number;
  noResponse: number;
  responseRateOverall: number;
  dbPath: string;
  updatedAt: string;
};

export async function computeWeeklyStats(): Promise<WeeklyStats> {
  const db = await loadDb();
  const weekAgo = Date.now() - 7 * 86400000;

  const apps = db.applications.filter((a) => {
    try {
      const d = JSON.parse(a.draft_json) as { createdAt?: string };
      return d.createdAt ? new Date(d.createdAt).getTime() >= weekAgo : true;
    } catch {
      return true;
    }
  });

  const byEvent: Record<string, number> = {};
  for (const o of db.outcomes) {
    byEvent[o.event] = (byEvent[o.event] || 0) + 1;
  }

  const responseEvents = new Set(["phone_screen", "onsite", "offer"]);

  function band(c: number) {
    if (c >= 0.85) return "≥85%";
    if (c >= 0.6) return "60–85%";
    return "<60%";
  }

  const bandMap = new Map<
    string,
    { applications: number; responses: number }
  >();
  const templateMap = new Map<
    string,
    { applications: number; responses: number }
  >();

  for (const app of apps) {
    const score =
      db.scores.find((s) => s.job_id === app.job_id)?.overall_confidence ??
      (() => {
        try {
          const d = JSON.parse(app.draft_json) as {
            shortlistProbability?: number;
          };
          return d.shortlistProbability ?? 0;
        } catch {
          return 0;
        }
      })();
    const b = band(score);
    const t = app.template_used || "unknown";
    const outcomes = db.outcomes.filter((o) => o.application_id === app.id);
    const responded = outcomes.some((o) => responseEvents.has(o.event));

    const bb = bandMap.get(b) || { applications: 0, responses: 0 };
    bb.applications += 1;
    if (responded) bb.responses += 1;
    bandMap.set(b, bb);

    const tt = templateMap.get(t) || { applications: 0, responses: 0 };
    tt.applications += 1;
    if (responded) tt.responses += 1;
    templateMap.set(t, tt);
  }

  const withOutcomes = apps.filter((a) =>
    db.outcomes.some((o) => o.application_id === a.id)
  ).length;

  let submitted = 0;
  let ready = 0;
  let needsReview = 0;
  for (const a of db.applications) {
    try {
      const d = JSON.parse(a.draft_json) as { status?: string };
      if (d.status === "submitted") submitted += 1;
      else if (d.status === "ready") ready += 1;
      else if (d.status === "requires_review") needsReview += 1;
    } catch {
      /* ignore */
    }
  }

  const replies =
    (byEvent.phone_screen || 0) +
    (byEvent.onsite || 0) +
    (byEvent.offer || 0);
  const rejected = byEvent.rejected || 0;
  const noResponse = byEvent.no_response || 0;
  const outcomeTotal = replies + rejected + noResponse;
  const responseRateOverall =
    outcomeTotal === 0 ? 0 : Math.round((replies / outcomeTotal) * 100);

  return {
    totalApplications: apps.length,
    withOutcomes,
    submitted,
    ready,
    needsReview,
    jobsTracked: db.jobs.length,
    byEvent,
    byConfidenceBand: [...bandMap.entries()].map(([bandName, v]) => ({
      band: bandName,
      applications: v.applications,
      responses: v.responses,
      responseRate:
        v.applications === 0
          ? 0
          : Math.round((v.responses / v.applications) * 100),
    })),
    byTemplate: [...templateMap.entries()].map(([template, v]) => ({
      template,
      applications: v.applications,
      responses: v.responses,
    })),
    coldEmails: {
      followUpsDue: (await listDueFollowUps()).length,
      followUpsPending: db.follow_ups.filter((f) => !f.sent).length,
      total: db.follow_ups.length,
    },
    replies,
    rejected,
    noResponse,
    responseRateOverall,
    dbPath: DB_PATH,
    updatedAt: db.updatedAt,
  };
}

export type { OutcomeEvent };
