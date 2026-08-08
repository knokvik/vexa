/**
 * Job intelligence scan — main "Apply" research feature.
 * 1) Parse what the job mentions
 * 2) Search people / projects at that company (Exa + Firecrawl)
 * 3) Compare to current user profile → ready | waiting (gaps)
 */

import type { JobListing, Profile } from "@vexa/shared";

export type IntelPerson = {
  name: string;
  role?: string;
  snippet: string;
  url?: string;
  signals: string[];
};

export type IntelProject = {
  title: string;
  description: string;
  url?: string;
  source?: string;
};

export type SkillGap = {
  skill: string;
  have: boolean;
  strength?: string;
};

export type JobIntel = {
  jobId: string;
  company: string;
  title: string;
  externalUrl: string;
  mentions: {
    skills: string[];
    requirements: string[];
    keywords: string[];
    seniority?: string;
  };
  people: IntelPerson[];
  projects: IntelProject[];
  experienceSignals: string[];
  gaps: SkillGap[];
  /** ready = enough overlap; waiting = user lacks key signals */
  readiness: "ready" | "waiting";
  waitingReasons: string[];
  sourcesUsed: string[];
  durationMs: number;
};

function env(name: string) {
  return (process.env[name] || "").trim();
}

const SKILL_BANK = [
  "React",
  "TypeScript",
  "JavaScript",
  "Node",
  "Node.js",
  "Python",
  "Go",
  "Rust",
  "Java",
  "AWS",
  "GCP",
  "Azure",
  "GraphQL",
  "Next.js",
  "Vue",
  "Angular",
  "Kubernetes",
  "Docker",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "System Design",
  "CI/CD",
  "Tailwind",
  "CSS",
  "HTML",
  "Machine Learning",
  "LLM",
  "Figma",
];

function extractSkills(text: string): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const s of SKILL_BANK) {
    if (lower.includes(s.toLowerCase())) found.push(s);
  }
  return [...new Set(found)].slice(0, 16);
}

function extractRequirements(text: string): string[] {
  const lines = text
    .split(/[\n•\-\*]/)
    .map((l) => l.trim())
    .filter((l) => l.length > 20 && l.length < 180);
  const reqish = lines.filter((l) =>
    /\d\+?\s*years|experience|proficien|require|must|strong|expert|bachelor|degree|familiar/i.test(
      l
    )
  );
  return (reqish.length ? reqish : lines).slice(0, 8);
}

function detectSeniority(text: string): string {
  const t = text.toLowerCase();
  if (/staff|principal|distinguished/.test(t)) return "staff+";
  if (/senior|sr\.|lead/.test(t)) return "senior";
  if (/junior|entry|associate|intern/.test(t)) return "junior";
  return "mid";
}

async function exaSearch(
  query: string,
  num = 5
): Promise<Array<{ title?: string; url?: string; text?: string }>> {
  const key = env("EXA_API_KEY");
  if (!key) return [];
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      num_results: num,
      type: "auto",
      use_autoprompt: true,
      contents: { text: { max_characters: 500 } },
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; text?: string }>;
  };
  return data.results ?? [];
}

async function firecrawlSearch(
  query: string,
  limit = 4
): Promise<Array<{ title?: string; url?: string; description?: string; markdown?: string }>> {
  const key = env("FIRECRAWL_API_KEY");
  if (!key) return [];
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit,
      lang: "en",
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<{
      title?: string;
      url?: string;
      description?: string;
      markdown?: string;
    }>;
  };
  return data.data ?? [];
}

function parsePeople(
  rows: Array<{ title?: string; url?: string; text?: string }>
): IntelPerson[] {
  const people: IntelPerson[] = [];
  for (const r of rows) {
    const title = r.title || "";
    // Skip pure job posts
    if (/hiring|jobs? opening|careers|apply now/i.test(title) && !/linkedin\.com\/in\//i.test(r.url || "")) {
      if (!/at\s+\w+/i.test(title)) continue;
    }
    const nameMatch =
      title.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*[-–|,]/) ||
      title.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:is|was|worked)/i);
    const name =
      nameMatch?.[1] ||
      (title.includes(" - ") ? title.split(" - ")[0] : title).slice(0, 48);
    const text = r.text || "";
    const signals = extractSkills(text + " " + title);
    people.push({
      name: name.trim() || "Engineer",
      role: title.slice(0, 80),
      snippet: text.slice(0, 220) || title,
      url: r.url,
      signals: signals.slice(0, 6),
    });
  }
  // dedupe by name
  const seen = new Set<string>();
  return people
    .filter((p) => {
      const k = p.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 6);
}

function parseProjects(
  rows: Array<{ title?: string; url?: string; text?: string; description?: string; markdown?: string }>
): IntelProject[] {
  return rows
    .filter((r) => {
      const t = `${r.title} ${r.url}`.toLowerCase();
      return (
        /github|project|case study|portfolio|blog|engineering|built|launched|shipped/.test(
          t
        ) || (r.text || "").length > 80
      );
    })
    .map((r) => ({
      title: (r.title || "Project / write-up").slice(0, 100),
      description: (r.text || r.description || r.markdown || "").slice(0, 280),
      url: r.url,
      source: r.url?.includes("github") ? "github" : "web",
    }))
    .slice(0, 6);
}

