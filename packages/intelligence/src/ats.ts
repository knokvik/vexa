import type { JobListing, ResumeContent } from "@vexa/shared";

export interface AtsReport {
  overallScore: number;
  keywordMatchScore: number;
  semanticScore: number;
  formatScore: number;
  experienceScore: number;
  missingKeywords: string[];
  matchedKeywords: string[];
  suggestions: string[];
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s,/|]+/)
    .filter((t) => t.length > 1);
}

function unique(words: string[]): string[] {
  return [...new Set(words)];
}

function resumeToText(content: ResumeContent): string {
  const parts: string[] = [
    content.fullName,
    content.headline ?? "",
    ...content.sections.flatMap((s) =>
      Array.isArray(s.content) ? s.content : [s.content]
    ),
  ];
  return parts.join(" ");
}

/**
 * Lightweight ATS scorer — keyword overlap + simple format checks.
 * Weighted formula from product plan.
 */
export function scoreAts(
  resume: ResumeContent | string,
  job: Pick<JobListing, "description" | "skillsRequired" | "requirements" | "title">
): AtsReport {
  const resumeText =
    typeof resume === "string" ? resume : resumeToText(resume);
  const resumeTokens = new Set(tokenize(resumeText));

  const jobKeywordSource = [
    job.title,
    ...job.skillsRequired,
    ...job.requirements,
    job.description,
  ].join(" ");

  const jobKeywords = unique(
    tokenize(jobKeywordSource).filter((w) => w.length > 2)
  );

  // Prefer skills list when present.
  const skillKeywords =
    job.skillsRequired.length > 0
      ? unique(job.skillsRequired.flatMap(tokenize))
      : jobKeywords.slice(0, 40);

  const matched = skillKeywords.filter((k) => resumeTokens.has(k));
  const missing = skillKeywords.filter((k) => !resumeTokens.has(k)).slice(0, 15);

  const keywordMatchScore =
    skillKeywords.length === 0
      ? 50
      : Math.round((matched.length / skillKeywords.length) * 100);

  // Semantic proxy: Jaccard on broader token sets.
  const jobSet = new Set(jobKeywords);
  const inter = [...resumeTokens].filter((t) => jobSet.has(t)).length;
  const union = new Set([...resumeTokens, ...jobSet]).size;
  const semanticScore = union === 0 ? 0 : Math.round((inter / union) * 100);

  // Format: assume our generator is ATS-friendly; penalize empty sections.
  let formatScore = 90;
  if (typeof resume !== "string") {
    if (resume.sections.length < 2) formatScore -= 20;
    if (!resume.contact.email) formatScore -= 10;
  }

  // Experience: presence of numbers/metrics.
  const hasMetrics = /\d+%|\$\d+|x\d+|\d+\+?\s*(years|yrs)/i.test(resumeText);
  const experienceScore = hasMetrics ? 85 : 60;

  const overallScore = Math.round(
    keywordMatchScore * 0.35 +
      semanticScore * 0.25 +
      formatScore * 0.2 +
      experienceScore * 0.15 +
      50 * 0.05
  );

  const suggestions: string[] = [];
  if (missing.length) {
    suggestions.push(
      `Weave in naturally: ${missing.slice(0, 5).join(", ")}`
    );
  }
  if (!hasMetrics) {
    suggestions.push("Add quantified achievements (%, $, time saved).");
  }
  if (keywordMatchScore < 60) {
    suggestions.push("Mirror language from the job description more closely.");
  }

  return {
    overallScore: Math.min(100, overallScore),
    keywordMatchScore,
    semanticScore,
    formatScore,
    experienceScore,
    missingKeywords: missing,
    matchedKeywords: matched,
    suggestions,
  };
}
