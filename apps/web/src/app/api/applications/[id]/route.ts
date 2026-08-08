import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { rememberEvent } from "@/lib/app-memory";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const draft = store.getDraft(id);
  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    draft: { ...draft, job: store.getJob(draft.jobListingId) },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json();
  if (body.status === "submitted") {
    const draft = store.markSubmitted(id, body.confirmationId);
    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const job = store.getJob(draft.jobListingId);
    if (job) {
      await rememberEvent({
        type: "submitted",
        company: job.company,
        title: job.title,
        jobId: job.id,
        url: job.externalUrl,
        status: "submitted",
        note: `confirmation=${draft.confirmationId}`,
        meta: { draftId: draft.id, confirmationId: draft.confirmationId },
      });
    }
    return NextResponse.json({ draft });
  }
  if (body.status === "failed") {
    const draft = store.markFailed(id, body.errorMessage ?? "Unknown error");
    if (!draft) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ draft });
  }
  return NextResponse.json({ error: "Unsupported status" }, { status: 400 });
}
