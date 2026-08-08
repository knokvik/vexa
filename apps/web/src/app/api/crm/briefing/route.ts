import { NextResponse } from "next/server";
import { morningBriefing } from "@/lib/crm/actions";
import { markActionDone } from "@/lib/crm/db";

/** GET morning briefing · PATCH mark action done */
export async function GET() {
  const briefing = await morningBriefing();
  return NextResponse.json({ ok: true, ...briefing, autoApply: false });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = String(body.actionId || body.id || "");
    if (!id) {
      return NextResponse.json({ error: "actionId required" }, { status: 400 });
    }
    await markActionDone(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
