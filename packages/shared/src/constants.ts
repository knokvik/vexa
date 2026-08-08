import type { PlatformDefinition } from "./types/platforms";

/** Quality-first volume caps — not spray-and-pray. */
export const VOLUME_CAPS = {
  maxDraftsPerDay: 10,
  maxDraftsPerWeek: 50,
  maxPerPlatformPerDay: 10,
  freeDraftsPerMonth: 5,
} as const;

export const SHORTLIST_THRESHOLDS = {
  /** Auto-approve option (opt-in only). */
  autoApproveMin: 0.85,
  /** Below this → requires_review. */
  reviewBelow: 0.72,
  highConfidence: 0.9,
} as const;

/**
 * Apply risk tiers (research 2026).
 * Server never auto-submits. Tiers only control draft / prefill aggressiveness.
 */
export const APPLY_TIERS = {
  /** Direct ATS + confidence ≥ this → ready package (still user submits) */
  tier1Min: 0.85,
  /** Below this on direct ATS → requires_review */
  tier2Min: 0.6,
  /** Max drafts / day (quality over spray) */
  maxDraftsPerDay: 10,
  /** Cold emails per company per week */
  maxColdEmailsPerCompanyWeek: 3,
} as const;

export type ApplySurface =
  | "direct_ats"
  | "linkedin"
  | "indeed"
  | "other"
  | "unknown";

export type ApplyMode = "copilot" | "semi_auto";

/** Classify job URL surface for risk routing */
export function classifyApplySurface(url: string): ApplySurface {
  const u = (url || "").toLowerCase();
  if (/linkedin\.com/.test(u)) return "linkedin";
  if (/indeed\.com/.test(u)) return "indeed";
  if (
    /greenhouse\.io|lever\.co|ashbyhq\.com|workday|myworkdayjobs|smartrecruiters|jobvite|icims|taleo|successfactors|bamboohr|careers\.|jobs\./.test(
      u
    )
  ) {
    return "direct_ats";
  }
  return "other";
}

export const HUMANIZATION_TARGETS = {
  perplexityMin: 150,
  perplexityMax: 300,
  /** Below this looks too robotic — rewrite. */
  rewriteBelow: 100,
} as const;

/**
 * ATS-first Ivy League style templates.
 * Single column · standard fonts · no tables/graphics · action-verb bullets.
 * Structures follow public career-center guidance (Harvard, Yale, Stanford-style,
 * Princeton, Penn, MIT) — not stock decorative templates.
 */
