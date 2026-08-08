import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { listOutcomes } from "@/lib/durable/db";

export async function GET() {
  await store.ensureHydrated();
  const outcomes = await listOutcomes();
  const latestByApp = new Map<string, string>();
  for (const o of outcomes) {
    if (!latestByApp.has(o.application_id)) {
      latestByApp.set(o.application_id, o.event);
    }
  }
  const applications = store.listDrafts().map((d) => ({
    ...d,
    job: store.getJob(d.jobListingId),
    latestOutcome: latestByApp.get(d.id) || null,
  }));
  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  await store.ensureHydrated();
  const body = await request.json();
  const jobId = body.jobId as string;
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }
  const result = await store.prepareDraft(jobId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    draft: { ...result, job: store.getJob(result.jobListingId) },
  });
}
