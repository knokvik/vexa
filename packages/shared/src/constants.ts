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
