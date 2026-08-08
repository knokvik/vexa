/**
 * Email ingestion pipeline:
 * INBOX → classify → extract → company/job/contact/application → actions
 * Never auto-applies. Never auto-sends.
 */

import type {
  ContactRoleType,
  CrmEmail,
  EmailClass,
  ApplicationSource,
} from "@vexa/shared";
import { classifyEmail } from "./classifier";
import { extractEntities } from "./extractor";
import { mergeStage, stageFromClassification, isClosedStage } from "./pipeline";
import {
  upsertCompany,
  upsertContact,
  upsertCrmJob,
  upsertApplication,
  insertEmail,
  upsertEvent,
  upsertAction,
  newId,
  listApplications,
  loadCrm,
} from "./db";
import { eventTypeForStage } from "./actions";

export type IngestEmailInput = {
  subject: string;
  bodyText: string;
  fromEmail?: string;
  fromName?: string;
  toEmail?: string;
  receivedAt?: string;
  messageId?: string;
  threadId?: string;
  /** Force classification (tests) */
  forceClass?: EmailClass;
};

export type IngestResult = {
  ok: true;
  email: CrmEmail;
  classification: EmailClass;
  companyId?: string;
  contactId?: string;
  jobId?: string;
  applicationId?: string;
  stage?: string;
  actionsCreated: string[];
  notes: string[];
};

function roleFromClass(c: EmailClass): ContactRoleType {
  if (c === "RECRUITER_OUTREACH" || c === "SCREEN_INVITE") return "recruiter";
  if (c === "TECHNICAL_INVITE" || c === "ONSITE_INVITE") return "interviewer";
  if (c === "OFFER_RECEIVED") return "hr";
  if (c === "REFERRAL_REQUEST") return "referral";
  return "other";
}

function sourceFromClass(c: EmailClass): ApplicationSource {
  if (c === "RECRUITER_OUTREACH") return "recruiter_outreach";
  if (c === "REFERRAL_REQUEST") return "referral";
  return "email";
}

function daysFromNow(n: number) {
  return new Date(Date.now() + n * 86400000).toISOString();
}

