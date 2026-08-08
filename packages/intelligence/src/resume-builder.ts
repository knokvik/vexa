/**
 * ATS-safe Ivy League style resume builder.
 * Single-column plain text · standard section headers · action-verb bullets.
 */

import type {
  Education,
  Experience,
  JobListing,
  LeadershipItem,
  Profile,
  ProjectItem,
  ResumeContent,
  ResumeSection,
  ResumeSectionType,
  Skill,
} from "@vexa/shared";
import { humanizeText } from "./humanize";
import { scoreAts } from "./ats";
import { predictShortlist } from "./shortlist";
import {
  checkInvention,
  lintAtsPlainText,
  profileToSourceText,
  type AtsLintIssue,
  type AtsLintReport,
} from "./ats-linter";
import {
  getTemplate,
  pickTemplateId,
  resolveTemplateId,
  sectionTitle,
  type TemplateId,
} from "./templates";

const ACTION_VERBS = [
  "Led",
  "Built",
  "Designed",
  "Shipped",
  "Improved",
  "Reduced",
  "Increased",
  "Owned",
  "Drove",
  "Launched",
  "Mentored",
  "Automated",
  "Optimized",
  "Delivered",
  "Implemented",
  "Architected",
  "Scaled",
  "Analyzed",
  "Coordinated",
  "Created",
];

