/**
 * ATS form-fill engine (Greenhouse, Lever, Ashby, Workday, generic).
 * Builds per-field answers from profile + job, scores ATS + human quality.
 * Never auto-submits — answers feed extension prefill only.
 */

import type { JobListing, Profile } from "@vexa/shared";
import { classifyApplySurface } from "@vexa/shared";

export type FormSurface =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workday"
  | "linkedin"
  | "indeed"
  | "generic";

export type FormAnswerCategory =
  | "identity"
  | "links"
  | "experience"
  | "open_ended"
  | "legal"
  | "eeo"
  | "other";

export type FormAnswer = {
  /** Canonical key used by extension + filledFormData */
  key: string;
  /** Human label for inbox UI */
  label: string;
  value: string;
  category: FormAnswerCategory;
  /** How well answer uses role keywords (0–100) */
  atsScore: number;
  /** Natural / non-robotic heuristic (0–100) */
  humanScore: number;
  overall: number;
  notes?: string;
  /** Extra DOM aliases for this ATS */
  aliases?: string[];
};

export type FormFillResult = {
  surface: FormSurface;
  answers: FormAnswer[];
  /** Flat map for extension prefill */
  filledFormData: Record<string, string>;
  /** Aggregate quality */
  eval: {
    avgAts: number;
    avgHuman: number;
    avgOverall: number;
    fieldCount: number;
    readyCount: number;
    reviewCount: number;
    recommendation: string;
  };
};

function detectSurface(url: string): FormSurface {
  const u = (url || "").toLowerCase();
  if (/greenhouse\.io|boards\.greenhouse|job-boards\.greenhouse/.test(u))
    return "greenhouse";
  if (/lever\.co/.test(u)) return "lever";
  if (/ashbyhq\.com/.test(u)) return "ashby";
  if (/workday|myworkdayjobs/.test(u)) return "workday";
  if (/linkedin\.com/.test(u)) return "linkedin";
  if (/indeed\.com/.test(u)) return "indeed";
  return "generic";
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function yearsFromProfile(profile: Profile): number {
  if (profile.yearsExperience != null) return profile.yearsExperience;
  let years = 0;
  for (const e of profile.experiences || []) {
    const start = Date.parse(e.startDate);
    const end = e.isCurrent
      ? Date.now()
      : e.endDate
        ? Date.parse(e.endDate)
        : Date.now();
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      years += Math.max(0, (end - start) / (365.25 * 86400000));
    }
  }
  return Math.max(0, Math.round(years * 10) / 10);
}

function jobKeywords(job: JobListing): string[] {
  const blob = `${job.title} ${job.description || ""} ${(job.skillsRequired || []).join(" ")}`.toLowerCase();
  const bank = [
    "react",
    "typescript",
    "javascript",
    "node",
    "python",
    "go",
    "java",
    "aws",
    "kubernetes",
    "docker",
    "sql",
    "postgres",
    "graphql",
    "next.js",
    "system design",
    "distributed",
    "backend",
    "frontend",
    "fullstack",
    "ml",
    "data",
  ];
  return bank.filter((k) => blob.includes(k));
}

function atsScoreForText(text: string, keywords: string[]): number {
  if (!text.trim()) return 0;
  if (!keywords.length) return 70;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const k of keywords) {
    if (lower.includes(k)) hits += 1;
  }
  const ratio = hits / Math.min(keywords.length, 8);
  return Math.min(100, Math.round(40 + ratio * 60));
}

