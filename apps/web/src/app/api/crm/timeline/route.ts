import { NextResponse } from "next/server";
import { loadCrm } from "@/lib/crm/db";

/**
 * GET /api/crm/timeline?company=&limit=50
 * Chronological feed of emails, events, stage-bearing applications.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.toLowerCase();
  const limit = Math.min(100, Number(searchParams.get("limit")) || 50);
  const db = await loadCrm();

  type Item = {
    id: string;
    kind: "email" | "event" | "application" | "action";
    at: string;
    title: string;
    detail?: string;
    companyName?: string;
    meta?: Record<string, unknown>;
  };

  const items: Item[] = [];

  for (const e of db.emails) {
    const co = db.companies.find((c) => c.id === e.companyId);
    if (company && !(co?.name.toLowerCase().includes(company) || e.extracted.companyName?.toLowerCase().includes(company))) {
      continue;
    }
    items.push({
      id: e.id,
      kind: "email",
      at: e.receivedAt,
      title: e.subject,
      detail: `${e.classification} · ${e.fromName || e.fromEmail}`,
      companyName: co?.name || e.extracted.companyName,
      meta: {
        classification: e.classification,
        applicationId: e.applicationId,
      },
    });
  }

  for (const ev of db.events) {
    const co = db.companies.find((c) => c.id === ev.companyId);
    if (company && !co?.name.toLowerCase().includes(company)) continue;
    items.push({
      id: ev.id,
      kind: "event",
      at: ev.datetime || ev.createdAt,
      title: ev.title,
      detail: ev.type + (ev.done ? " · done" : ""),
      companyName: co?.name,
      meta: { type: ev.type, applicationId: ev.applicationId },
    });
  }

  for (const a of db.applications) {
    if (company && !a.companyName.toLowerCase().includes(company)) continue;
    items.push({
      id: a.id,
      kind: "application",
      at: a.updatedAt || a.createdAt,
      title: `${a.jobTitle} @ ${a.companyName}`,
      detail: `Stage: ${a.stage}`,
      companyName: a.companyName,
      meta: { stage: a.stage, status: a.status },
    });
  }

  for (const act of db.actions.filter((x) => !x.done)) {
    items.push({
      id: act.id,
      kind: "action",
      at: act.dueAt || act.createdAt,
      title: act.title,
      detail: act.kind + " · " + act.priority,
      meta: { kind: act.kind, priority: act.priority },
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));

  return NextResponse.json({
    ok: true,
    items: items.slice(0, limit),
    total: items.length,
  });
}
