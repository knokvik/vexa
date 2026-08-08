import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import {
  draftColdEmail,
  getSendCapability,
  listColdEmails,
  sendColdEmail,
  updateColdEmail,
} from "@/lib/cold-email";
import { rememberEvent } from "@/lib/app-memory";

/**
 * GET  /api/cold-email — list drafts + send capability
 * POST /api/cold-email
 *   { action: "draft", to, company, ... }
 *   { action: "update", id, subject?, body? }
 *   { action: "send", id }  — only if provider configured; always explicit
 *   { action: "copied", id } — mark user copied to own mail client
 */
export async function GET() {
  const drafts = await listColdEmails(50);
  return NextResponse.json({
    drafts,
    send: getSendCapability(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "draft");
    const profile = store.getProfile();

    if (action === "draft" || action === "draft_for_job") {
      let to = String(body.to || "");
      let toName = body.toName ? String(body.toName) : undefined;
      let toRole = body.toRole ? String(body.toRole) : undefined;
      let company = String(body.company || "");
      let jobTitle = body.jobTitle ? String(body.jobTitle) : undefined;
      let jobUrl = body.jobUrl ? String(body.jobUrl) : undefined;
      let userNote = body.userNote ? String(body.userNote) : undefined;
      let projectHook = body.projectHook
        ? String(body.projectHook)
        : undefined;

      // From existing application / job — default to recruiting@ + HR role
      if (action === "draft_for_job" || body.jobId || body.applicationId) {
        const { guessEmails } = await import("@/lib/cold-email");
        let job = body.jobId ? store.getJob(String(body.jobId)) : undefined;
        if (!job && body.applicationId) {
          const d = store.getDraft(String(body.applicationId));
          if (d) {
            job = store.getJob(d.jobListingId);
            userNote = userNote || d.coverLetter?.slice(0, 160);
            projectHook =
              projectHook ||
              `Match score ${d.matchScore ?? "—"} · shortlist ${Math.round(
                (d.shortlistProbability ?? 0) * 100
              )}%`;
          }
        }
        if (job) {
          company = company || job.company || "";
          jobTitle = jobTitle || job.title;
          jobUrl = jobUrl || job.externalUrl;
          const clean = company.replace(/\s+hiring.*$/i, "").trim();
          company = clean || company;
          const domain =
            clean.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24) +
            ".com";
          if (!to.includes("@")) {
            const guessed = await guessEmails("Talent Team", clean);
            to =
              (typeof body.to === "string" && body.to.includes("@")
                ? body.to
                : "") ||
              guessed.find((e) =>
                /^(recruiting|talent|careers|jobs|hr)@/i.test(e)
              ) ||
              guessed[0] ||
              `recruiting@${domain}`;
          }
          toName = toName || "Hiring team";
          toRole = toRole || "Talent / Recruiting";
        }
      }

      const draft = await draftColdEmail({
        profile,
        to,
        toName,
        toRole,
        company,
        jobTitle,
        jobUrl,
        userNote,
        projectHook,
      });
      await rememberEvent({
        type: "company",
        company: draft.company,
        title: draft.jobTitle || "Cold email",
        note: `cold email draft → ${draft.to}`,
        meta: { coldEmailId: draft.id },
      });
      return NextResponse.json({ ok: true, draft, send: getSendCapability() });
    }

    if (action === "update") {
      const id = String(body.id || "");
      const draft = await updateColdEmail(id, {
        subject: body.subject != null ? String(body.subject) : undefined,
        body: body.body != null ? String(body.body) : undefined,
      });
      if (!draft) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, draft });
    }

    if (action === "copied") {
      const id = String(body.id || "");
      const draft = await updateColdEmail(id, { status: "copied" });
      if (!draft) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, draft });
    }

    if (action === "send") {
      const id = String(body.id || "");
      const draft = await sendColdEmail(
        id,
        body.from ? String(body.from) : undefined
      );
      if (draft.status === "sent") {
        await rememberEvent({
          type: "company",
          company: draft.company,
          title: draft.jobTitle || "Cold email sent",
          note: `sent → ${draft.to}`,
          meta: { coldEmailId: draft.id },
        });
      }
      return NextResponse.json({
        ok: draft.status === "sent",
        draft,
        send: getSendCapability(),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "failed" },
      { status: 400 }
    );
  }
}
