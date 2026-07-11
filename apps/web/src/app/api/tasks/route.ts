import { NextResponse } from "next/server";
import {
  listRecentTasks,
  loadTask,
  loadTaskMarkdown,
  taskToMarkdown,
} from "@/lib/task-memory";

/** GET /api/tasks — recent task memory (single-user, Obsidian-style) */
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
  return NextResponse.json({
    tasks,
    vault: "memory/tasks/*.md + apps/web/data/tasks/*.json",
  });
}
