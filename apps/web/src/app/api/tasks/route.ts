import { NextResponse } from "next/server";
import {
  listRecentTasks,
  loadTask,
  loadTaskMarkdown,
  taskToMarkdown,
} from "@/lib/task-memory";
import {
  appMemoryToGraphParts,
  loadAppMemory,
  rememberEvent,
} from "@/lib/app-memory";

/** GET /api/tasks — tasks + application memory (companies applied, etc.) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (id) {
    const task = await loadTask(id);
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const markdown =
      (await loadTaskMarkdown(id)) || taskToMarkdown(task);
    return NextResponse.json({
      task,
      markdown,
      paths: {
        json: `apps/web/data/tasks/${id}.json`,
        md: `memory/tasks/${id}.md`,
      },
    });
  }
  const tasks = await listRecentTasks(40);
  const appMemory = await loadAppMemory();
  const appGraph = appMemoryToGraphParts(appMemory);
  return NextResponse.json({
    tasks,
    appMemory: {
      updatedAt: appMemory.updatedAt,
      companies: Object.values(appMemory.companies),
      searches: appMemory.searches,
      events: appMemory.events.slice(0, 40),
      paths: {
        json: "apps/web/data/memory/app-memory.json",
        md: "memory/APP_MEMORY.md",
      },
    },
    appGraph,
    vault:
      "memory/tasks/*.md + memory/APP_MEMORY.md + apps/web/data/tasks + apps/web/data/memory",
  });
}

/** POST /api/tasks — record application memory event */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const store = await rememberEvent({
      type: body.type || "company",
      company: body.company,
      title: body.title,
      jobId: body.jobId,
      url: body.url,
      query: body.query,
      status: body.status,
      note: body.note,
      meta: body.meta,
    });
    return NextResponse.json({
      ok: true,
      companies: Object.keys(store.companies).length,
      events: store.events.length,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
