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

export const HUMANIZATION_TARGETS = {
  perplexityMin: 150,
  perplexityMax: 300,
  /** Below this looks too robotic — rewrite. */
  rewriteBelow: 100,
} as const;

export const DEFAULT_TEMPLATES = [
  {
    id: "tpl-modern",
    name: "Modern Clean",
    category: "modern" as const,
    isPremium: false,
    atsFriendlyScore: 92,
    description: "ATS-friendly single column with clear hierarchy.",
  },
  {
    id: "tpl-classic",
    name: "Classic Professional",
    category: "classic" as const,
    isPremium: false,
    atsFriendlyScore: 95,
    description: "Traditional layout recruiters expect.",
  },
  {
    id: "tpl-technical",
    name: "Technical Stack",
    category: "technical" as const,
    isPremium: true,
    atsFriendlyScore: 90,
    description: "Skills-forward layout for eng roles.",
  },
] as const;

export const APP_NAME = "Vexa";
export const APP_TAGLINE = "Apply smarter. Stay human.";
