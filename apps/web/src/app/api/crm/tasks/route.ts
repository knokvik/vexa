import { NextResponse } from "next/server";
import { listUserTasks, upsertUserTask, listActions } from "@/lib/crm/db";
import { listApplications, listEvents } from "@/lib/crm/db";

/** Active work rail: tasks + interviews + open apps
 *  ?all=1 includes completed tasks
 */
export async function GET(request: Request) {
  const all = new URL(request.url).searchParams.get("all") === "1";
  const [tasks, actions, apps, events] = await Promise.all([
    listUserTasks(all),
    listActions(false),
    listApplications(),
    listEvents(),
  ]);
  const activeApps = apps
    .filter((a) => a.status === "active")
    .slice(0, 12);
  const upcoming = events
    .filter((e) => !e.done)
    .sort((a, b) => (a.datetime || "").localeCompare(b.datetime || ""))
    .slice(0, 8);

  return NextResponse.json({
    ok: true,
    tasks,
    actions: actions.slice(0, 10),
    applications: activeApps,
    events: upcoming,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const task = await upsertUserTask({
      id: body.id ? String(body.id) : undefined,
      title,
      kind: body.kind || "personal",
      companyName: body.companyName,
      companyId: body.companyId,
      dueAt: body.dueAt,
      notes: body.notes,
      done: body.done,
      applicationId: body.applicationId,
    });
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const task = await upsertUserTask({
      id,
      title: body.title || "Task",
      kind: body.kind || "personal",
      done: body.done ?? true,
      companyName: body.companyName,
      notes: body.notes,
      dueAt: body.dueAt,
    });
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