function humanScoreForText(text: string): number {
  if (!text.trim()) return 0;
  let score = 75;
  // Penalty for buzzword salad / robotic
  if (/\bsynergy|leverage|circle back|rockstar|ninja\b/i.test(text)) score -= 15;
  if (text.length < 40) score -= 10;
  if (text.length > 80 && text.length < 600) score += 10;
  // Prefer first person lightly
  if (/\bI\b|\bmy\b|\bI've\b/i.test(text)) score += 5;
  // Too many semicolons / corporate paste
  if ((text.match(/;/g) || []).length > 3) score -= 8;
  return Math.max(0, Math.min(100, score));
}

function makeAnswer(
  partial: Omit<FormAnswer, "atsScore" | "humanScore" | "overall"> & {
    atsScore?: number;
    humanScore?: number;
  },
  keywords: string[]
): FormAnswer {
  const ats =
    partial.atsScore ??
    (partial.category === "open_ended"
      ? atsScoreForText(partial.value, keywords)
      : partial.value
        ? 85
        : 0);
  const human =
    partial.humanScore ??
    (partial.category === "open_ended"
      ? humanScoreForText(partial.value)
      : partial.value
        ? 90
        : 0);
  const overall = Math.round(ats * 0.55 + human * 0.45);
  return {
    ...partial,
    atsScore: ats,
    humanScore: human,
    overall,
  };
}

function buildWhyUs(
  profile: Profile,
  job: JobListing,
  keywords: string[]
): string {
  const skills = (profile.skills || [])
    .map((s) => s.name)
    .filter((n) =>
      keywords.some(
        (k) =>
          n.toLowerCase().includes(k) || k.includes(n.toLowerCase().slice(0, 4))
      )
    )
    .slice(0, 4);
  const skillBit =
    skills.length > 0
      ? `especially ${skills.join(", ")}`
      : profile.headline || "building reliable software";
  const co = job.company || "your team";
  const role = job.title || "this role";
  return `I'm drawn to ${co}'s ${role} because it lines up with how I work day-to-day — ${skillBit}. I've shipped similar problems in production and would bring that same ownership here. Happy to walk through a concrete example in an interview.`;
}

function buildExperienceBlurb(profile: Profile, job: JobListing): string {
  const top = (profile.experiences || [])[0];
  if (!top) {
    return (
      profile.summary?.slice(0, 400) ||
      profile.headline ||
      "Software engineer with hands-on product experience."
    );
  }
  const ach = (top.achievements || [])[0];
  return `${top.title} at ${top.company}${ach ? ` — ${ach}` : top.description ? ` — ${top.description.slice(0, 180)}` : ""}. Applying for ${job.title} to keep building in that direction.`;
}

/**
 * Generate full form answer set for a job application.
 */
export function buildFormFill(opts: {
  profile: Profile;
  job: JobListing;
  coverLetter?: string;
  resumePlainText?: string;
}): FormFillResult {
  const { profile, job } = opts;
  const surface = detectSurface(job.externalUrl || "");
  const keywords = jobKeywords(job);
  const { first, last } = splitName(profile.fullName);
  const years = yearsFromProfile(profile);
  const email = profile.email || "";
  const phone = profile.phone || "";
  const location = profile.location || profile.preferredLocations?.[0] || "";
  const salaryMin = profile.desiredSalaryMin;
  const salaryMax = profile.desiredSalaryMax;
  const salaryStr =
    salaryMin && salaryMax
      ? `${salaryMin}-${salaryMax}`
      : salaryMin
        ? String(salaryMin)
        : "";

  const cover =
    opts.coverLetter ||
    `Hi ${job.company} team — I'm interested in the ${job.title} role and would welcome a conversation.`;

  const resumeText = (opts.resumePlainText || "").slice(0, 5000);
  const whyUs = buildWhyUs(profile, job, keywords);
  const expBlurb = buildExperienceBlurb(profile, job);

  const answers: FormAnswer[] = [];

  const push = (
    a: Omit<FormAnswer, "atsScore" | "humanScore" | "overall"> & {
      atsScore?: number;
      humanScore?: number;
    }
  ) => answers.push(makeAnswer(a, keywords));

  // —— Identity (all ATS) ——
  push({
    key: "name",
    label: "Full name",
    value: profile.fullName,
    category: "identity",
    aliases: ["full_name", "fullname", "candidate_name", "applicant_name"],
  });
  push({
    key: "first_name",
    label: "First name",
    value: first,
    category: "identity",
    aliases: ["firstname", "given_name", "first name"],
  });
  push({
    key: "last_name",
    label: "Last name",
    value: last,
    category: "identity",
    aliases: ["lastname", "family_name", "surname", "last name"],
  });
  push({
    key: "email",
    label: "Email",
    value: email,
    category: "identity",
    aliases: ["e-mail", "email_address", "candidate_email"],
  });
  push({
    key: "phone",
    label: "Phone",
    value: phone,
    category: "identity",
    aliases: ["tel", "mobile", "phone_number", "telephone"],
  });
  push({
    key: "location",
    label: "Location",
    value: location,
    category: "identity",
    aliases: ["city", "address", "current_location", "where_are_you_based"],
  });

  // —— Links ——
  push({
    key: "linkedin",
    label: "LinkedIn",
    value: profile.linkedinUrl || "",
    category: "links",
    aliases: [
      "linkedin_url",
      "linkedin_profile",
      "linked-in",
      "linkedin profile",
    ],
  });
  push({
    key: "github",
    label: "GitHub",
    value: profile.githubUrl || "",
    category: "links",
    aliases: ["github_url", "github profile", "git hub"],
  });
  push({
    key: "website",
    label: "Portfolio / website",
    value: profile.portfolioUrl || profile.githubUrl || "",
    category: "links",
    aliases: ["portfolio", "personal_website", "url", "homepage"],
  });

  // —— Experience / open-ended ——
  push({
    key: "years_experience",
    label: "Years of experience",
    value: years ? String(years) : "",
    category: "experience",
    aliases: [
      "years_of_experience",
      "years experience",
      "total_years",
      "experience_years",
    ],
  });
  push({
    key: "current_company",
    label: "Current company",
    value: profile.experiences?.find((e) => e.isCurrent)?.company ||
      profile.experiences?.[0]?.company ||
      "",
    category: "experience",
    aliases: ["employer", "company", "current employer"],
  });
  push({
    key: "current_title",
    label: "Current title",
    value:
      profile.experiences?.find((e) => e.isCurrent)?.title ||
      profile.experiences?.[0]?.title ||
      profile.headline ||
      "",
    category: "experience",
    aliases: ["job_title", "title", "headline", "current role"],
  });
  push({
    key: "cover_letter",
    label: "Cover letter",
    value: cover,
    category: "open_ended",
    aliases: ["coverletter", "cover letter", "message", "additional_information"],
  });
  push({
    key: "resume_text",
    label: "Resume (text)",
    value: resumeText,
    category: "experience",
    aliases: ["resume", "cv", "summary", "about", "additional"],
    atsScore: atsScoreForText(resumeText, keywords),
    humanScore: humanScoreForText(resumeText.slice(0, 800)),
  });
  push({
    key: "why_company",
    label: "Why this company / role",
    value: whyUs,
    category: "open_ended",
    aliases: [
      "why_us",
      "why do you want",
      "what interests you",
      "motivation",
      "why are you interested",
    ],
  });
  push({
    key: "relevant_experience",
    label: "Relevant experience",
    value: expBlurb,
    category: "open_ended",
    aliases: [
      "tell us about",
      "describe your experience",
      "background",
      "qualifications",
    ],
  });

  if (salaryStr) {
    push({
      key: "salary_expectation",
      label: "Salary expectation",
      value: salaryStr,
      category: "other",
      aliases: [
        "desired_salary",
        "salary",
        "compensation",
        "expected_salary",
        "pay_expectation",
      ],
      notes: "From profile range — edit if needed",
    });
  }

  // Legal — careful defaults (user should confirm)
  push({
    key: "work_authorization",
    label: "Work authorization",
    value: "Yes — authorized to work (confirm before submit)",
    category: "legal",
    aliases: [
      "are you authorized",
      "work authorization",
      "legally authorized",
      "eligible to work",
    ],
    notes: "Review before submit — do not invent status",
    humanScore: 60,
    atsScore: 50,
  });
  push({
    key: "sponsorship",
    label: "Visa sponsorship",
    value: "Prefer to discuss",
    category: "legal",
    aliases: [
      "require sponsorship",
      "visa sponsorship",
      "will you now or in the future",
      "need sponsorship",
    ],
    notes: "User should set true preference in profile later",
    humanScore: 70,
    atsScore: 40,
  });

  // EEO — prefer not to say (safest default)
  push({
    key: "gender",
    label: "Gender (EEO)",
    value: "Decline to self-identify",
    category: "eeo",
    aliases: ["gender identity", "sex"],
  });
  push({
    key: "race_ethnicity",
    label: "Race / ethnicity (EEO)",
    value: "Decline to self-identify",
    category: "eeo",
    aliases: ["ethnicity", "ethnicity/ethnicity", "ethnicity ethnicity", "ethnicity and ethnicity"],
  });
  push({
    key: "veteran_status",
    label: "Veteran status (EEO)",
    value: "Decline to self-identify",
    category: "eeo",
    aliases: ["veteran", "protected veteran"],
  });
  push({
    key: "disability",
    label: "Disability (EEO)",
    value: "Decline to self-identify",
    category: "eeo",
    aliases: ["disability status", "disability"],
  });

  // How did you hear
  push({
    key: "how_heard",
    label: "How did you hear about us",
    value: "Company careers / job board",
    category: "other",
    aliases: [
      "how did you hear",
      "how_did_you_hear",
      "source",
      "referral source",
    ],
  });

  // Surface-specific extras
  if (surface === "greenhouse" || surface === "lever" || surface === "ashby") {
    push({
      key: "school",
      label: "School",
      value: profile.education?.[0]?.school || "",
      category: "experience",
      aliases: ["university", "college", "education"],
    });
    push({
      key: "degree",
      label: "Degree",
      value: profile.education?.[0]
        ? `${profile.education[0].degree}${profile.education[0].field ? ` in ${profile.education[0].field}` : ""}`
        : "",
      category: "experience",
      aliases: ["education_degree", "highest degree"],
    });
  }

  // Flat map + aliases for extension
  const filledFormData: Record<string, string> = {};
  for (const a of answers) {
    if (a.value) filledFormData[a.key] = a.value;
    for (const al of a.aliases || []) {
      if (a.value) filledFormData[al] = a.value;
    }
  }

  const withValue = answers.filter((a) => a.value.trim());
  const avgAts =
    withValue.reduce((s, a) => s + a.atsScore, 0) /
    Math.max(1, withValue.length);
  const avgHuman =
    withValue.reduce((s, a) => s + a.humanScore, 0) /
    Math.max(1, withValue.length);
  const avgOverall =
    withValue.reduce((s, a) => s + a.overall, 0) /
    Math.max(1, withValue.length);

  const readyCount = withValue.filter((a) => a.overall >= 70).length;
  const reviewCount = withValue.filter((a) => a.overall < 70).length;

  const surfaceRisk = classifyApplySurface(job.externalUrl || "");
  let recommendation = "Review answers, then Apply now for prefill.";
  if (surfaceRisk === "linkedin" || surfaceRisk === "indeed") {
    recommendation =
      "Social surface — draft answers ready; you must submit manually.";
  } else if (avgOverall >= 75 && readyCount >= withValue.length * 0.7) {
    recommendation =
      "Form package looks solid for this ATS — prefill and confirm legal fields.";
  } else if (avgOverall < 60) {
    recommendation =
      "Several weak fields — expand profile or edit open-ended answers before apply.";
  }

  return {
    surface,
    answers,
    filledFormData,
    eval: {
      avgAts: Math.round(avgAts),
      avgHuman: Math.round(avgHuman),
      avgOverall: Math.round(avgOverall),
      fieldCount: withValue.length,
      readyCount,
      reviewCount,
      recommendation,
    },
  };
}