export async function ingestEmail(
  input: IngestEmailInput
): Promise<IngestResult> {
  const notes: string[] = [];
  const actionsCreated: string[] = [];
  const receivedAt = input.receivedAt || new Date().toISOString();

  // Dedup by messageId
  if (input.messageId) {
    const db = await loadCrm();
    const existing = db.emails.find((e) => e.messageId === input.messageId);
    if (existing) {
      return {
        ok: true,
        email: existing,
        classification: existing.classification,
        companyId: existing.companyId,
        contactId: existing.contactId,
        jobId: existing.jobId,
        applicationId: existing.applicationId,
        stage: undefined,
        actionsCreated: [],
        notes: ["duplicate messageId — skipped"],
      };
    }
  }

  const classified = input.forceClass
    ? {
        classification: input.forceClass,
        confidence: 1,
        method: "heuristic" as const,
        reasons: ["forced"],
      }
    : await classifyEmail({
        subject: input.subject,
        bodyText: input.bodyText,
        fromEmail: input.fromEmail,
        fromName: input.fromName,
      });

  const entities = extractEntities({
    subject: input.subject,
    bodyText: input.bodyText,
    fromEmail: input.fromEmail,
    fromName: input.fromName,
    classification: classified.classification,
  });

  notes.push(
    `class=${classified.classification} (${classified.method} ${Math.round(classified.confidence * 100)}%)`
  );

  let companyId: string | undefined;
  let contactId: string | undefined;
  let jobId: string | undefined;
  let applicationId: string | undefined;
  let stage: string | undefined;

  const companyName = entities.companyName;
  if (companyName) {
    const company = await upsertCompany({
      name: companyName,
      domain: entities.domain,
    });
    companyId = company.id;
    notes.push(`company=${company.name}`);
  }

  if (entities.contactEmail) {
    const contact = await upsertContact({
      name: entities.contactName || entities.contactEmail,
      email: entities.contactEmail,
      companyId,
      companyName: companyName,
      roleType: roleFromClass(classified.classification),
      strength:
        classified.classification === "RECRUITER_OUTREACH" ? 2 : 1,
    });
    contactId = contact.id;
    notes.push(`contact=${contact.email}`);
  }

  const jobTitle =
    entities.jobTitle ||
    (classified.classification === "RECRUITER_OUTREACH"
      ? "Opportunity (from outreach)"
      : classified.classification !== "GENERIC"
        ? "Role (from email)"
        : undefined);

  if (companyId && companyName && jobTitle) {
    const job = await upsertCrmJob({
      companyId,
      companyName,
      title: jobTitle,
      salaryRange: entities.salaryHint,
    });
    jobId = job.id;
    notes.push(`job=${job.title}`);
  }

  const targetStage = stageFromClassification(classified.classification);

  // Link to existing app at company if no job yet
  if (companyId && !jobId && targetStage) {
    const apps = await listApplications();
    const open = apps.find(
      (a) => a.companyId === companyId && a.status === "active"
    );
    if (open) {
      jobId = open.jobId;
      applicationId = open.id;
    }
  }

  if (companyId && companyName && jobId && jobTitle && targetStage) {
    const apps = await listApplications();
    const existing = apps.find(
      (a) => a.jobId === jobId && a.status === "active"
    );
    const nextStage = mergeStage(existing?.stage, targetStage);
    const appliedAt =
      nextStage === "applied" || nextStage === "screen"
        ? existing?.appliedAt || receivedAt
        : existing?.appliedAt;

    const app = await upsertApplication({
      id: existing?.id,
      jobId,
      companyId,
      companyName,
      jobTitle,
      stage: nextStage,
      appliedAt,
      lastTouchAt: receivedAt,
      source: existing?.source || sourceFromClass(classified.classification),
      status: isClosedStage(nextStage) ? "closed" : "active",
      rejectionReason:
        classified.classification === "REJECTION"
          ? "From email (see thread)"
          : existing?.rejectionReason,
      contactIds: contactId ? [contactId] : [],
      emailIds: [],
    });
    applicationId = app.id;
    stage = app.stage;
    notes.push(`application stage=${app.stage}`);

    // Events from invites
    const evType = eventTypeForStage(nextStage);
    if (
      evType &&
      ["SCREEN_INVITE", "TECHNICAL_INVITE", "ONSITE_INVITE", "OFFER_RECEIVED"].includes(
        classified.classification
      )
    ) {
      const when =
        entities.dates[0] && !/tomorrow|today|next/i.test(entities.dates[0])
          ? tryParseDate(entities.dates[0])
          : classified.classification === "OFFER_RECEIVED"
            ? daysFromNow(5)
            : daysFromNow(
                classified.classification === "TECHNICAL_INVITE" ? 3 : 2
              );

      const ev = await upsertEvent({
        type: evType,
        title: `${STAGE_TITLE[nextStage] || nextStage}: ${jobTitle} @ ${companyName}`,
        datetime: when,
        applicationId: app.id,
        companyId,
        contactIds: contactId ? [contactId] : [],
        prepNotes:
          entities.calendarLinks[0]
            ? `Schedule: ${entities.calendarLinks[0]}`
            : entities.dates.join(", ") || undefined,
      });
      notes.push(`event=${ev.title}`);

      if (classified.classification === "TECHNICAL_INVITE") {
        const act = await upsertAction({
          kind: "prep",
          title: `Coding prep for ${companyName}`,
          detail: "72h challenge window — review system design + role stack.",
          dueAt: daysFromNow(3),
          applicationId: app.id,
          companyId,
          priority: "high",
        });
        actionsCreated.push(act.id);
      }

      if (classified.classification === "OFFER_RECEIVED") {
        const act = await upsertAction({
          kind: "decide_offer",
          title: `Offer decision: ${companyName}`,
          detail: entities.salaryHint
            ? `Salary hint: ${entities.salaryHint}`
            : "Review offer letter; 5-day decision timer.",
          dueAt: daysFromNow(5),
          applicationId: app.id,
          companyId,
          priority: "high",
        });
        actionsCreated.push(act.id);
      }

      if (
        classified.classification === "SCREEN_INVITE" ||
        classified.classification === "ONSITE_INVITE"
      ) {
        const act = await upsertAction({
          kind: "schedule",
          title: `Confirm interview time — ${companyName}`,
          detail: entities.calendarLinks[0] || "Pick a slot and reply.",
          dueAt: daysFromNow(1),
          applicationId: app.id,
          companyId,
          contactId,
          priority: "high",
        });
        actionsCreated.push(act.id);
      }
    }

    if (classified.classification === "REJECTION") {
      const act = await upsertAction({
        kind: "log_rejection",
        title: `Log rejection reason — ${companyName}`,
        detail: "skills fit / visa / experience / other?",
        applicationId: app.id,
        companyId,
        priority: "low",
      });
      actionsCreated.push(act.id);
    }
  } else if (
    companyId &&
    companyName &&
    classified.classification === "RECRUITER_OUTREACH" &&
    jobTitle
  ) {
    // Wishlist job without confirmed application
    const job = await upsertCrmJob({
      companyId,
      companyName,
      title: jobTitle,
      salaryRange: entities.salaryHint,
    });
    jobId = job.id;
    const app = await upsertApplication({
      jobId: job.id,
      companyId,
      companyName,
      jobTitle,
      stage: "wishlist",
      lastTouchAt: receivedAt,
      source: "recruiter_outreach",
      status: "active",
      contactIds: contactId ? [contactId] : [],
    });
    applicationId = app.id;
    stage = "wishlist";
    notes.push("wishlist from recruiter outreach");
  }

  if (classified.classification === "FOLLOW_UP" && applicationId) {
    const act = await upsertAction({
      kind: "reply",
      title: "Reply to follow-up thread",
      detail: "Suggest a short status check template.",
      applicationId,
      companyId,
      contactId,
      priority: "medium",
    });
    actionsCreated.push(act.id);
  }

  const emailId = newId("em");
  const email: CrmEmail = {
    id: emailId,
    messageId: input.messageId,
    threadId: input.threadId || input.messageId,
    fromEmail: (input.fromEmail || "unknown@unknown").toLowerCase(),
    fromName: input.fromName || entities.contactName,
    toEmail: input.toEmail,
    subject: input.subject || "(no subject)",
    bodyText: (input.bodyText || "").slice(0, 20000),
    receivedAt,
    classification: classified.classification,
    classificationConfidence: classified.confidence,
    companyId,
    contactId,
    jobId,
    applicationId,
    extracted: {
      companyName: entities.companyName,
      jobTitle: entities.jobTitle,
      dates: entities.dates,
      salaryHint: entities.salaryHint,
      calendarLinks: entities.calendarLinks,
      sentiment: entities.sentiment,
    },
    createdAt: new Date().toISOString(),
  };

  await insertEmail(email);

  // Attach email id to application
  if (applicationId && jobId && companyId && companyName && jobTitle && stage) {
    await upsertApplication({
      id: applicationId,
      jobId,
      companyId,
      companyName,
      jobTitle,
      stage: stage as import("@vexa/shared").PipelineStage,
      emailIds: [emailId],
      lastTouchAt: receivedAt,
    });
  }

  return {
    ok: true,
    email,
    classification: classified.classification,
    companyId,
    contactId,
    jobId,
    applicationId,
    stage,
    actionsCreated,
    notes,
  };
}

