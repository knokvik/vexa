/**
 * Low-token LLM helpers for humanize + short notes.
 * Falls back to local heuristics if all free models fail.
 */

import { humanizeText, estimateHumanizationScore } from "@vexa/intelligence";
import { openRouterChat } from "./openrouter";

/** Light LLM rewrite — short prompt, capped tokens */
export async function llmHumanize(
  text: string
): Promise<{ text: string; score: number; model?: string; source: "llm" | "heuristic" }> {
  const base = humanizeText(text);

  // Skip LLM if already decent (saves tokens)
  if (base.score >= 78 && !base.rewrote) {
    return { text: base.text, score: base.score, source: "heuristic" };
  }

  // Only send a short slice to the model
  const slice = text.slice(0, 600);

  // Skip network LLM if disabled or to save quota during free-tier storms
  if (process.env.VEXA_HEURISTIC_ONLY === "true") {
    return { text: base.text, score: base.score, source: "heuristic" };
  }

  try {
    const result = await openRouterChat({
      role: "humanize",
      maxTokens: 120,
      temperature: 0.4,
      // Prefer one fast free model first to avoid 5× timeouts
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
      text.length > 600
        ? result.text + text.slice(600)
        : result.text;

    // Clean + score with local heuristics
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

/** Tiny LLM assist for shortlist blurb — optional, max 40 tokens */
export async function llmShortlistNote(
  jobTitle: string,
  company: string,
  probability: number
): Promise<string | undefined> {
  try {
    const result = await openRouterChat({
      role: "shortlist",
      maxTokens: 40,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: `One short sentence advice for applying to ${jobTitle} at ${company} (shortlist ~${Math.round(probability * 100)}%). Max 15 words.`,
        },
      ],
    });
    return result.text;
  } catch {
    return undefined;
  }
}