function compareGaps(profile: Profile, needed: string[]): SkillGap[] {
  const have = new Set(
    [
      ...profile.skills.map((s) => s.name.toLowerCase()),
      ...(profile.summary || "").toLowerCase().split(/\W+/),
      ...profile.experiences.flatMap((e) =>
        `${e.title} ${e.description} ${(e.achievements || []).join(" ")}`.toLowerCase().split(/\W+/)
      ),
    ].filter(Boolean)
  );

  return needed.map((skill) => {
    const key = skill.toLowerCase();
    const hit =
      have.has(key) ||
      [...have].some((h) => h.includes(key) || key.includes(h));
    const prof = profile.skills.find(
      (s) => s.name.toLowerCase() === key
    )?.proficiency;
    return {
      skill,
      have: hit,
      strength: hit ? prof || "mentioned" : undefined,
    };
  });
}

/**
 * Full intel scan for a job. Uses Exa (people/projects) + Firecrawl (company signals).
 */
export async function scanJobIntel(
  job: JobListing,
  profile: Profile
): Promise<JobIntel> {
  const started = Date.now();
  const company = job.company || "Company";
  const title = job.title || "Role";
  const blob = `${title}\n${job.description || ""}\n${(job.requirements || []).join("\n")}\n${(job.skillsRequired || []).join(" ")}`;

  const skills = [
    ...new Set([...extractSkills(blob), ...(job.skillsRequired || [])]),
  ].slice(0, 14);
  const requirements = extractRequirements(blob);
  const keywords = extractSkills(blob).slice(0, 10);
  const seniority = detectSeniority(blob);

  const sourcesUsed: string[] = [];

  // Parallel research: people + recruiters/HR + projects + company engineering
  const [peopleExa, hrExa, projectsExa, engFc, engExa] = await Promise.all([
    exaSearch(
      `${company} ${title.split(/[,(]/)[0]} engineer OR developer experience portfolio OR "worked on" OR github`,
      5
    ).then((r) => {
      if (r.length) sourcesUsed.push("exa:people");
      return r;
    }),
    // Talent / recruiting / hiring manager — cold email targets (not auto-messaged)
    exaSearch(
      `${company} (recruiter OR "talent acquisition" OR "technical recruiter" OR "hiring manager" OR "people partner") ${title.split(/[,(]/)[0]}`,
      5
    ).then((r) => {
      if (r.length) sourcesUsed.push("exa:recruiters");
      return r;
    }),
    exaSearch(
      `${company} engineering project OR "case study" OR "how we built" OR blog open source`,
      5
    ).then((r) => {
      if (r.length) sourcesUsed.push("exa:projects");
      return r;
    }),
    firecrawlSearch(
      `${company} engineering blog OR careers tech stack ${title.split(" ")[0]}`,
      3
    ).then((r) => {
      if (r.length) sourcesUsed.push("firecrawl:company");
      return r;
    }),
    exaSearch(`${company} software engineer typical experience projects`, 4),
  ]);

  const people = parsePeople([
    ...hrExa.map((r) => ({
      ...r,
      title: r.title?.includes("Recruit") || r.title?.includes("Talent")
        ? r.title
        : `${r.title || "Recruiter"} — Talent`,
    })),
    ...peopleExa,
    ...engExa.filter((r) => /linkedin\.com\/in\//i.test(r.url || "")),
  ]);

  const projects = parseProjects([
    ...projectsExa,
    ...engFc.map((r) => ({
      title: r.title,
      url: r.url,
      text: r.markdown || r.description,
    })),
    ...engExa,
  ]);

  // Experience signals from people + projects
  const experienceSignals = [
    ...new Set([
      ...people.flatMap((p) => p.signals),
      ...projects.flatMap((p) => extractSkills(p.description + " " + p.title)),
      ...skills,
    ]),
  ].slice(0, 12);

  const gaps = compareGaps(profile, skills.length ? skills : experienceSignals.slice(0, 8));
  const missingCritical = gaps.filter((g) => !g.have);
  const missingRatio =
    gaps.length === 0 ? 0 : missingCritical.length / gaps.length;

  const waitingReasons: string[] = [];
  if (missingCritical.length >= 3 || missingRatio >= 0.5) {
    waitingReasons.push(
      `Missing ${missingCritical.length} skills the role mentions: ${missingCritical
        .slice(0, 5)
        .map((g) => g.skill)
        .join(", ")}`
    );
  }
  if (seniority === "staff+" && (profile.yearsExperience || 0) < 8) {
    waitingReasons.push(
      `Role looks staff-level; profile has ~${profile.yearsExperience ?? 0} years`
    );
  }
  if (!profile.experiences?.length) {
    waitingReasons.push("No work experience on your profile yet");
  }
  if (people.length === 0 && projects.length === 0) {
    waitingReasons.push(
      "Thin company research — try again or open the job link for more context"
    );
  }

  const readiness: "ready" | "waiting" =
    waitingReasons.length > 0 && missingCritical.length >= 2
      ? "waiting"
      : waitingReasons.filter((w) => w.startsWith("Missing")).length > 0 &&
          missingRatio >= 0.45
        ? "waiting"
        : "ready";

  // Soft: if only mild gaps, still ready
  const finalReadiness =
    readiness === "waiting" && missingCritical.length <= 1 ? "ready" : readiness;

  return {
    jobId: job.id,
    company,
    title,
    externalUrl: job.externalUrl,
    mentions: {
      skills,
      requirements,
      keywords,
      seniority,
    },
    people,
    projects,
    experienceSignals,
    gaps,
    readiness: finalReadiness,
    waitingReasons:
      finalReadiness === "waiting"
        ? waitingReasons
        : missingCritical.length
          ? [
              `Optional gaps (not blocking): ${missingCritical
                .map((g) => g.skill)
                .join(", ")}`,
            ]
          : [],
    sourcesUsed: [...new Set(sourcesUsed)],
    durationMs: Date.now() - started,
  };
}
