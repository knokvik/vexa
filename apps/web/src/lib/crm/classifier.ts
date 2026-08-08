/**
 * Email classifier for job-search CRM.
 * Heuristic first (stable, free); optional LLM structured refine.
 */

import type { EmailClass } from "@vexa/shared";
import { openRouterChat, getLlmCircuitStatus, getOpenRouterConfig } from "@/lib/openrouter";

export type ClassifyInput = {
  subject: string;
  bodyText: string;
  fromEmail?: string;
  fromName?: string;
};

export type ClassifyResult = {
  classification: EmailClass;
  confidence: number;
  method: "heuristic" | "llm";
  reasons: string[];
};

const RULES: Array<{
  type: EmailClass;
  weight: number;
  tests: Array<(s: string, b: string, from: string) => boolean>;
}> = [
  {
    type: "OFFER_RECEIVED",
    weight: 0.95,
    tests: [
      (s, b) =>
        /\boffer letter\b|\bexcited to offer\b|\bpleased to offer\b|\bcongratulations.{0,40}\boffer\b/i.test(
          s + " " + b
        ),
      (s, b) => /\bcompensation package\b|\bbase salary\b.{0,30}\$|\bequity package\b/i.test(b) && /\boffer\b/i.test(s + b),
    ],
  },
  {
    type: "REJECTION",
    weight: 0.92,
    tests: [
      (s, b) =>
        /\bunfortunately\b|\bnot moving forward\b|\bdecided to move forward with other\b|\bother candidates\b|\bwill not be proceeding\b|\bwon't be moving forward\b/i.test(
          s + " " + b
        ),
      (s, b) => /\bposition has been filled\b|\bno longer considering\b/i.test(b),
    ],
  },
  {
    type: "ONSITE_INVITE",
    weight: 0.9,
    tests: [
      (s, b) =>
        /\bonsite\b|\bon-site\b|\bfinal round\b|\bpanel interview\b|\bmeet the team\b|\bon.?site interview\b/i.test(
          s + " " + b
        ),
    ],
  },
  {
    type: "TECHNICAL_INVITE",
    weight: 0.88,
    tests: [
      (s, b) =>
        /\bcoding challenge\b|\btechnical assessment\b|\bsystem design\b|\btechnical interview\b|\btake.?home\b|\bhacker.?rank\b|\bcoderpad\b|\bleetcode\b/i.test(
          s + " " + b
        ),
    ],
  },
  {
    type: "SCREEN_INVITE",
    weight: 0.86,
    tests: [
      (s, b) =>
        /\bphone screen\b|\brecruiter chat\b|\bschedule a (call|chat|conversation)\b|\b15.?min\b|\b30.?minute\b|\bintro call\b|\binitial screen\b|\bcalendly\.com\b|\bschedule\.com\b/i.test(
          s + " " + b
        ),
    ],
  },
  {
    type: "APPLICATION_CONFIRMED",
    weight: 0.85,
    tests: [
      (s, b) =>
        /\breceived your application\b|\bapplication has been (received|submitted)\b|\bthanks for applying\b|\bthank you for applying\b|\bapplication confirmation\b|\bwe have received your\b/i.test(
          s + " " + b
        ),
    ],
  },
  {
    type: "RECRUITER_OUTREACH",
    weight: 0.8,
    tests: [
      (s, b, from) =>
        (/\bsaw your (profile|resume)\b|\bare you open to\b|\bopportunity at\b|\bexciting role\b|\breaching out\b|\bi came across your\b/i.test(
          s + " " + b
        ) ||
          /recruit|talent|sourc/i.test(from)) &&
        !/\breceived your application\b/i.test(s + b),
    ],
  },
  {
    type: "REFERRAL_REQUEST",
    weight: 0.82,
    tests: [
      (s, b) =>
        /\brefer(ral| me| you)\b|\breferred (you|me)\b|\bon your behalf\b/i.test(
          s + " " + b
        ),
    ],
  },
  {
    type: "FOLLOW_UP",
    weight: 0.7,
    tests: [
      (s, b) =>
        /\bchecking in\b|\bany updates?\b|\bstatus of my application\b|\bfollowing up\b|\bwondering if\b/i.test(
          s + " " + b
        ),
    ],
  },
];

export function classifyEmailHeuristic(input: ClassifyInput): ClassifyResult {
  const s = (input.subject || "").trim();
  const b = (input.bodyText || "").slice(0, 8000);
  const from = `${input.fromEmail || ""} ${input.fromName || ""}`.toLowerCase();
  const reasons: string[] = [];

  for (const rule of RULES) {
    for (const test of rule.tests) {
      if (test(s, b, from)) {
        reasons.push(`matched ${rule.type}`);
        return {
          classification: rule.type,
          confidence: rule.weight,
          method: "heuristic",
          reasons,
        };
      }
    }
  }

  // Low-priority job platform noise
  if (
    /\bunsubscribe\b|\bjob alert\b|\bweekly digest\b|\bnew jobs for you\b/i.test(
      s + b
    )
  ) {
    return {
      classification: "GENERIC",
      confidence: 0.75,
      method: "heuristic",
      reasons: ["newsletter/alert pattern"],
    };
  }

  return {
    classification: "GENERIC",
    confidence: 0.4,
    method: "heuristic",
    reasons: ["no strong pattern"],
  };
}

/** Optional LLM refine when OpenRouter is available */
export async function classifyEmail(
  input: ClassifyInput
): Promise<ClassifyResult> {
  const base = classifyEmailHeuristic(input);
  if (base.confidence >= 0.85) return base;

  const cfg = getOpenRouterConfig();
  if (!cfg.configured || getLlmCircuitStatus().open) return base;
  if (process.env.VEXA_HEURISTIC_ONLY === "true") return base;

  try {
    const result = await openRouterChat({
      role: "parse",
      maxTokens: 120,
      maxAttempts: 1,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `Classify a job-search email. Return JSON only:
{"classification":"APPLICATION_CONFIRMED|REJECTION|SCREEN_INVITE|TECHNICAL_INVITE|ONSITE_INVITE|OFFER_RECEIVED|RECRUITER_OUTREACH|REFERRAL_REQUEST|FOLLOW_UP|GENERIC","confidence":0.0-1.0,"reason":"..."}`,
        },
        {
          role: "user",
          content: `From: ${input.fromName || ""} <${input.fromEmail || ""}>\nSubject: ${input.subject}\n\n${(input.bodyText || "").slice(0, 2500)}`,
        },
      ],
    });
    const m = result.text.match(/\{[\s\S]*\}/);
    if (!m) return base;
    const parsed = JSON.parse(m[0]) as {
      classification?: EmailClass;
      confidence?: number;
      reason?: string;
    };
    const allowed: EmailClass[] = [
      "APPLICATION_CONFIRMED",
      "REJECTION",
      "SCREEN_INVITE",
      "TECHNICAL_INVITE",
      "ONSITE_INVITE",
      "OFFER_RECEIVED",
      "RECRUITER_OUTREACH",
      "REFERRAL_REQUEST",
      "FOLLOW_UP",
      "GENERIC",
    ];
    if (!parsed.classification || !allowed.includes(parsed.classification)) {
      return base;
    }
    return {
      classification: parsed.classification,
      confidence: Math.min(1, Math.max(0.5, parsed.confidence ?? 0.7)),
      method: "llm",
      reasons: [parsed.reason || "llm", ...base.reasons],
    };
  } catch {
    return base;
  }
}
