import { NextResponse } from "next/server";
import {
  networkSummary,
  whoDoIKnowAt,
  referralPathsTo,
} from "@/lib/crm/graph";
import { upsertContact, addRelationship } from "@/lib/crm/db";

/**
 * GET /api/crm/network?company=Stripe
 * POST — add contact or relationship
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const company = searchParams.get("company")?.trim();

  if (company) {
    const direct = await whoDoIKnowAt(company);
    const paths = await referralPathsTo(company);
    return NextResponse.json({
      ok: true,
      company,
      direct,
      referralPaths: paths,
      message: direct.length
        ? `You know ${direct.length} contact(s) at ${company}`
        : `No direct contacts at ${company} yet — paste recruiter emails to grow the graph.`,
    });
  }

  const summary = await networkSummary();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "relationship") {
      const rel = await addRelationship({
        fromContactId: String(body.fromContactId),
        toContactId: String(body.toContactId),
        type: body.type || "knows",
        strength: Number(body.strength) || 2,
        note: body.note ? String(body.note) : undefined,
      });
      return NextResponse.json({ ok: true, relationship: rel });
    }

    // default: upsert contact
    const email = String(body.email || "").trim();
    const name = String(body.name || "").trim();
    if (!email || !name) {
      return NextResponse.json(
        { error: "name and email required" },
        { status: 400 }
      );
    }
    const contact = await upsertContact({
      name,
      email,
      title: body.title ? String(body.title) : undefined,
      companyName: body.companyName ? String(body.companyName) : undefined,
      companyId: body.companyId ? String(body.companyId) : undefined,
      roleType: body.roleType || "other",
      strength: Number(body.strength) || 2,
      linkedinUrl: body.linkedinUrl ? String(body.linkedinUrl) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
    });
    return NextResponse.json({ ok: true, contact });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
