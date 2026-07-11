import { NextResponse } from "next/server";
import { discoverJobs } from "@/lib/discover";
import { store } from "@/lib/store";
import { createTask, runStep, completeTask } from "@/lib/task-memory";
import type { JobListing } from "@vexa/shared";

/**
 * POST /api/jobs/discover  { query?: string }
 * Light discovery via Firecrawl + Exa (few results, cost-aware).
 */
export async function POST(request: Request) {
  let query = "senior frontend engineer remote";
  try {
    const body = await request.json();
    if (body.query) query = String(body.query);
  } catch {
    /* default query */
  }

  const task = await createTask("discover_jobs", ["fetch"], { query });

  try {
    const result = await runStep(task, "fetch", async () => {
      const r = await discoverJobs(query);
      return {
        output: r,
        notes: `fc=${r.sources.firecrawl?.count ?? 0} exa=${r.sources.exa?.count ?? 0}`,
      };
    });

    store.upsertJobs(result.jobs as JobListing[]);
    await completeTask(task, "done");

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