const STAGE_TITLE: Record<string, string> = {
  screen: "Phone screen",
  technical: "Technical",
  onsite: "Onsite",
  offer: "Offer deadline",
};

function tryParseDate(raw: string): string | undefined {
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  return undefined;
}

/** Batch paste: split on common forward separators */
export async function ingestEmailBatch(
  raw: string
): Promise<{ results: IngestResult[]; count: number }> {
  const chunks = splitEmails(raw);
  const results: IngestResult[] = [];
  for (const chunk of chunks) {
    const parsed = parsePastedEmail(chunk);
    results.push(await ingestEmail(parsed));
  }
  return { results, count: results.length };
}

function splitEmails(raw: string): string[] {
  const parts = raw
    .split(
      /\n(?=From:\s)|(?=^-{3,}\s*Forwarded message\s*-{3,})|(?=^-{3,}\s*Original Message\s*-{3,})/im
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  return parts.length ? parts : [raw.trim()];
}

export function parsePastedEmail(text: string): IngestEmailInput {
  const fromLine = text.match(/^From:\s*(?:"?([^"<]*)"?\s*)?<?([^\s>]+@[^>\s]+)>?/im);
  const subjectLine = text.match(/^Subject:\s*(.+)$/im);
  const dateLine = text.match(/^Date:\s*(.+)$/im);
  const toLine = text.match(/^To:\s*.*?<?([^\s>]+@[^\s>]+)>?/im);

  let body = text;
  // strip headers block if present
  const headerEnd = text.search(/\n\n/);
  if (headerEnd > 0 && /^(From|Subject|Date|To):/im.test(text.slice(0, 200))) {
    body = text.slice(headerEnd).trim();
  }

  return {
    fromName: fromLine?.[1]?.trim() || undefined,
    fromEmail: fromLine?.[2]?.trim() || undefined,
    subject: subjectLine?.[1]?.trim() || text.split("\n")[0]?.slice(0, 120) || "Email",
    bodyText: body,
    toEmail: toLine?.[1]?.trim(),
    receivedAt: dateLine?.[1] ? tryParseDate(dateLine[1]) : undefined,
    messageId: `paste_${hash(text.slice(0, 500))}`,
  };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}
