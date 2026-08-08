/**
 * Cold outreach — high leverage, low ban risk vs LinkedIn Easy Apply spam.
 * Always draft-first; send only if SMTP/Resend configured AND user confirms.
 */

import { promises as fs } from "fs";
import { openRouterChat, getLlmCircuitStatus } from "./openrouter";
import type { Profile } from "@vexa/shared";
import { dataPath } from "@/lib/data-root";

export type ColdEmailDraft = {
  id: string;
  to: string;
  toName?: string;
  toRole?: string;
  company: string;
  jobTitle?: string;
  jobUrl?: string;
  subject: string;
  body: string;
  status: "draft" | "sent" | "failed" | "copied";
  createdAt: string;
  sentAt?: string;
  error?: string;
  meta?: Record<string, unknown>;
};

const DATA_DIR = dataPath("cold-email");
const STORE = dataPath("cold-email", "drafts.json");

async function ensure() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadAll(): Promise<ColdEmailDraft[]> {
  try {
    await ensure();
    const raw = await fs.readFile(STORE, "utf8");
    return JSON.parse(raw) as ColdEmailDraft[];
  } catch {
    return [];
  }
}

async function saveAll(rows: ColdEmailDraft[]) {
  try {
    await ensure();
    await fs.writeFile(STORE, JSON.stringify(rows.slice(0, 200), null, 2), "utf8");
  } catch {
    /* ephemeral FS — drafts still returned in response */
  }
}

