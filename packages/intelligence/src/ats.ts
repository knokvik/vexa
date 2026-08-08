/**
 * Hybrid ATS simulator (Gen1 keyword + Gen3 semantic proxy + structured).
 * Weights aligned with research study:
 *   keyword 0.30 · semantic 0.40 · structured 0.20 · format 0.10
 * Target "good" threshold: 70%+
 */

import type { JobListing, Profile, ResumeContent } from "@vexa/shared";

export interface AtsReport {
  overallScore: number;
  keywordMatchScore: number;
  semanticScore: number;
  formatScore: number;
  experienceScore: number;
  /** Structured attributes (years, education proxy, skill graph) */
  structuredScore: number;
  missingKeywords: string[];
  matchedKeywords: string[];
  suggestions: string[];
  /** Explainability breakdown for UI */
  explain?: {
    weights: { keyword: number; semantic: number; structured: number; format: number };
    thresholdGood: number;
  };
}

export type MatchPriority =
  | "apply_first"
  | "strong"
  | "review"
  | "stretch"
  | "skip";

export interface ProfileJobMatch {
  matchPercent: number;
  ats: AtsReport;
  shortlistProbability: number;
  priority: MatchPriority;
  priorityLabel: string;
  suggestion: string;
  matchedSkills: string[];
  missingSkills: string[];
}

const WEIGHTS = {
  keyword: 0.3,
  semantic: 0.4,
  structured: 0.2,
  format: 0.1,
} as const;

const GOOD_THRESHOLD = 70;

/** Simple skill synonym graph (ontology lite) */
const SYNONYMS: Record<string, string[]> = {
  javascript: ["js", "ecmascript", "nodejs", "node"],
  typescript: ["ts"],
  react: ["reactjs", "react.js", "nextjs", "next.js"],
  "node.js": ["nodejs", "node", "express"],
  python: ["django", "flask", "fastapi"],
  aws: ["amazon web services", "s3", "ec2", "lambda"],
  kubernetes: ["k8s"],
  postgres: ["postgresql", "psql", "sql"],
  ml: ["machine learning", "tensorflow", "pytorch"],
  graphql: ["gql"],
};

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

function expandToken(t: string): string[] {
  const out = new Set<string>([t]);
  for (const [canon, alts] of Object.entries(SYNONYMS)) {
    if (t === canon || alts.includes(t)) {
      out.add(canon);
      alts.forEach((a) => out.add(a));
    }
  }
  return [...out];
}

