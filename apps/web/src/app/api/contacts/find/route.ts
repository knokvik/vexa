import { NextResponse } from "next/server";
import { findContacts, FREE_CONTACT_STACK } from "@/lib/free-sources";
import { rememberEvent } from "@/lib/app-memory";

/**
 * POST /api/contacts/find
 * Body: { company, fullName?, role? }
 * Free pattern emails + optional Hunter domain search.
 * Never auto-sends mail.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const company = String(body.company || "").trim();
    if (!company) {
      return NextResponse.json({ error: "company required" }, { status: 400 });
    }
    const fullName = body.fullName ? String(body.fullName) : undefined;
    const role = body.role ? String(body.role) : undefined;

    const result = await findContacts({ company, fullName, role });

    await rememberEvent({
      type: "company",
      company,
      title: role || "Contact find",
      note: `contacts found=${result.emails.length} sources=${result.sourcesUsed.join(",")}`,
      meta: { sources: result.sourcesUsed, domain: result.domain },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      ...result,
      freeStack: FREE_CONTACT_STACK,
      autoSend: false,
      message:
        "Verify emails before outreach. Use browser free tiers (GetProspect/Apollo) for more credits.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "find failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    freeStack: FREE_CONTACT_STACK,
    hunterConfigured: Boolean(process.env.HUNTER_API_KEY?.trim()),
    freeJobSources: [
      "Remotive API",
      "Arbeitnow API",
      "RemoteOK API",
      "Jobicy API",
      "Himalayas API",
      "We Work Remotely RSS",
      "Indeed RSS (best-effort; often blocked)",
      "Greenhouse/Lever public boards",
      "Firecrawl/Exa (if keys set)",
    ],
  });
}
