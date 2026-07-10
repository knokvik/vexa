import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  const applications = store.listDrafts().map((d) => ({
    ...d,
    job: store.getJob(d.jobListingId),
  }));
  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
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