function tokenSet(text: string): Set<string> {
  const raw = tokenize(text);
  const s = new Set<string>();
  for (const t of raw) {
    for (const e of expandToken(t)) s.add(e);
  }
  return s;
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

function profileToText(profile: Profile): string {
  return [
    profile.fullName,
    profile.headline,
    profile.summary,
    ...profile.skills.map((s) => s.name),
    ...profile.experiences.flatMap((e) => [
      e.title,
      e.company,
      e.description,
      ...(e.achievements || []),
    ]),
    ...profile.interests,
  ]
    .filter(Boolean)
    .join(" ");
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Hybrid ATS score — lexical + semantic proxy + structured + format.
 */
export function scoreAts(
  resume: ResumeContent | string,
  job: Pick<
    JobListing,
    "description" | "skillsRequired" | "requirements" | "title" | "experienceLevel"
  >
): AtsReport {
  const resumeText =
    typeof resume === "string" ? resume : resumeToText(resume);
  const resumeTokens = tokenSet(resumeText);

  const jobSkillSource =
    job.skillsRequired.length > 0
      ? job.skillsRequired.join(" ")
      : [job.title, ...job.requirements, job.description].join(" ");

  const skillKeywords = unique(
    tokenize(jobSkillSource).filter((w) => w.length > 2)
  ).slice(0, 50);

  const expandedSkills = unique(skillKeywords.flatMap(expandToken));

  const matched = expandedSkills.filter((k) => resumeTokens.has(k));
  // Prefer original skill surface forms for missing list
  const missing = skillKeywords
    .filter((k) => !expandToken(k).some((e) => resumeTokens.has(e)))
    .slice(0, 15);

  const keywordMatchScore =
    skillKeywords.length === 0
      ? 55
      : Math.round(
          (matched.filter((m) => skillKeywords.includes(m) || true).length /
            Math.max(skillKeywords.length, 1)) *
            // count unique skill roots matched
            (skillKeywords.filter((k) =>
              expandToken(k).some((e) => resumeTokens.has(e))
            ).length /
              skillKeywords.length) *
            100
        );

  const keywordScoreClamped = Math.min(
    100,
    Math.round(
      skillKeywords.length === 0
        ? 55
        : (skillKeywords.filter((k) =>
            expandToken(k).some((e) => resumeTokens.has(e))
          ).length /
            skillKeywords.length) *
            100
    )
  );

  // Semantic proxy: Jaccard on expanded token bags (Gen3 stand-in without embeddings)
  const jobBag = tokenSet(
    [job.title, job.description, ...job.requirements, ...job.skillsRequired].join(
      " "
    )
  );
  const semanticScore = Math.round(jaccard(resumeTokens, jobBag) * 100);

  // Format compliance (ATS-friendly: single column, sections, contact, no tables)
  let formatScore = 94;
  if (typeof resume !== "string") {
    if (resume.sections.length < 2) formatScore -= 25;
    if (!resume.contact.email && !resume.contact.phone && !resume.fullName)
      formatScore -= 12;
    else if (!resume.contact.email && !resume.contact.phone) formatScore -= 4;
    const types = new Set(resume.sections.map((s) => s.type));
    if (!types.has("experience")) formatScore -= 15;
    if (!types.has("skills") && !types.has("additional")) formatScore -= 8;
    if (types.has("education")) formatScore += 2;
    // Known Ivy/ATS template ids get a small boost
    const tid = resume.templateId || "";
    if (
      /tpl-(harvard|princeton|yale|mit|penn|modern|classic|technical)/.test(
        tid
      )
    ) {
      formatScore += 3;
    }
  }
  // Tables / multi-column artifacts hurt ATS parsers
  if (/┌|┐|│{2,}|\t{2,}/.test(resumeText)) formatScore -= 20;
  // penalize keyword stuffing signal (unnatural density)
  const density =
    resumeText.length > 0
      ? skillKeywords.filter((k) =>
          resumeText.toLowerCase().includes(k)
        ).length / Math.max(resumeText.split(/\s+/).length / 50, 1)
      : 0;
  if (density > 8) formatScore -= 15;
  formatScore = Math.max(0, Math.min(100, formatScore));

  // Structured: metrics + experience alignment
  const hasMetrics = /\d+%|\$\d+|x\d+|\d+\+?\s*(years|yrs)/i.test(resumeText);
  let experienceScore = hasMetrics ? 80 : 55;
  const yearsMention =
    resumeText.match(/(\d+)\+?\s*(years|yrs)/i) ||
    null;
  const years = yearsMention ? Number(yearsMention[1]) : undefined;
  const levelNeed: Record<string, number> = {
    entry: 0,
    mid: 3,
    senior: 5,
    executive: 10,
    unknown: 2,
  };
  const need = levelNeed[job.experienceLevel || "unknown"] ?? 2;
  if (years !== undefined) {
    if (years >= need) experienceScore = Math.min(100, experienceScore + 15);
    else if (years >= need - 1) experienceScore = Math.min(100, experienceScore + 5);
    else experienceScore = Math.max(30, experienceScore - 15);
  }

  const structuredScore = Math.round(
    experienceScore * 0.7 + (hasMetrics ? 30 : 10)
  );

  const overallScore = Math.min(
    100,
    Math.round(
      keywordScoreClamped * WEIGHTS.keyword +
        semanticScore * WEIGHTS.semantic +
        structuredScore * WEIGHTS.structured +
        formatScore * WEIGHTS.format
    )
  );

  const matchedSkillRoots = skillKeywords.filter((k) =>
    expandToken(k).some((e) => resumeTokens.has(e))
  );

  const suggestions: string[] = [];
  if (missing.length) {
    suggestions.push(
      `Add naturally (do not invent): ${missing.slice(0, 5).join(", ")}`
    );
  }
  if (!hasMetrics) {
    suggestions.push("Add quantified achievements (%, $, time saved).");
  }
  if (keywordScoreClamped < 60) {
    suggestions.push("Mirror exact phrasing from the job description in summary/skills.");
  }
  if (overallScore < GOOD_THRESHOLD) {
    suggestions.push(
      `Score is below ${GOOD_THRESHOLD}% — prioritize missing must-have skills before apply.`
    );
  }
  if (density > 6) {
    suggestions.push("Avoid keyword stuffing — weave skills into real bullets.");
  }

  return {
    overallScore,
    keywordMatchScore: keywordScoreClamped,
    semanticScore,
    formatScore,
    experienceScore,
    structuredScore,
    missingKeywords: missing,
    matchedKeywords: matchedSkillRoots,
    suggestions,
    explain: {
      weights: { ...WEIGHTS },
      thresholdGood: GOOD_THRESHOLD,
    },
  };
}

function priorityFromScores(
  matchPercent: number,
  shortlist: number
): { priority: MatchPriority; priorityLabel: string; suggestion: string } {
  const s = shortlist * 100;
  if (matchPercent >= 85 && s >= 80) {
    return {
      priority: "apply_first",
      priorityLabel: "Apply first",
      suggestion: "Strong ATS + skill fit — prioritize this application.",
    };
  }
  if (matchPercent >= 70 && s >= 65) {
    return {
      priority: "strong",
      priorityLabel: "Strong match",
      suggestion: "Good match. Tailor bullets to JD keywords then apply.",
    };
  }
  if (matchPercent >= 55) {
    return {
      priority: "review",
      priorityLabel: "Review gaps",
      suggestion: "Solid base but missing keywords — fill gaps before apply.",
    };
  }
  if (matchPercent >= 40) {
    return {
      priority: "stretch",
      priorityLabel: "Stretch",
      suggestion: "Stretch role. Only apply if you can honestly cover gaps.",
    };
  }
  return {
    priority: "skip",
    priorityLabel: "Low fit",
    suggestion: "Low overlap — better to skip and protect response rate.",
  };
}

/**
 * Fast card match: profile vs job without full resume generation.
 */
export function matchProfileToJob(
  profile: Profile,
  job: JobListing
): ProfileJobMatch {
  const text = profileToText(profile);
  const ats = scoreAts(text, job);

  // Shortlist-lite
  const profileSkills = new Set(profile.skills.map((s) => s.name.toLowerCase()));
  const required = (job.skillsRequired || []).map((s) => s.toLowerCase());
  const skillHits =
    required.length === 0
      ? 0.65
      : required.filter((s) =>
          [...profileSkills].some((p) => p.includes(s) || s.includes(p))
        ).length / required.length;

  const years = profile.yearsExperience ?? 0;
  const levelNeed: Record<string, number> = {
    entry: 0,
    mid: 3,
    senior: 5,
    executive: 10,
    unknown: 2,
  };
  const need = levelNeed[job.experienceLevel || "unknown"] ?? 2;
  const expRatio = need === 0 ? 1 : Math.min(1, years / need);

  const shortlistProbability = Math.max(
    0,
    Math.min(
      1,
      skillHits * 0.4 +
        (ats.overallScore / 100) * 0.35 +
        expRatio * 0.15 +
        (job.location?.remote ? 0.1 : 0.05)
    )
  );

  const matchPercent = ats.overallScore;
  const { priority, priorityLabel, suggestion } = priorityFromScores(
    matchPercent,
    shortlistProbability
  );

  return {
    matchPercent,
    ats,
    shortlistProbability,
    priority,
    priorityLabel,
    suggestion,
    matchedSkills: ats.matchedKeywords.slice(0, 8),
    missingSkills: ats.missingKeywords.slice(0, 8),
  };
}
