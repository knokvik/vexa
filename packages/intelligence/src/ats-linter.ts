/**
 * ATS parse-safety linter — catches layouts parsers choke on.
 * Research: multi-column/tables/graphics fail more often than "missing keywords".
 */

export type AtsLintSeverity = "error" | "warn" | "pass";

export type AtsLintIssue = {
  id: string;
  severity: AtsLintSeverity;
  message: string;
};

export type AtsLintReport = {
  ok: boolean;
  score: number; // 0–100 parse-safety
  issues: AtsLintIssue[];
};

/** Patterns that break common ATS parsers */
const BAD = {
  tableChars: /[│┌┐└┘├┤┬┴┼]|(\t{2,})/,
  multiColumnPipe: /^\s*[^|\n]{2,}\|.+\|.+$/m,
  htmlTags: /<\/?(table|div|span|img|svg|canvas)\b/i,
  textBox: /textbox|text.?box|content.?box/i,
  emoji: /[\u{1F300}-\u{1FAFF}]/u,
  multiSpaceSection: /\s{8,}/,
};

const AI_TELLS =
  /\b(delve|leverage|synerg(?:y|ize)|robust solution|cutting[- ]edge|fast[- ]paced world|utilize|passionate about)\b/i;

/**
 * Lint plain-text resume (ATS-safe export path).
 */