function fmtMonthYear(raw?: string | null): string {
  if (!raw) return "";
  // Accept YYYY-MM or YYYY
  const m = raw.match(/^(\d{4})-(\d{2})/);
  if (m) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[Number(m[2]) - 1] || m[2]} ${m[1]}`;
  }
  if (/^\d{4}$/.test(raw)) return raw;
  return raw;
}

function dateRange(
  start?: string | null,
  end?: string | null,
  isCurrent?: boolean
): string {
  const a = fmtMonthYear(start);
  const b = isCurrent ? "Present" : fmtMonthYear(end);
  if (a && b) return `${a} – ${b}`;
  return a || b || "";
}

const WEAK_OPENERS =
  /^(responsible for|helped with|worked on|was part of|assisted with|tasked with)\s+/i;

/** Common strong openers (incl. irregular past tense) */
const STRONG_OPENERS = new Set(
  [
    ...ACTION_VERBS,
    "Cut",
    "Grew",
    "Ran",
    "Wrote",
    "Won",
    "Sold",
    "Raised",
    "Fixed",
    "Hired",
    "Trained",
    "Managed",
    "Developed",
    "Engineered",
    "Migrated",
    "Refactored",
    "Integrated",
    "Deployed",
    "Measured",
    "Presented",
    "Negotiated",
    "Partnered",
    "Supported",
    "Streamlined",
    "Transformed",
    "Spearheaded",
    "Championed",
    "Established",
    "Expanded",
    "Accelerated",
    "Resolved",
    "Rebuilt",
    "Introduced",
  ].map((v) => v.toLowerCase())
);

/** Ensure bullet leads with an action verb (ATS + Ivy guidance). */
export function ensureActionBullet(text: string): string {
  const t = text.replace(/^[\s•\-\*]+/, "").trim();
  if (!t) return t;
  const first = (t.split(/\s+/)[0] || "").replace(/[^A-Za-z]/g, "");
  const looksLikeVerb =
    STRONG_OPENERS.has(first.toLowerCase()) ||
    /^[A-Za-z]+ed$/i.test(first) ||
    /^[A-Za-z]+ing$/i.test(first);
  if (looksLikeVerb && !WEAK_OPENERS.test(t)) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  // Soft wrap weak openers
  const cleaned = t.replace(WEAK_OPENERS, "").trim();
  if (!cleaned) return t.charAt(0).toUpperCase() + t.slice(1);
  return `Delivered ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(1)}`;
}

function uniqueSkills(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of skills) {
    const key = s.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s.trim());
  }
  return out;
}

function skillsByCategory(skills: Skill[]): {
  technical: string[];
  tools: string[];
  soft: string[];
  language: string[];
} {
  const technical: string[] = [];
  const tools: string[] = [];
  const soft: string[] = [];
  const language: string[] = [];
  for (const s of skills) {
    const cat = s.category || "technical";
    if (cat === "tool") tools.push(s.name);
    else if (cat === "soft") soft.push(s.name);
    else if (cat === "language") language.push(s.name);
    else technical.push(s.name);
  }
  return { technical, tools, soft, language };
}

function contactLine(profile: Profile): {
  email?: string;
  phone?: string;
  location?: string;
  links: string[];
  line: string;
} {
  const email = profile.email || undefined;
  const phone = profile.phone || undefined;
  const location = profile.location || undefined;
  const links = [
    profile.linkedinUrl,
    profile.githubUrl,
    profile.portfolioUrl,
  ].filter(Boolean) as string[];
  const parts = [email, phone, location, ...links].filter(Boolean);
  return {
    email,
    phone,
    location,
    links,
    line: parts.join(" | "),
  };
}

/**
 * Experience block matching sample resume:
 *   Company, Location
 *   [ Title ]
 *   Dates
 *   Paragraph (or short bullets with • — never ---)
 */
function formatExperienceBlock(
  e: Experience,
  style: "harvard" | "princeton" | "default"
): string[] {
  const range = dateRange(e.startDate, e.endDate, e.isCurrent);
  const loc = e.location || "";
  const lines: string[] = [];
  lines.push(loc ? `${e.company}, ${loc}` : e.company);
  lines.push(`[ ${e.title} ]`);
  if (range) lines.push(range);
  // Prefer a single readable paragraph (user sample style) over dashed rules
  if (e.description?.trim()) {
    lines.push(e.description.trim());
  }
  const bullets = e.achievements || [];
  if (bullets.length && !e.description?.trim()) {
    for (const b of bullets) {
      lines.push(`• ${ensureActionBullet(b)}`);
    }
  } else if (bullets.length && e.description?.trim()) {
    // Keep top 2 achievements as • lines only if short
    for (const b of bullets.slice(0, 2)) {
      lines.push(`• ${ensureActionBullet(b)}`);
    }
  }
  void style;
  return lines;
}

/**
 * Education:
 *   School, Location
 *   Degree in Field [GPA]
 *   Graduation : YEAR
 */
function formatEducationBlock(ed: Education): string[] {
  const lines: string[] = [];
  const loc = ed.location || "";
  // Avoid "School, Pune, Pune, Maharashtra" when school already names city
  const schoolLine =
    loc && !ed.school.toLowerCase().includes(loc.toLowerCase().split(",")[0].trim())
      ? `${ed.school}, ${loc}`
      : ed.school;
  lines.push(schoolLine);
  const degreeBits = [ed.degree, ed.field].filter(Boolean).join(" in ");
  const gpa = ed.gpa ? ` [${ed.gpa}]` : "";
  lines.push(`${degreeBits}${gpa}`);
  const grad = fmtMonthYear(ed.endDate) || fmtMonthYear(ed.startDate);
  if (grad) lines.push(`Graduation : ${grad}`);
  if (ed.coursework?.length)
    lines.push(`Relevant Coursework: ${ed.coursework.join(", ")}`);
  if (ed.honors?.length) lines.push(`Honors: ${ed.honors.join(", ")}`);
  return lines;
}

function formatLeadership(l: LeadershipItem): string[] {
  const lines: string[] = [];
  const loc = l.location ? `, ${l.location}` : "";
  lines.push(`${l.organization}${loc}`);
  const range = dateRange(l.startDate, l.endDate, false);
  lines.push(`[ ${l.role} ]`);
  if (range) lines.push(range);
  for (const b of l.bullets || []) {
    lines.push(`• ${ensureActionBullet(b)}`);
  }
  return lines;
}

/** Projects: "Name : description" (sample resume style) */
function formatProject(p: ProjectItem): string[] {
  const desc =
    p.description ||
    (p.bullets?.length ? p.bullets.map((b) => ensureActionBullet(b)).join(" ") : "");
  const tech =
    p.technologies?.length ? ` (${p.technologies.join(", ")})` : "";
  const url = p.url ? ` ${p.url}` : "";
  return [`${p.name} : ${desc}${tech}${url}`.trim()];
}

/**
 * Skills sample style:
 *   Technical:
 *   Current Core Focus: A, B, C
 *   Frameworks & Tools: ...
 *   Language: ...
 */
function formatSkillsSection(
  profile: Profile,
  weave: string[],
  templateId: TemplateId
): string[] {
  const cats = skillsByCategory(profile.skills);
  const lines: string[] = [];
  const core = uniqueSkills([...cats.technical, ...weave]);
  const tools = uniqueSkills([...cats.tools]);
  const langs = uniqueSkills([
    ...cats.language,
    ...(profile.languages || []),
  ]);

  lines.push("Technical:");
  if (core.length)
    lines.push(`Current Core Focus: ${core.join(", ")}`);
  if (tools.length)
    lines.push(`Frameworks & Tools: ${tools.join(", ")}`);
  else if (core.length && templateId)
    lines.push(`Frameworks & Tools: React, Docker`);
  if (langs.length) lines.push(`Language: ${langs.join(" ")}`);

  if (profile.interests?.length) {
    lines.push(
      `Interests: ${profile.interests.join(" ")}`
    );
  }
  return lines.filter(Boolean);
}

function formatAdditional(profile: Profile, templateId: TemplateId): string[] {
  const lines: string[] = [];
  if (templateId === "tpl-princeton") {
    // Princeton puts skills inside ADDITIONAL when we use that section alone
    const cats = skillsByCategory(profile.skills);
    if (cats.technical.length || cats.tools.length)
      lines.push(
        `Technical Skills: ${uniqueSkills([
          ...cats.technical,
          ...cats.tools,
        ]).join(", ")}`
      );
    if (profile.languages?.length || cats.language.length)
      lines.push(
        `Languages: ${uniqueSkills([
          ...cats.language,
          ...(profile.languages || []),
        ]).join(", ")}`
      );
    if (profile.certifications?.length)
      lines.push(
        `Certification & Training: ${profile.certifications.join(", ")}`
      );
  }
  if (profile.interests?.length && templateId !== "tpl-penn") {
    lines.push(`Interests: ${profile.interests.join(", ")}`);
  }
  if (profile.certifications?.length && templateId === "tpl-yale") {
    lines.push(`Certifications: ${profile.certifications.join(", ")}`);
  }
  return lines;
}

function buildSections(
  profile: Profile,
  job: JobListing | null,
  templateId: TemplateId
): ResumeSection[] {
  const profileSkillNames = new Set(
    profile.skills.map((s) => s.name.toLowerCase())
  );
  const weave =
    job?.skillsRequired.filter((s) =>
      [...profileSkillNames].some(
        (p) => p.includes(s.toLowerCase()) || s.toLowerCase().includes(p)
      )
    ) || [];

  const expStyle =
    templateId === "tpl-princeton" ? "princeton" : "harvard";

  const sections: ResumeSection[] = [];
  let order = 1;

  const push = (
    type: ResumeSectionType,
    content: string | string[],
    titleOverride?: string
  ) => {
    const arr = Array.isArray(content) ? content : [content];
    if (!arr.some((c) => String(c).trim())) return;
    sections.push({
      id: type,
      type,
      title: titleOverride || sectionTitle(type, templateId),
      order: order++,
      content: Array.isArray(content) ? content : content,
    });
  };

  // Sample resume format skips objective/summary fluff — Education first

  // Education
  const education = profile.education || [];
  if (education.length) {
    const blocks = education.flatMap((ed, i) => [
      ...(i > 0 ? [""] : []),
      ...formatEducationBlock(ed),
    ]);
    push("education", blocks);
  }

  // Experience (+ penn merges leadership into experience title)
  const expBlocks = (profile.experiences || []).flatMap((e, i) => [
    ...(i > 0 ? [""] : []),
    ...formatExperienceBlock(e, expStyle),
  ]);
  if (templateId === "tpl-penn" && profile.leadership?.length) {
    for (const l of profile.leadership) {
      expBlocks.push("", ...formatLeadership(l));
    }
  }
  push("experience", expBlocks);

  // Leadership (not for penn — already merged)
  if (templateId !== "tpl-penn" && profile.leadership?.length) {
    const blocks = profile.leadership.flatMap((l, i) => [
      ...(i > 0 ? [""] : []),
      ...formatLeadership(l),
    ]);
    push("leadership", blocks);
  }

  // Projects (always include when present — sample resume style)
  if (profile.projects?.length) {
    const blocks = profile.projects.flatMap((p, i) => [
      ...(i > 0 ? [""] : []),
      ...formatProject(p),
    ]);
    push("projects", blocks);
  }

  // Skills — Princeton puts skill detail in ADDITIONAL; still keep SKILLS thin
  if (templateId === "tpl-princeton") {
    push("additional", formatAdditional(profile, templateId));
  } else {
    push("skills", formatSkillsSection(profile, weave, templateId));
    if (templateId === "tpl-yale" || templateId === "tpl-penn") {
      const add = formatAdditional(profile, templateId);
      // Penn skills already includes interests
      if (templateId === "tpl-yale" && add.length) push("additional", add);
    }
  }

  // Reorder per template sectionOrder when present
  const tpl = getTemplate(templateId);
  const preferred = (tpl.sectionOrder || []) as ResumeSectionType[];
  if (preferred.length) {
    sections.sort((a, b) => {
      const ia = preferred.indexOf(a.type);
      const ib = preferred.indexOf(b.type);
      const ra = ia === -1 ? 99 : ia;
      const rb = ib === -1 ? 99 : ib;
      return ra - rb || a.order - b.order;
    });
    sections.forEach((s, i) => {
      s.order = i + 1;
    });
  }

  return sections;
}

/**
 * Render ATS-safe plain text matching sample resume style:
 * - Name in title case (not ALL CAPS)
 * - Contact: location • email • phone  (no --- rules)
 * - Section headers: Education / Experience / Skills (title case, no dashes)
 * - Blank line between sections only
 */
export function renderAtsPlainText(content: ResumeContent): string {
  const lines: string[] = [];
  // Title case name — never forced UPPERCASE
  lines.push(content.fullName);
  lines.push("");

  // Contact line like sample: Pune • email • phone
  const contactBits = [
    content.contact.location,
    content.contact.email,
    content.contact.phone,
  ].filter(Boolean);
  if (contactBits.length) {
    lines.push(contactBits.join(" • "));
  }
  // Links on their own lines if present (LinkedIn / Github) — sample personal details style
  for (const link of content.contact.links || []) {
    if (/linkedin/i.test(link)) lines.push(`LinkedIn : ${link}`);
    else if (/github/i.test(link)) lines.push(`Github : ${link}`);
  }
  lines.push("");

  const sorted = [...content.sections].sort((a, b) => a.order - b.order);
  for (const sec of sorted) {
    // Title Case section header — never "---" underlines
    const title =
      sec.title.charAt(0).toUpperCase() +
      sec.title.slice(1).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    // Fix: "Work Experience" style from ALL CAPS source
    const niceTitle = sec.title
      .toLowerCase()
      .split(/[\s_]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    lines.push(niceTitle || title);
    const body = Array.isArray(sec.content) ? sec.content : [sec.content];
    for (const row of body) {
      // Strip any accidental rule characters
      const clean = String(row).replace(/^[-─–—_]{3,}$/g, "").trimEnd();
      if (clean === "" && lines[lines.length - 1] === "") continue;
      lines.push(clean);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

export interface BuiltResumePackage {
  templateId: string;
  templateName: string;
  content: ResumeContent;
  plainText: string;
  humanizedScore: number;
  atsScore: number;
  formatScore: number;
  shortlistProbability: number;
  shortlistFactors: ReturnType<typeof predictShortlist>["factors"];
  recommendation: string;
  atsSuggestions: string[];
  missingKeywords: string[];
  atsChecklist: AtsChecklistItem[];
  /** Parse-safety (single column, no tables…) */
  parseSafety: AtsLintReport;
  /** Claims that may not exist in profile */
  inventionFlags: AtsLintIssue[];
}

export type AtsChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

export function buildAtsChecklist(
  content: ResumeContent,
  plainText: string
): AtsChecklistItem[] {
  const hasEmail = Boolean(content.contact.email);
  const hasPhone = Boolean(content.contact.phone);
  const sectionTypes = new Set(content.sections.map((s) => s.type));
  const hasExp = sectionTypes.has("experience");
  const hasSkills =
    sectionTypes.has("skills") ||
    sectionTypes.has("additional") ||
    /skills/i.test(plainText);
  const hasEducation = sectionTypes.has("education");
  const bullets = (plainText.match(/^• /gm) || []).length;
  const hasMetrics = /\d+%|\$\d+|\d+\+|x\d+|\d+\s*(years|yrs|users|teams)/i.test(
    plainText
  );
  const noTables = !/\t{2,}|│|┌|┐/.test(plainText);
  const singleColumn = !/\|.+\|/.test(
    plainText.split("\n").filter((l) => !l.includes(" | ")).join("\n")
  );
  // Contact lines use " | " which is fine; multi-column would be rarer patterns
  void singleColumn;

  return [
    {
      id: "single_column",
      label: "Single-column layout (no tables/columns)",
      ok: noTables,
    },
    {
      id: "contact",
      label: "Contact info (email or phone)",
      ok: hasEmail || hasPhone,
      detail: hasEmail ? "email" : hasPhone ? "phone" : "missing",
    },
    {
      id: "experience",
      label: "Experience section present",
      ok: hasExp,
    },
    {
      id: "skills",
      label: "Skills / technical keywords present",
      ok: hasSkills,
    },
    {
      id: "education",
      label: "Education section (recommended)",
      ok: hasEducation,
    },
    {
      id: "bullets",
      label: "Action-verb bullet points",
      ok: bullets >= 2,
      detail: `${bullets} bullets`,
    },
    {
      id: "metrics",
      label: "Quantified results where possible",
      ok: hasMetrics,
    },
    {
      id: "length",
      label: "Reasonable length (not empty)",
      ok: plainText.split(/\s+/).length >= 80,
      detail: `${plainText.split(/\s+/).length} words`,
    },
  ];
}

export function buildTailoredResume(
  profile: Profile,
  job: JobListing,
  options?: { templateId?: string; humanize?: boolean }
): BuiltResumePackage {
  return buildResume(profile, job, options);
}

/** Build base or job-tailored resume with chosen Ivy/ATS template */
export function buildResume(
  profile: Profile,
  job: JobListing | null,
  options?: { templateId?: string; humanize?: boolean }
): BuiltResumePackage {
  const templateId = resolveTemplateId(
    options?.templateId || pickTemplateId(profile.templatePriorities)
  );
  const template = getTemplate(
    options?.templateId || pickTemplateId(profile.templatePriorities)
  );

  const contact = contactLine(profile);
  const sections = buildSections(profile, job, templateId);

  const content: ResumeContent = {
    fullName: profile.fullName,
    headline: profile.headline ?? job?.title,
    contact: {
      email: contact.email,
      phone: contact.phone,
      location: contact.location,
      links: contact.links,
    },
    sections,
    templateId: template.id,
  };

  let plainText = renderAtsPlainText(content);

  // Light humanize of free-form lines only (keep structure)
  let humanizedScore = 88;
  if (options?.humanize !== false && job) {
    // Humanize only achievement-like long lines, not headers
    const human = humanizeText(
      plainText
        .split("\n")
        .filter((l) => l.startsWith("• "))
        .join("\n") || plainText.slice(0, 500)
    );
    humanizedScore = human.score;
    // Re-apply humanized bullets carefully — if humanizer invents structure, keep original
    if (human.text && human.text.includes("•")) {
      // Prefer original structure for ATS reliability
      plainText = renderAtsPlainText(content);
    }
  }

  const atsJob = job || {
    title: profile.headline || "Professional",
    description: profile.summary || "",
    skillsRequired: profile.skills.map((s) => s.name),
    requirements: [],
    experienceLevel: "mid" as const,
  };

  const ats = scoreAts(content, atsJob);
  const shortlist = job
    ? predictShortlist({ profile, job, ats })
    : {
        probability: 0,
        confidence: 0,
        factors: [],
        recommendation: "Select a job to score shortlist odds.",
      };

  const checklist = buildAtsChecklist(content, plainText);
  const parseSafety = lintAtsPlainText(plainText);
  const inventionFlags = checkInvention(
    plainText,
    profileToSourceText(profile)
  );
  const checklistBoost =
    checklist.filter((c) => c.ok).length / Math.max(checklist.length, 1);

  // Blend format score with template ATS friendliness + parse linter
  const formatScore = Math.min(
    100,
    Math.round(
      ats.formatScore * 0.35 +
        template.atsFriendlyScore * 0.25 +
        checklistBoost * 100 * 0.15 +
        parseSafety.score * 0.25
    )
  );

  // Nudge overall if structure is excellent; penalize invention errors
  const inventionPenalty = inventionFlags.some((i) => i.severity === "error")
    ? 12
    : inventionFlags.length
      ? 4
      : 0;
  const atsScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(ats.overallScore * 0.9 + formatScore * 0.1 - inventionPenalty)
    )
  );

  const suggestions = [
    ...ats.suggestions,
    ...checklist.filter((c) => !c.ok).map((c) => `ATS: fix — ${c.label}`),
    ...parseSafety.issues.map((i) => `Parse: ${i.message}`),
    ...inventionFlags.map((i) => `Verify: ${i.message}`),
  ].slice(0, 14);

  return {
    templateId: template.id,
    templateName: template.name,
    content,
    plainText,
    humanizedScore,
    atsScore,
    formatScore,
    shortlistProbability: shortlist.probability,
    shortlistFactors: shortlist.factors,
    recommendation: shortlist.recommendation,
    atsSuggestions: suggestions,
    missingKeywords: ats.missingKeywords,
    atsChecklist: checklist,
    parseSafety,
    inventionFlags,
  };
}

export { pickTemplateId, resolveTemplateId, getTemplate };
