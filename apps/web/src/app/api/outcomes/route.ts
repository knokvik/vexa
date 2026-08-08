import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { OutcomeEvent } from "@/lib/durable/db";

const EVENTS: OutcomeEvent[] = [
  "viewed",
  "no_response",
  "rejected",
  "phone_screen",
  "onsite",
  "offer",
  "withdrawn",
];

/** GET /api/outcomes?applicationId= */
export async function GET(request: Request) {
  await store.ensureHydrated();
  const { searchParams } = new URL(request.url);
  const applicationId = searchParams.get("applicationId") || undefined;
  const outcomes = await store.listOutcomes(applicationId);
  return NextResponse.json({ outcomes });
}

/**
 * POST /api/outcomes
 * { applicationId, event, note?, eventAt? }
 */
export async function POST(request: Request) {
  await store.ensureHydrated();
  try {
    const body = await request.json();
    const applicationId = String(body.applicationId || "");
    const event = String(body.event || "") as OutcomeEvent;
    if (!applicationId || !EVENTS.includes(event)) {
      return NextResponse.json(
        {
          error: `applicationId + event required. events: ${EVENTS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    const result = await store.logOutcome(
      applicationId,
      event,
      body.note ? String(body.note) : undefined,
      body.eventAt ? String(body.eventAt) : undefined
    );
    if ("error" in result) {
      return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
