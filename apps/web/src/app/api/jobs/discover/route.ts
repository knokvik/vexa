import { NextResponse } from "next/server";
import { discoverJobs } from "@/lib/discover";
import { store } from "@/lib/store";
import { createTask, runStep, completeTask } from "@/lib/task-memory";
import { rememberEvent } from "@/lib/app-memory";
import type { JobListing } from "@vexa/shared";

/**
 * POST /api/jobs/discover  { query?: string }
 * Light discovery via Firecrawl + Exa (few results, cost-aware).
 */
export async function POST(request: Request) {
  let query = "senior frontend engineer remote";
  /** Prefer ATS boards by default — set includeLinkedIn:true for research */
  let skipLinkedIn = true;
  try {
    const body = await request.json();
    if (body.query) query = String(body.query);
    if (body.includeLinkedIn === true || body.skipLinkedIn === false) {
      skipLinkedIn = false;
    }
  } catch {
    /* default query */
  }

  const task = await createTask("discover_jobs", ["fetch"], { query, skipLinkedIn });

  try {
    const result = await runStep(task, "fetch", async () => {
      const r = await discoverJobs(query, { skipLinkedIn, limit: 40 });
      return {
        output: r,
        notes: `sources=${JSON.stringify(r.sources)} skipLI=${skipLinkedIn}`,
      };
    });

    store.upsertJobs(result.jobs as JobListing[]);
    await completeTask(task, "done");

    await rememberEvent({
      type: "search",
      query,
      note: `discover count=${result.jobs.length}`,
      meta: { taskId: task.id, sources: result.sources },
    });
    for (const j of result.jobs.slice(0, 15)) {
      await rememberEvent({
        type: "discovered",
        company: j.company,
        title: j.title,
        jobId: j.id,
        url: j.externalUrl,
        query,
      });
    }

    return NextResponse.json({
      ok: true,
      taskId: task.id,
      query,
      count: result.jobs.length,
      sources: result.sources,
      jobs: result.jobs,
    });
  } catch (e) {
    await completeTask(task, "failed");
    return NextResponse.json(
      {
        ok: false,
        taskId: task.id,
        error: e instanceof Error ? e.message : "discover failed",
      },
      { status: 502 }
    );
  }
}
