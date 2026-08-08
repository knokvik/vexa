import { NextResponse } from "next/server";
import { buildGraphModel, focusNode } from "@/lib/crm/graph-model";
import { saveGraphLayout } from "@/lib/crm/db";
import type { GraphNodeLayout } from "@vexa/shared";

/** GET graph nodes/edges · POST save layout · ?focus=nodeId */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const focus = searchParams.get("focus");
  if (focus) {
    const bundle = await focusNode(focus);
    if (!bundle) {
      return NextResponse.json({ error: "node not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, focus: bundle });
  }
  const model = await buildGraphModel(50);
  return NextResponse.json({ ok: true, ...model });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.layout && typeof body.layout === "object") {
      await saveGraphLayout(body.layout as GraphNodeLayout);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "layout object required" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "save failed" },
      { status: 500 }
    );
  }
}
