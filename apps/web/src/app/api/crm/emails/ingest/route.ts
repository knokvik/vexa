import { NextResponse } from "next/server";
import { ingestEmail, ingestEmailBatch, parsePastedEmail } from "@/lib/crm/ingest";
import { rememberEvent } from "@/lib/app-memory";

/**
 * POST /api/crm/emails/ingest
 * Body:
 *  - { subject, bodyText, fromEmail?, fromName?, ... } single
 *  - { raw: "pasted headers+body" } single paste
 *  - { batch: true, raw: "..." } multi-message paste
 * Never auto-applies or auto-sends.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.batch && typeof body.raw === "string") {
      const { results, count } = await ingestEmailBatch(body.raw);
      await rememberEvent({
        type: "search",
        note: `crm email batch ingested=${count}`,
        meta: {
          classifications: results.map((r) => r.classification),
        },
      }).catch(() => null);
      return NextResponse.json({
        ok: true,
        count,
        results: results.map(summarize),
        autoApply: false,
      });
    }

    let input;
    if (typeof body.raw === "string" && body.raw.trim()) {
      input = parsePastedEmail(body.raw);
    } else {
      input = {
        subject: String(body.subject || "").trim(),
        bodyText: String(body.bodyText || body.body || "").trim(),
        fromEmail: body.fromEmail ? String(body.fromEmail) : undefined,
        fromName: body.fromName ? String(body.fromName) : undefined,
        toEmail: body.toEmail ? String(body.toEmail) : undefined,
        receivedAt: body.receivedAt ? String(body.receivedAt) : undefined,
        messageId: body.messageId ? String(body.messageId) : undefined,
        threadId: body.threadId ? String(body.threadId) : undefined,
        forceClass: body.forceClass,
      };
    }

    if (!input.subject && !input.bodyText) {
      return NextResponse.json(
        { error: "subject/bodyText or raw email required" },
        { status: 400 }
      );
    }

    const result = await ingestEmail(input);
    await rememberEvent({
      type: "company",
      company: result.email.extracted.companyName,
      title: result.email.extracted.jobTitle,
      note: `email class=${result.classification} stage=${result.stage || "—"}`,
      meta: {
        classification: result.classification,
        applicationId: result.applicationId,
      },
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      ...summarize(result),
      notes: result.notes,
      autoApply: false,
      message:
        "Email classified and linked to graph. You still apply / reply manually.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ingest failed" },
      { status: 500 }
    );
  }
}

function summarize(r: Awaited<ReturnType<typeof ingestEmail>>) {
  return {
    emailId: r.email.id,
    classification: r.classification,
    confidence: r.email.classificationConfidence,
    companyId: r.companyId,
    contactId: r.contactId,
    jobId: r.jobId,
    applicationId: r.applicationId,
    stage: r.stage,
    actionsCreated: r.actionsCreated,
    subject: r.email.subject,
    extracted: r.email.extracted,
  };
}
