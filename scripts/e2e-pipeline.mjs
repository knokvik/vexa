#!/usr/bin/env node
/**
 * Full co-pilot pipeline smoke:
 *   health → discover (ATS) → memory → draft → package (autoSubmit:false)
 *   → cold email HR → automation batch → stats
 *
 * Usage: node scripts/e2e-pipeline.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://127.0.0.1:5173";

async function j(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
    signal: AbortSignal.timeout(opts.timeoutMs || 120000),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 240) };
  }
  return { status: res.status, body };
}

function pass(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  let fails = 0;
  console.log(`\nVexa pipeline e2e @ ${BASE}\n`);

  // 1. Health
  const health = await j("/api/health", { timeoutMs: 10000 });
  fails += !pass(
    "health + keys",
    health.status === 200 && health.body.ok,
    JSON.stringify(health.body.keys || {})
  )
    ? 1
    : 0;

  // 2. Discover ATS-first (no LinkedIn)
  console.log("\n── discover (ATS-first) ──");
  const disc = await j("/api/jobs/discover", {
    method: "POST",
    body: JSON.stringify({
      query: "software engineer typescript",
      skipLinkedIn: true,
    }),
    timeoutMs: 120000,
  });
  const discOk =
    disc.status === 200 &&
    disc.body.ok &&
    (disc.body.count > 0 || disc.body.jobs?.length > 0);
  fails += !pass(
    "discover jobs",
    discOk,
    discOk
      ? `count=${disc.body.count} sources=${JSON.stringify(disc.body.sources)}`
      : `http=${disc.status} ${disc.body.error || ""}`
  )
    ? 1
    : 0;

  // Prefer a greenhouse/lever URL for package test
  const jobsRes = await j("/api/jobs", { timeoutMs: 15000 });
  const jobs = jobsRes.body.jobs || [];
  const atsJob =
    jobs.find((x) =>
      /greenhouse\.io|lever\.co|ashbyhq\.com/i.test(x.externalUrl || "")
    ) || jobs[0];
  fails += !pass(
    "jobs store",
    jobs.length > 0 && !!atsJob,
    `n=${jobs.length} pick=${atsJob?.company || "?"} ${atsJob?.title?.slice(0, 40) || ""}`
  )
    ? 1
    : 0;

  // 3. Memory after discover
  const tasks1 = await j("/api/tasks", { timeoutMs: 10000 });
  const mem = tasks1.body.appMemory;
  fails += !pass(
    "app memory",
    tasks1.status === 200 && (mem?.companies?.length >= 0 || tasks1.body.tasks),
    `tasks=${tasks1.body.tasks?.length ?? 0} companies=${mem?.companies?.length ?? 0} events=${mem?.events?.length ?? 0}`
  )
    ? 1
    : 0;

  // 4. Prepare draft
  console.log("\n── draft + package ──");
  let draftId = null;
  let draftStatus = null;
  if (atsJob?.id) {
    const draft = await j("/api/applications", {
      method: "POST",
      body: JSON.stringify({ jobId: atsJob.id }),
      timeoutMs: 90000,
    });
    const d = draft.body.draft;
    draftId = d?.id;
    draftStatus = d?.status;
    const draftOk =
      draft.status === 200 &&
      d &&
      ["ready", "requires_review", "duplicate"].includes(d.status);
    fails += !pass(
      "prepare draft",
      draftOk,
      draftOk
        ? `status=${d.status} ats=${d.matchScore} shortlist=${d.shortlistProbability} surface=${atsJob.externalUrl?.slice(0, 48)}`
        : draft.body.error || `http ${draft.status}`
    )
      ? 1
      : 0;
  }

  // Resolve package target
  if (!draftId || draftStatus === "duplicate") {
    const apps = await j("/api/applications", { timeoutMs: 10000 });
    const ready = (apps.body.applications || []).find(
      (a) => a.status === "ready" || a.status === "requires_review"
    );
    draftId = ready?.id || draftId;
  }

  if (draftId) {
    const pkg = await j(`/api/applications/${draftId}/package`, {
      timeoutMs: 30000,
    });
    const auto = pkg.body.package?.autoSubmit;
    fails += !pass(
      "apply package autoSubmit=false",
      pkg.status === 200 && auto === false,
      `autoSubmit=${auto} url=${pkg.body.package?.jobUrl?.slice(0, 50) || "?"}`
    )
      ? 1
      : 0;
  } else {
    fails += !pass("apply package", false, "no draft id") ? 1 : 0;
  }

  // 5. Cold email to HR / recruiting
  console.log("\n── cold email → HR ──");
  const cold = await j("/api/cold-email", {
    method: "POST",
    body: JSON.stringify({
      action: "draft_for_job",
      applicationId: draftId,
      jobId: atsJob?.id,
    }),
    timeoutMs: 60000,
  });
  fails += !pass(
    "cold email draft (HR)",
    cold.status === 200 && cold.body.ok && cold.body.draft?.to,
    cold.body.ok
      ? `to=${cold.body.draft.to} subj=${cold.body.draft.subject?.slice(0, 50)} send=${cold.body.send?.provider}`
      : cold.body.error || `http ${cold.status}`
  )
    ? 1
    : 0;

  // 6. Automation find_draft (small batch)
  console.log("\n── automation find_draft ──");
  const auto = await j("/api/automation/start", {
    method: "POST",
    body: JSON.stringify({
      mode: "find_draft",
      query: "backend engineer",
      maxDrafts: 2,
      coldEmails: true,
    }),
    timeoutMs: 180000,
  });
  fails += !pass(
    "automation find+draft",
    auto.status === 200 && auto.body.enabled,
    `discovered=${auto.body.discovered} prepared=${auto.body.prepared} outreach=${auto.body.outreach?.length ?? 0}`
  )
    ? 1
    : 0;

  // 7. Weekly stats + dashboard
  const stats = await j("/api/stats/weekly", { timeoutMs: 10000 });
  fails += !pass(
    "weekly stats",
    stats.status === 200 && stats.body.stats,
    `submitted=${stats.body.stats?.submitted} ready=${stats.body.stats?.ready} review=${stats.body.stats?.needsReview}`
  )
    ? 1
    : 0;

  const home = await j("/", { timeoutMs: 15000 });
  fails += !pass("dashboard UI", home.status === 200) ? 1 : 0;

  console.log(
    "\n" +
      (fails === 0
        ? "PIPELINE E2E PASS — co-pilot path only (never auto-submits)"
        : `PIPELINE E2E FAIL (${fails})`)
  );
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
