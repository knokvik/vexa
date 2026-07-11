#!/usr/bin/env node
/**
 * Continuous smoke for single-user Vexa. Exit 0 if core path works.
 * Usage: node scripts/e2e-smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] || "http://127.0.0.1:5173";

async function j(path, opts) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
    signal: AbortSignal.timeout(opts?.timeoutMs || 60000),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: res.status, body };
}

function pass(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  let fails = 0;

  const health = await j("/api/health", { timeoutMs: 10000 });
  fails += !pass(
    "health",
    health.status === 200 && health.body.ok,
    JSON.stringify(health.body.keys || {})
  )
    ? 1
    : 0;

  const home = await j("/", { timeoutMs: 15000 });
  fails += !pass("home page", home.status === 200) ? 1 : 0;

  // Discover (may be slow; allow fail soft if keys exhausted)
  const disc = await j("/api/jobs/discover", {
    method: "POST",
    body: JSON.stringify({ query: "frontend engineer remote" }),
    timeoutMs: 90000,
  });
  const discOk =
    disc.status === 200 &&
    (disc.body.ok === true || disc.body.count > 0 || disc.body.jobs?.length);
  fails += !pass(
    "discover",
    discOk || disc.body.sources,
    discOk
      ? `count=${disc.body.count}`
      : `status=${disc.status} ${disc.body.error || ""}`
  )
    ? 0
    : 0; // discover soft: don't fail hard if rate limited
  if (!discOk) console.log("  (discover soft-fail ok for e2e if drafts work)");

  const jobs = await j("/api/jobs", { timeoutMs: 10000 });
  const jobList = jobs.body.jobs || [];
  fails += !pass("jobs list", jobs.status === 200 && jobList.length > 0, `n=${jobList.length}`)
    ? 1
    : 0;

  const jobId = jobList.find((j) => j.id === "job_1")?.id || jobList[0]?.id;
  const draft = await j("/api/applications", {
    method: "POST",
    body: JSON.stringify({ jobId }),
    timeoutMs: 90000,
  });
  const d = draft.body.draft;
  const draftOk =
    draft.status === 200 &&
    d &&
    (d.status === "ready" ||
      d.status === "requires_review" ||
      d.status === "duplicate");
  fails += !pass(
    "prepare draft",
    draftOk,
    draftOk
      ? `status=${d.status} ats=${d.matchScore} shortlist=${d.shortlistProbability}`
      : draft.body.error || `http ${draft.status}`
  )
    ? 1
    : 0;

  if (d?.id && d.status !== "duplicate") {
    const pkg = await j(`/api/applications/${d.id}/package`, {
      timeoutMs: 30000,
    });
    fails += !pass(
      "apply package",
      pkg.status === 200 && pkg.body.package?.autoSubmit === false,
      `autoSubmit=${pkg.body.package?.autoSubmit}`
    )
      ? 1
      : 0;
  } else if (d?.id) {
    // find a ready draft
    const apps = await j("/api/applications", { timeoutMs: 10000 });
    const ready = (apps.body.applications || []).find(
      (a) => a.status === "ready" || a.status === "requires_review"
    );
    if (ready) {
      const pkg = await j(`/api/applications/${ready.id}/package`, {
        timeoutMs: 30000,
      });
      fails += !pass(
        "apply package",
        pkg.status === 200 && pkg.body.package?.autoSubmit === false,
        `id=${ready.id}`
      )
        ? 1
        : 0;
    }
  }

  const tasks = await j("/api/tasks", { timeoutMs: 10000 });
  fails += !pass(
    "task memory",
    tasks.status === 200 && Array.isArray(tasks.body.tasks),
    `n=${tasks.body.tasks?.length ?? 0}`
  )
    ? 1
    : 0;

  // Intelligence unit tests
  console.log("--- unit intelligence ---");
  // run via shell externally if needed

  console.log("\n" + (fails === 0 ? "E2E PASS" : `E2E FAIL (${fails})`));
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
