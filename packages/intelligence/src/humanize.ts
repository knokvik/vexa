import { HUMANIZATION_TARGETS } from "@vexa/shared";

export interface HumanizeResult {
  text: string;
  score: number;
  perplexityEstimate: number;
  rewrote: boolean;
  notes: string[];
}

const AI_TELLS = [
  /\bas an ai\b/i,
  /\bin today's fast-paced\b/i,
  /\bleverage\b/gi,
  /\bsynerg(?:y|ies|ize)\b/gi,
  /\bdelve into\b/gi,
  /\brobust solution\b/gi,
  /\bpassionate about\b/gi,
  /\bcutting-edge\b/gi,
  /\bseamless(ly)?\b/gi,
  /\butilize\b/gi,
];

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bleverage\b/gi, "use"],
  [/\butilize\b/gi, "use"],
  [/\bdelve into\b/gi, "explore"],
  [/\brobust solution\b/gi, "solid approach"],
  [/\bcutting-edge\b/gi, "modern"],
  [/\bseamless(ly)?\b/gi, "smooth$1"],
  [/\bin today's fast-paced world,?\s*/gi, ""],
  [/\bpassionate about\b/gi, "focused on"],
];

function sentenceLengths(text: string): number[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim().split(/\s+/).filter(Boolean).length)
    .filter((n) => n > 0);
}

/** Rough burstiness: stddev of sentence lengths (humans vary more). */
function burstiness(text: string): number {
  const lens = sentenceLengths(text);
  if (lens.length < 2) return 0;
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const variance =
    lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length;
  return Math.sqrt(variance);
}

/**
 * Heuristic humanization score (0–100).
 * Real model will use LLM rewrite + perplexity; this is MVP offline.
 */
export function estimateHumanizationScore(text: string): {
  score: number;
  perplexityEstimate: number;
  notes: string[];
} {
  const notes: string[] = [];
  let penalty = 0;

  for (const re of AI_TELLS) {
    if (re.test(text)) {
      penalty += 8;
      notes.push(`AI-ish pattern: ${re.source}`);
    }
  }

  const b = burstiness(text);
  if (b < 3) {
    penalty += 15;
    notes.push("Low sentence-length variation (low burstiness)");
  }

  const words = text.trim().split(/\s+/).length;
  const avgWordLen =
    text.replace(/\s+/g, "").length / Math.max(words, 1);
  if (avgWordLen > 6.5) {
    penalty += 10;
    notes.push("Vocabulary density looks formal/AI-like");
  }

  // Map to fake perplexity band (higher = more human-like for our product).
  const perplexityEstimate = Math.min(
    HUMANIZATION_TARGETS.perplexityMax,
    Math.max(
      HUMANIZATION_TARGETS.perplexityMin - 50,
      280 - penalty * 4 + b * 8
    )
  );

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty + b * 2)));
  return { score, perplexityEstimate, notes };
}

export function humanizeText(input: string): HumanizeResult {
  let text = input.trim();
  const before = estimateHumanizationScore(text);
  let rewrote = false;

  if (
    before.perplexityEstimate < HUMANIZATION_TARGETS.rewriteBelow ||
    before.score < 70
  ) {
    for (const [re, rep] of REPLACEMENTS) {
      if (re.test(text)) {
        text = text.replace(re, rep);
        rewrote = true;
      }
    }

    // Inject mild burstiness: split long sentences when possible.
    text = text.replace(
      /([.!?]\s+)([A-Z][^.!?]{120,}?),\s+(and|while|which)\s+/g,
      "$1$2. $3 "
    );

    // Prefer contractions for a more natural tone.
    text = text
      .replace(/\bI am\b/g, "I'm")
      .replace(/\bdo not\b/g, "don't")
      .replace(/\bcannot\b/g, "can't")
      .replace(/\bwe are\b/g, "we're");
    rewrote = true;
  }

  const after = estimateHumanizationScore(text);
  return {
    text,
    score: after.score,
    perplexityEstimate: after.perplexityEstimate,
    rewrote,
    notes: after.notes,
  };
}
