import { NextResponse } from "next/server";
import type { PipelineStage } from "@vexa/shared";
import { PIPELINE_STAGES } from "@vexa/shared";
import {
  listApplications,
  getApplication,
  upsertApplication,
  listEmails,
  listEvents,
  listActions,
} from "@/lib/crm/db";
import { STAGE_LABELS, canTransition } from "@/lib/crm/pipeline";
import { appNeedsAttention, runActionEngine } from "@/lib/crm/actions";

/**
 * GET /api/crm/pipeline — kanban data + funnel
 * PATCH body: { id, stage?, notes?, status?, rejectionReason? }
 */
export async function GET() {
  await runActionEngine().catch(() => null);
  const apps = await listApplications();
  const emails = await listEmails(200);
  const events = await listEvents();
  const actions = await listActions(false);

  const columns: Record<string, typeof apps> = {};
  for (const s of PIPELINE_STAGES) columns[s] = [];
  for (const a of apps) {
    if (!columns[a.stage]) columns[a.stage] = [];
    columns[a.stage].push(a);
  }

  const needsAttention = apps
    .filter((a) => a.status === "active")
    .map((a) => ({ app: a, reason: appNeedsAttention(a) }))
    .filter((x) => x.reason);

  const funnel = PIPELINE_STAGES.map((s) => ({
    stage: s,
    label: STAGE_LABELS[s],
    count: columns[s]?.length || 0,
  }));

  return NextResponse.json({
    ok: true,
    columns,
    funnel,
    needsAttention,
    labels: STAGE_LABELS,
    stages: PIPELINE_STAGES,
    emailCount: emails.length,
    openActions: actions.slice(0, 15),
    upcomingEvents: events
      .filter((e) => !e.done && e.datetime)
      .sort((a, b) =>
        (a.datetime || "").localeCompare(b.datetime || "")
      )
      .slice(0, 10),
    autoApply: false,
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.id || "");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const app = await getApplication(id);
    if (!app) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    let stage = app.stage;
    if (body.stage) {
      const next = body.stage as PipelineStage;
      if (!canTransition(app.stage, next) && app.stage !== next) {
        // allow manual override with force
        if (!body.force) {
          return NextResponse.json(
            {
              error: `Invalid transition ${app.stage} → ${next}. Pass force:true to override.`,
            },
            { status: 400 }
          );
        }
      }
      stage = next;
    }

    const updated = await upsertApplication({
      ...app,
      stage,
      notes: body.notes !== undefined ? String(body.notes) : app.notes,
      rejectionReason:
        body.rejectionReason !== undefined
          ? String(body.rejectionReason)
          : app.rejectionReason,
      status:
        body.status === "closed" ||
        stage === "rejected" ||
        stage === "withdrawn" ||
        stage === "accepted"
          ? "closed"
          : body.status === "active"
            ? "active"
            : app.status,
      lastTouchAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, application: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "update failed" },
      { status: 500 }
    );
  }
}