function heuristicDraft(input: {
  profile: Profile;
  to: string;
  toName?: string;
  toRole?: string;
  company: string;
  jobTitle?: string;
  jobUrl?: string;
  userNote?: string;
  projectHook?: string;
}): { subject: string; body: string } {
  const first = input.profile.fullName.split(" ")[0] || input.profile.fullName;
  const who = input.toName || "there";
  const roleBit = input.toRole ? ` (${input.toRole})` : "";
  const jobBit = input.jobTitle
    ? `the ${input.jobTitle} role`
    : "open roles on your team";
  const hook =
    input.projectHook ||
    input.userNote ||
    input.profile.headline ||
    "relevant experience";

  const subject = input.jobTitle
    ? `Quick note — ${input.jobTitle} @ ${input.company}`
    : `Learning from ${input.company}'s work`;

  const body = [
    `Hi ${who}${roleBit ? "" : ""},`,
    ``,
    `I'm ${first}, ${input.profile.headline || "a software engineer"}. I came across ${jobBit} at ${input.company} and wanted to reach out briefly.`,
    ``,
    `What stood out: ${hook.slice(0, 220)}.`,
    ``,
    `If you're open to it, I'd value 10–15 minutes to learn how your team approaches this — or a pointer if someone else is better to talk to. Happy to share a short portfolio note either way.`,
    ``,
    `Thanks for your time,`,
    first,
    input.profile.linkedinUrl || input.profile.githubUrl || "",
    input.jobUrl ? `\nRef: ${input.jobUrl}` : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n")
    .trim();

  return { subject, body };
}

/** Guess corporate emails (user must confirm — never auto-send). */
export async function guessEmails(
  name: string,
  company: string
): Promise<string[]> {
  // Shared free-stack patterns (person + recruiting@ aliases)
  const { patternEmails } = await import("./free-sources");
  const rows = patternEmails(name || "Talent Recruiting", company);
  return rows.map((r) => r.email).slice(0, 8);
}

export async function draftColdEmail(input: {
  profile: Profile;
  to: string;
  toName?: string;
  toRole?: string;
  company: string;
  jobTitle?: string;
  jobUrl?: string;
  userNote?: string;
  projectHook?: string;
  /** Skip company weekly cap warning (force) */
  force?: boolean;
}): Promise<ColdEmailDraft & { capWarning?: string }> {
  const to = input.to.trim();
  if (!to.includes("@")) {
    throw new Error("Valid recipient email required");
  }
  if (!input.company.trim()) {
    throw new Error("Company required");
  }

  // Per-company weekly cap (Phase 2)
  const { countCompanyOutreachLastDays } = await import("./durable/db");
  const { APPLY_TIERS } = await import("@vexa/shared");
  const recent = await countCompanyOutreachLastDays(input.company, 7);
  let capWarning: string | undefined;
  if (recent >= APPLY_TIERS.maxColdEmailsPerCompanyWeek && !input.force) {
    capWarning = `Already ${recent} outreach touchpoints to ${input.company} in ~7 days (cap ${APPLY_TIERS.maxColdEmailsPerCompanyWeek}). Confirm carefully or wait.`;
  }

  let subject: string;
  let body: string;
  let model: string | undefined;

  const base = heuristicDraft(input);

  if (
    process.env.VEXA_HEURISTIC_ONLY !== "true" &&
    !getLlmCircuitStatus().open
  ) {
    try {
      const result = await openRouterChat({
        role: "default",
        maxTokens: 350,
        maxAttempts: 1,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You write short cold outreach emails for job seekers. Rules: max 120 words body, no buzzwords, no inventing experience, specific and human, one clear low-friction ask (chat or referral pointer). Output JSON only: {\"subject\":\"...\",\"body\":\"...\"}",
          },
          {
            role: "user",
            content: JSON.stringify({
              from: {
                name: input.profile.fullName,
                headline: input.profile.headline,
                skills: input.profile.skills.slice(0, 8).map((s) => s.name),
                note: input.userNote,
              },
              to: {
                email: to,
                name: input.toName,
                role: input.toRole,
                company: input.company,
              },
              job: {
                title: input.jobTitle,
                url: input.jobUrl,
              },
              hook: input.projectHook || input.userNote,
              draft_seed: base,
            }),
          },
        ],
      });
      model = result.model;
      const m = result.text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]) as { subject?: string; body?: string };
        subject = parsed.subject || base.subject;
        body = parsed.body || base.body;
      } else {
        subject = base.subject;
        body = base.body;
      }
    } catch {
      subject = base.subject;
      body = base.body;
    }
  } else {
    subject = base.subject;
    body = base.body;
  }

  const draft: ColdEmailDraft = {
    id: `ce_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    to,
    toName: input.toName,
    toRole: input.toRole,
    company: input.company.trim(),
    jobTitle: input.jobTitle,
    jobUrl: input.jobUrl,
    subject,
    body,
    status: "draft",
    createdAt: new Date().toISOString(),
    meta: { model, source: model ? "llm" : "heuristic" },
  };

  const all = await loadAll();
  all.unshift(draft);
  await saveAll(all);

  // Schedule day-5 follow-up (surfaces in insights / due list — not auto-sent)
  try {
    const { upsertFollowUp } = await import("./durable/db");
    const when = new Date(Date.now() + 5 * 86400000).toISOString();
    await upsertFollowUp({
      outreach_id: draft.id,
      scheduled_at: when,
      sent: 0,
      company: draft.company,
      to_email: draft.to,
      subject: `Re: ${draft.subject}`,
    });
  } catch {
    /* ignore */
  }

  return { ...draft, capWarning };
}

export async function listColdEmails(limit = 40): Promise<ColdEmailDraft[]> {
  return (await loadAll()).slice(0, limit);
}

export async function getColdEmail(id: string): Promise<ColdEmailDraft | null> {
  return (await loadAll()).find((d) => d.id === id) || null;
}

export async function updateColdEmail(
  id: string,
  patch: Partial<Pick<ColdEmailDraft, "subject" | "body" | "status">>
): Promise<ColdEmailDraft | null> {
  const all = await loadAll();
  const i = all.findIndex((d) => d.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i], ...patch };
  await saveAll(all);
  return all[i];
}

export function getSendCapability(): {
  canSend: boolean;
  provider: "resend" | "smtp" | "none";
  hint: string;
} {
  if (process.env.RESEND_API_KEY?.trim()) {
    return {
      canSend: true,
      provider: "resend",
      hint: "RESEND_API_KEY set — can send after you confirm",
    };
  }
  if (process.env.SMTP_URL?.trim() || process.env.SMTP_HOST?.trim()) {
    return {
      canSend: true,
      provider: "smtp",
      hint: "SMTP configured — can send after you confirm",
    };
  }
  return {
    canSend: false,
    provider: "none",
    hint: "No mail provider. Copy the draft and send from your own inbox, or set RESEND_API_KEY / SMTP_URL.",
  };
}

/** Send only after explicit user action. Never silent. */
export async function sendColdEmail(
  id: string,
  fromEmail?: string
): Promise<ColdEmailDraft> {
  const draft = await getColdEmail(id);
  if (!draft) throw new Error("Draft not found");
  if (draft.status === "sent") return draft;

  const cap = getSendCapability();
  if (!cap.canSend) {
    throw new Error(cap.hint);
  }

  const from =
    fromEmail ||
    process.env.COLD_EMAIL_FROM?.trim() ||
    process.env.RESEND_FROM?.trim() ||
    "onboarding@resend.dev";

  try {
    if (cap.provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [draft.to],
          subject: draft.subject,
          text: draft.body,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Resend ${res.status}: ${t.slice(0, 200)}`);
      }
    } else {
      // Minimal SMTP via nodemailer not installed — use raw fetch only for resend
      // For SMTP without deps: mark as requiring RESEND for now
      throw new Error(
        "SMTP_URL set but raw SMTP client not bundled. Use RESEND_API_KEY or copy draft."
      );
    }

    const updated = await updateColdEmail(id, { status: "sent" });
    if (!updated) throw new Error("Failed to update draft");
    updated.sentAt = new Date().toISOString();
    const all = await loadAll();
    const i = all.findIndex((d) => d.id === id);
    if (i >= 0) {
      all[i] = updated;
      await saveAll(all);
    }
    return updated;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "send failed";
    const all = await loadAll();
    const i = all.findIndex((d) => d.id === id);
    if (i >= 0) {
      all[i].status = "failed";
      all[i].error = msg;
      await saveAll(all);
      return all[i];
    }
    throw e;
  }
}