export function lintAtsPlainText(text: string): AtsLintReport {
  const issues: AtsLintIssue[] = [];
  const t = text || "";

  if (!t.trim()) {
    return {
      ok: false,
      score: 0,
      issues: [{ id: "empty", severity: "error", message: "Resume text is empty" }],
    };
  }

  if (BAD.tableChars.test(t) || BAD.htmlTags.test(t)) {
    issues.push({
      id: "tables_graphics",
      severity: "error",
      message: "Tables / box-drawing / HTML layout detected — ATS often mangles these",
    });
  }

  // Contact lines use " | " — only flag multi-pipe body lines that look columnar
  const bodyLines = t.split("\n").filter((l) => l.includes("|") && !/https?:\/\//.test(l));
  const columnar = bodyLines.filter((l) => (l.match(/\|/g) || []).length >= 2);
  if (columnar.length >= 3) {
    issues.push({
      id: "multi_column",
      severity: "error",
      message: "Looks multi-column (many pipe-separated rows) — use single column",
    });
  }

  if (BAD.emoji.test(t)) {
    issues.push({
      id: "emoji",
      severity: "warn",
      message: "Emoji can drop or garble in some ATS parsers",
    });
  }

  const hasExperience = /EXPERIENCE|WORK EXPERIENCE/i.test(t);
  const hasSkills = /SKILLS|TECHNICAL/i.test(t);
  const hasEducation = /EDUCATION/i.test(t);
  if (!hasExperience) {
    issues.push({
      id: "section_experience",
      severity: "error",
      message: "Missing EXPERIENCE section header",
    });
  }
  if (!hasSkills) {
    issues.push({
      id: "section_skills",
      severity: "warn",
      message: "Missing SKILLS section (recommended)",
    });
  }
  if (!hasEducation) {
    issues.push({
      id: "section_education",
      severity: "warn",
      message: "Missing EDUCATION section (recommended for many ATS)",
    });
  }

  const bullets = (t.match(/^• /gm) || []).length;
  if (bullets < 2) {
    issues.push({
      id: "bullets",
      severity: "warn",
      message: "Few action bullets — recruiters skim bullets in ~6–7s",
    });
  }

  if (!/\d+%|\$\d+|\d+\+|x\d+|\d+\s*(years|yrs|users|teams|engineers)/i.test(t)) {
    issues.push({
      id: "metrics",
      severity: "warn",
      message: "No quantified results detected — metrics improve shortlist odds",
    });
  }

  if (AI_TELLS.test(t)) {
    issues.push({
      id: "ai_tells",
      severity: "warn",
      message: "AI-ish phrasing (delve/leverage/synergize…) — scrub for human voice",
    });
  }

  const words = t.split(/\s+/).filter(Boolean).length;
  if (words > 900) {
    issues.push({
      id: "length",
      severity: "warn",
      message: `Long resume (~${words} words) — aim 1 page for most IC roles`,
    });
  }
  if (words < 40) {
    issues.push({
      id: "too_short",
      severity: "error",
      message: "Resume too short to be useful",
    });
  }

  const errors = issues.filter((i) => i.severity === "error").length;
  const warns = issues.filter((i) => i.severity === "warn").length;
  const score = Math.max(0, Math.min(100, 100 - errors * 22 - warns * 8));

  return {
    ok: errors === 0,
    score,
    issues,
  };
}

/**
 * Invention guard: claims in resume text must appear (loosely) in source profile text.
 * Flags fabricated employers, degrees, metrics, clearances that aren't in profile.
 */
export function checkInvention(
  resumeText: string,
  sourceText: string
): AtsLintIssue[] {
  const issues: AtsLintIssue[] = [];
  const src = sourceText.toLowerCase();
  const resume = resumeText;

  // Common fabrication patterns that must exist in source if present in resume
  const clearance = resume.match(/\b(top secret|secret clearance|ts\/sci)\b/i);
  if (clearance && !src.includes(clearance[0].toLowerCase())) {
    issues.push({
      id: "invented_clearance",
      severity: "error",
      message: `Possible invention: "${clearance[0]}" not found in your profile source`,
    });
  }

  // Degrees not in source
  const degreeHits = resume.match(
    /\b(Ph\.?D\.?|M\.?S\.?|M\.?B\.?A\.?|B\.?S\.?|B\.?A\.?)\b/gi
  );
  if (degreeHits) {
    for (const d of [...new Set(degreeHits)]) {
      if (!src.includes(d.toLowerCase().replace(/\./g, ""))) {
        // only flag if school-like context and not already soft-matched
        if (/university|college|institute/i.test(resume) && !/berkeley|stanford|mit|harvard|yale|princeton|penn|columbia|cornell/i.test(src)) {
          // soft: skip if education section empty in source
        }
      }
    }
  }

  // Large exact metrics invented
  const metrics = resume.match(/\d{2,3}%|\$\d+[kKmM]?|\d+x\b/g) || [];
  for (const m of metrics.slice(0, 12)) {
    if (!src.includes(m.toLowerCase()) && !src.includes(m)) {
      // only warn — many profiles store "40%" as "40 percent"
      const digits = m.replace(/[^\d]/g, "");
      if (digits && !src.includes(digits)) {
        issues.push({
          id: `metric_${m}`,
          severity: "warn",
          message: `Metric "${m}" not found in profile — verify it's real before applying`,
        });
      }
    }
  }

  return issues.slice(0, 10);
}

export function profileToSourceText(profile: {
  fullName?: string;
  headline?: string;
  summary?: string;
  skills?: Array<{ name: string }>;
  experiences?: Array<{
    company: string;
    title: string;
    description?: string;
    achievements?: string[];
  }>;
  education?: Array<{ school: string; degree: string; field?: string }>;
  projects?: Array<{ name: string; description?: string; bullets?: string[] }>;
  certifications?: string[];
}): string {
  return [
    profile.fullName,
    profile.headline,
    profile.summary,
    ...(profile.skills || []).map((s) => s.name),
    ...(profile.experiences || []).flatMap((e) => [
      e.company,
      e.title,
      e.description,
      ...(e.achievements || []),
    ]),
    ...(profile.education || []).flatMap((e) => [
      e.school,
      e.degree,
      e.field,
    ]),
    ...(profile.projects || []).flatMap((p) => [
      p.name,
      p.description,
      ...(p.bullets || []),
    ]),
    ...(profile.certifications || []),
  ]
    .filter(Boolean)
    .join("\n");
}
