/**
 * Low-token LLM helpers. Always safe: heuristic fallback, circuit-aware.
 */

import { humanizeText, estimateHumanizationScore } from "@vexa/intelligence";
import { getLlmCircuitStatus, openRouterChat } from "./openrouter";

/** Light LLM rewrite — never blocks the draft pipeline long. */
export async function llmHumanize(
  text: string
): Promise<{
  text: string;
  score: number;
  model?: string;
  source: "llm" | "heuristic";
}> {
  const base = humanizeText(text);

  // Already good enough — save tokens
  if (base.score >= 75) {
    return { text: base.text, score: base.score, source: "heuristic" };
  }

  if (process.env.VEXA_HEURISTIC_ONLY === "true") {
    return { text: base.text, score: base.score, source: "heuristic" };
  }

  // Circuit open (free-tier storm) — skip network
  if (getLlmCircuitStatus().open) {
    return { text: base.text, score: base.score, source: "heuristic" };
  }

  const slice = text.slice(0, 500);

  try {
    const result = await openRouterChat({
      role: "humanize",
      maxTokens: 100,
      maxAttempts: 1, // one try only — fall back to heuristic fast
      temperature: 0.35,
      model: process.env.OPENROUTER_MODEL?.trim(),
      messages: [
        {
          role: "system",
          content:
            "Rewrite resume text to sound natural and human. No buzzwords. Keep facts. Output ONLY the rewritten text.",
        },
        { role: "user", content: slice },
      ],
    });

    const rewritten =
      text.length > 500 ? result.text + text.slice(500) : result.text;
    const cleaned = humanizeText(rewritten);
    const score = estimateHumanizationScore(cleaned.text).score;
    return {
      text: cleaned.text,
      score,
      model: result.model,
      source: "llm",
    };
  } catch {
    return { text: base.text, score: base.score, source: "heuristic" };
  }
}

/** Tiny LLM note — skipped when circuit open or high shortlist. */
export async function llmShortlistNote(
  jobTitle: string,
  company: string,
  probability: number
): Promise<string | undefined> {
  if (probability >= 0.85) return undefined;
  if (process.env.VEXA_HEURISTIC_ONLY === "true") return undefined;
  if (getLlmCircuitStatus().open) return undefined;

  try {
    const result = await openRouterChat({
      role: "shortlist",
      maxTokens: 30,
      maxAttempts: 1,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: `One short sentence (max 12 words) for applying to ${jobTitle} at ${company}.`,
        },
      ],
    });
    return result.text;
  } catch {
    return undefined;
  }
}