export const DEFAULT_TEMPLATES = [
  {
    id: "tpl-harvard",
    name: "Clean ATS (sample style)",
    category: "ivy" as const,
    isPremium: false,
    atsFriendlyScore: 98,
    description:
      "Matches common student resume layout: Education → Experience → Skills → Projects. No dashed rules, Trebuchet/Arial.",
    styleSource: "User sample Resume.docx",
    sectionOrder: [
      "education",
      "experience",
      "skills",
      "projects",
    ] as const,
    layout: "single_column" as const,
    fontFamily: "Trebuchet MS" as const,
    bestFor: "Most ATS systems · student & early career tech",
  },
  {
    id: "tpl-princeton",
    name: "Princeton Standard",
    category: "ivy" as const,
    isPremium: false,
    atsFriendlyScore: 97,
    description:
      "Action + technical skill + quantified result. Work Experience, Activities, Projects, Additional.",
    styleSource: "Princeton Career Development",
    sectionOrder: [
      "education",
      "experience",
      "leadership",
      "projects",
      "additional",
    ] as const,
    layout: "single_column" as const,
    fontFamily: "Arial" as const,
    bestFor: "Tech · finance · engineering students",
  },
  {
    id: "tpl-yale",
    name: "Yale Flexible",
    category: "ivy" as const,
    isPremium: false,
    atsFriendlyScore: 96,
    description:
      "Expanded education, no summary. Leadership & community, skills, additional info.",
    styleSource: "Yale OCS",
    sectionOrder: [
      "education",
      "experience",
      "leadership",
      "skills",
      "additional",
    ] as const,
    layout: "single_column" as const,
    fontFamily: "Times New Roman" as const,
    bestFor: "Students · recent grads · policy/nonprofit",
  },
  {
    id: "tpl-mit",
    name: "MIT STEM",
    category: "technical" as const,
    isPremium: false,
    atsFriendlyScore: 97,
    description:
      "Education at top, PAR bullets (Project–Activity–Result), skills, optional projects.",
    styleSource: "MIT CAPD",
    sectionOrder: [
      "education",
      "experience",
      "skills",
      "projects",
      "leadership",
    ] as const,
    layout: "single_column" as const,
    fontFamily: "Arial" as const,
    bestFor: "Software · STEM · research-adjacent roles",
  },
  {
    id: "tpl-penn",
    name: "Penn Professional",
    category: "classic" as const,
    isPremium: false,
    atsFriendlyScore: 96,
    description:
      "Simple consistent headers. Experience & leadership combined · Skills & interests.",
    styleSource: "Penn Career Services",
    sectionOrder: ["education", "experience", "skills", "additional"] as const,
    layout: "single_column" as const,
    fontFamily: "Calibri" as const,
    bestFor: "Business · product · general professional",
  },
  // Backward-compatible aliases (map to Ivy layouts in the builder)
  {
    id: "tpl-modern",
    name: "Modern Clean",
    category: "modern" as const,
    isPremium: false,
    atsFriendlyScore: 95,
    description: "Alias of Harvard-style single column for existing profiles.",
    styleSource: "Harvard-derived",
    sectionOrder: [
      "education",
      "experience",
      "leadership",
      "skills",
    ] as const,
    layout: "single_column" as const,
    fontFamily: "Arial" as const,
    bestFor: "General ATS",
  },
  {
    id: "tpl-classic",
    name: "Classic Professional",
    category: "classic" as const,
    isPremium: false,
    atsFriendlyScore: 95,
    description: "Alias of Penn Professional.",
    styleSource: "Penn-derived",
    sectionOrder: ["education", "experience", "skills", "additional"] as const,
    layout: "single_column" as const,
    fontFamily: "Calibri" as const,
    bestFor: "Traditional recruiters",
  },
  {
    id: "tpl-technical",
    name: "Technical Stack",
    category: "technical" as const,
    isPremium: false,
    atsFriendlyScore: 96,
    description: "Alias of MIT STEM skills-forward layout.",
    styleSource: "MIT-derived",
    sectionOrder: [
      "education",
      "experience",
      "skills",
      "projects",
    ] as const,
    layout: "single_column" as const,
    fontFamily: "Arial" as const,
    bestFor: "Engineering roles",
  },
] as const;

/** Global ATS formatting rules applied by every template renderer */
export const ATS_FORMATTING_RULES = {
  fonts: ["Arial", "Times New Roman", "Calibri", "Garamond", "Trebuchet MS"] as const,
  fontSize: { min: 10, max: 12, header: 14 },
  marginsInches: { min: 0.5, max: 1.0 },
  layout: "single_column" as const,
  maxPages: { undergrad: 1, experienced: 2 },
  avoid: [
    "tables",
    "text_boxes",
    "graphics",
    "images",
    "multi_column",
    "headers_footers_for_critical_info",
  ] as const,
  bulletStyle: "action_verb_led" as const,
  outputFormat: ["plain_text", "pdf_text_based"] as const,
} as const;

export const APP_NAME = "Vexa";
export const APP_TAGLINE = "Apply smarter. Stay human.";

/** Catalog of connectable platforms (OAuth wired later; demo connect works now). */
export const PLATFORM_CATALOG: PlatformDefinition[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    description:
      "Sync headline, experience, and skills before tailoring resumes.",
    syncScopes: ["profile", "experience", "skills"],
    oauthReady: true,
    brandColor: "#0A66C2",
    icon: "in",
  },
  {
    id: "x",
    name: "X (Twitter)",
    description: "Pull bio and interests for voice-matching cover notes.",
    syncScopes: ["profile", "posts"],
    oauthReady: true,
    brandColor: "#E7E9EA",
    icon: "𝕏",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Import languages, pinned projects, and activity signals.",
    syncScopes: ["skills", "portfolio"],
    oauthReady: true,
    brandColor: "#f0f6fc",
    icon: "gh",
  },
  {
    id: "google",
    name: "Google",
    description: "Verify email identity and calendar availability hints.",
    syncScopes: ["profile"],
    oauthReady: true,
    brandColor: "#EA4335",
    icon: "G",
  },
  {
    id: "indeed",
    name: "Indeed",
    description: "Optional job-alert preferences for discovery (read-only).",
    syncScopes: ["job_alerts", "profile"],
    oauthReady: false,
    brandColor: "#2164f3",
    icon: "Id",
  },
  {
    id: "wellfound",
    name: "Wellfound",
    description:
      "Startup roles + profile preferences for founder-led companies.",
    syncScopes: ["profile", "job_alerts"],
    oauthReady: false,
    brandColor: "#ff5a5f",
    icon: "Wf",
  },
];
