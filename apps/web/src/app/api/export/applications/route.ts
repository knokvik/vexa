import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { listOutcomes } from "@/lib/durable/db";

/**
 * GET /api/export/applications
 * CSV export for Google Sheets / Airtable import (Layer 5 free tracking).
 */
export async function GET() {
  await store.ensureHydrated();
  const apps = store.listDrafts();
  const outcomes = await listOutcomes();
  const latest = new Map<string, string>();
  for (const o of outcomes) {
    if (!latest.has(o.application_id)) latest.set(o.application_id, o.event);
  }

  const header = [
    "Date",
    "Company",
    "Role",
    "Source",
    "Status",
    "Match ATS",
    "Shortlist %",
    "Surface",
    "Outcome",
    "Job URL",
    "Follow-up",
    "Notes",
  ];

  const rows = apps.map((a) => {
    const job = store.getJob(a.jobListingId);
    const date = (a.submittedAt || a.createdAt || "").slice(0, 10);
    const company = job?.company || "";
    const role = job?.title || "";
    const source = job?.source || "";
    const status = a.status;
    const match = a.matchScore ?? "";
    const shortlist =
      a.shortlistProbability != null
        ? Math.round(a.shortlistProbability * 100)
        : "";
    const surface = a.formSurface || "";
    const outcome = latest.get(a.id) || "";
    const url = job?.externalUrl || "";
    // follow-up 7 days after created if not submitted outcome
    let followUp = "";
    if (a.createdAt) {
      const d = new Date(a.createdAt);
      d.setDate(d.getDate() + 7);
      followUp = d.toISOString().slice(0, 10);
    }
    const notes = (a.coverLetter || "").replace(/\s+/g, " ").slice(0, 120);
    return [
      date,
      company,
      role,
      source,
      status,
      String(match),
      String(shortlist),
      surface,
      outcome,
      url,
      followUp,
      notes,
    ];
  });

  const esc = (c: string) => {
    if (/[",\n]/.test(c)) return `"${c.replace(/"/g, '""')}"`;
    return c;
  };
  const csv = [header, ...rows]
    .map((r) => r.map((c) => esc(String(c))).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vexa-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
