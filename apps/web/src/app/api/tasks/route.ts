import { NextResponse } from "next/server";
import { listRecentTasks, loadTask } from "@/lib/task-memory";

/** GET /api/tasks — recent task memory (single-user) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (id) {
    const task = await loadTask(id);
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  }
  const tasks = await listRecentTasks(15);
  return NextResponse.json({ tasks });
}
