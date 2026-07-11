/**
 * Priority job discovery:
 *  1) company / career web pages (highest)
 *  2) job portals (Greenhouse, Lever, Indeed-style, Wellfound…)
 *  3) LinkedIn / protected portals (last — slower / costlier)
 */

import type { JobListing, JobSource } from "@vexa/shared";
import { normalizeJob } from "./ingest/adapters";

export type DiscoverTier = "company" | "portal" | "linkedin";

export type TierResult = {
  tier: DiscoverTier;
  label: string;
  priority: number;
  jobs: JobListing[];
  error?: string;
  durationMs: number;
};

function env(name: string): string {
  return (process.env[name] || "").trim();
}

const PORTAL_HOSTS =
  /linkedin\.|indeed\.|glassdoor\.|wellfound\.|angel\.co|lever\.co|greenhouse\.io|ashbyhq\.com|workday\.|myworkdayjobs\.|jobs\.|careers\.|boards\.|jobvite\.|smartrecruiters\.|bamboohr\./i;

function isPortalUrl(url?: string): boolean {
  if (!url) return false;
  try {
    return PORTAL_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function isLinkedInUrl(url?: string): boolean {
  if (!url) return false;
  return /linkedin\.com/i.test(url);
}

function isCompanyCareerUrl(url?: string): boolean {
  if (!url) return false;
  if (isLinkedInUrl(url) || isPortalUrl(url)) {
    // greenhouse/lever company boards still count as "portal" tier
    // pure company domain careers/* is company tier
    try {
      const host = new URL(url).hostname;
      if (/greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com/i.test(host)) {
        return false;
      }
      if (/linkedin\.|indeed\.|glassdoor\.|wellfound\./i.test(host)) {
        return false;
      }
      return /careers|jobs|join|hiring|work-with|about\/jobs/i.test(url);
    } catch {
      return false;
    }
  }
  return /careers|jobs|join|hiring/i.test(url);
}

async function firecrawlSearch(
  query: string,
  limit = 4
): Promise<Array<{ url?: string; title?: string; description?: string; markdown?: string }>> {
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
      country: "us",
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Firecrawl ${res.status}: ${t.slice(0, 160)}`);
  }

  const data = (await res.json()) as {
    data?: Array<{
      url?: string;
      title?: string;
      description?: string;
      markdown?: string;
    }>;
  };
  return data.data ?? [];
}

async function exaSearch(
  query: string,
  num = 4
): Promise<
  Array<{ title?: string; url?: string; text?: string; publishedDate?: string }>
> {
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
      contents: { text: { max_characters: 600 } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Exa ${res.status}: ${t.slice(0, 160)}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      text?: string;
      publishedDate?: string;
    }>;
  };
  return data.results ?? [];
}

function toJob(
  r: {
    url?: string;
    title?: string;
    description?: string;
    markdown?: string;
    text?: string;
    publishedDate?: string;
  },
  source: JobSource,
  prefix: string,
  i: number,
  query: string,
  priority: number
): JobListing {
  const desc = (r.markdown || r.description || r.text || "").slice(0, 4000);
  return normalizeJob({
    id: `${prefix}_${Date.now()}_${i}`,
    source,
    title: cleanTitle(r.title, query),
    company: guessCompany(r.title, r.url),
    externalUrl: r.url || `https://example.com/job/${prefix}/${i}`,
    description: desc,
    location: { remote: /remote/i.test(`${r.title} ${desc}`) },
    skillsRequired: extractSkillsLite(desc),
    requirements: [],
    responsibilities: [],
    employmentType: "full-time",
    experienceLevel: /senior|staff|principal/i.test(`${r.title} ${desc}`)
      ? "senior"
      : "unknown",
    status: "active",
    postedAt: r.publishedDate,
    scrapedAt: new Date().toISOString(),
    // stash priority in easyApply-unused? use metadata via description — better add nothing illegal
  }) as JobListing & { _priority?: number };
}

function cleanTitle(title: string | undefined, query: string): string {
  if (!title) return query;
  return title.replace(/\s*[|\-–].{0,40}$/, "").slice(0, 120);
}

function extractSkillsLite(text: string): string[] {
  const skills = [
    "React",
    "TypeScript",
    "JavaScript",
    "Node",
    "Python",
    "Go",
    "AWS",
    "GraphQL",
    "Next.js",
    "Vue",
    "Kubernetes",
    "Docker",
    "SQL",
    "Java",
    "Rust",
  ];
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const s of skills) {
    if (lower.includes(s.toLowerCase())) found.push(s);
  }
  return found.slice(0, 8);
}

function guessCompany(title?: string, url?: string): string {
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const part = host.split(".")[0];
      if (
        part &&
        !["linkedin", "indeed", "glassdoor", "wellfound", "jobs", "careers"].includes(
          part
        )
      ) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
    } catch {
      /* ignore */
    }
  }
  return title?.split(/[-|@·]/)[0]?.trim().slice(0, 40) || "Company";
}

function filterRows(
  rows: Array<{ url?: string; title?: string }>,
  tier: DiscoverTier
) {
  return rows.filter((r) => {
    const url = r.url || "";
    if (tier === "linkedin") return isLinkedInUrl(url);
    if (tier === "portal")
      return isPortalUrl(url) && !isLinkedInUrl(url);
    // company: prefer non-portal career pages; if filter empty keep non-linkedin
    if (isLinkedInUrl(url)) return false;
    if (isPortalUrl(url) && !isCompanyCareerUrl(url)) return false;
    return true;
  });
}

/** Run one priority tier (called sequentially by the live UI). */
export async function discoverTier(
  query: string,
  tier: DiscoverTier
): Promise<TierResult> {
  const started = Date.now();
  const meta: Record<
    DiscoverTier,
    { label: string; priority: number; fcQ: string; exaQ: string }
  > = {
    company: {
      label: "Company career pages",
      priority: 1,
      fcQ: `${query} site careers jobs opening "apply" -linkedin -indeed`,
      exaQ: `${query} company careers page hiring apply`,
    },
    portal: {
      label: "Job portals (Greenhouse, Lever, Indeed…)",
      priority: 2,
      fcQ: `${query} (greenhouse OR lever OR ashby OR wellfound OR indeed) job`,
      exaQ: `${query} job posting greenhouse lever wellfound`,
    },
    linkedin: {
      label: "LinkedIn & protected boards",
      priority: 3,
      fcQ: `${query} site:linkedin.com/jobs`,
      exaQ: `${query} linkedin.com/jobs`,
    },
  };

  const m = meta[tier];
  const jobs: JobListing[] = [];

  try {
    const [fc, ex] = await Promise.all([
      firecrawlSearch(m.fcQ, tier === "linkedin" ? 2 : 4).catch((e) => {
        throw e;
      }),
      exaSearch(m.exaQ, tier === "linkedin" ? 2 : 4).catch(() => []),
    ]);

    const fcFiltered =
      tier === "company"
        ? (() => {
            const f = filterRows(fc, "company");
            // if filter too aggressive, keep non-linkedin rows
            return f.length ? f : fc.filter((r) => !isLinkedInUrl(r.url));
          })()
        : filterRows(fc, tier).length
          ? filterRows(fc, tier)
          : fc.filter((r) =>
              tier === "portal" ? !isLinkedInUrl(r.url) : isLinkedInUrl(r.url)
            );

    const exFiltered =
      tier === "company"
        ? (() => {
            const f = filterRows(ex, "company");
            return f.length ? f : ex.filter((r) => !isLinkedInUrl(r.url));
          })()
        : filterRows(ex, tier).length
          ? filterRows(ex, tier)
          : ex;

    fcFiltered.forEach((r, i) => {
      jobs.push(toJob(r, "firecrawl", `fc_${tier}`, i, query, m.priority));
    });
    exFiltered.forEach((r, i) => {
      jobs.push(toJob(r, "exa", `exa_${tier}`, i, query, m.priority));
    });

    // Dedup within tier
    const seen = new Set<string>();
    const unique = jobs.filter((j) => {
      if (seen.has(j.externalUrl)) return false;
      seen.add(j.externalUrl);
      return true;
    });

    return {
      tier,
      label: m.label,
      priority: m.priority,
      jobs: unique,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      tier,
      label: m.label,
      priority: m.priority,
      jobs: [],
      error: e instanceof Error ? e.message : "tier failed",
      durationMs: Date.now() - started,
    };
  }
}

/** Legacy combined discover (all tiers sequential) */
export async function discoverJobs(query: string): Promise<{
  jobs: JobListing[];
  sources: Record<string, { count: number; error?: string }>;
}> {
  const sources: Record<string, { count: number; error?: string }> = {};
  const jobs: JobListing[] = [];
  for (const tier of ["company", "portal", "linkedin"] as DiscoverTier[]) {
    const r = await discoverTier(query, tier);
    sources[tier] = { count: r.jobs.length, error: r.error };
    jobs.push(...r.jobs);
  }
  const seen = new Set<string>();
  return {
    jobs: jobs.filter((j) => {
      if (seen.has(j.externalUrl)) return false;
      seen.add(j.externalUrl);
      return true;
    }),
    sources,
  };
}

export async function scrapeWithBrightData(
  url: string
): Promise<{ markdown: string; ok: boolean; error?: string }> {
  const key = env("BRIGHT_DATA_API_KEY");
  if (!key) return { markdown: "", ok: false, error: "BRIGHT_DATA_API_KEY missing" };

  try {
    const res = await fetch("https://api.brightdata.com/request", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        zone: "web_unlocker1",
        url,
        format: "raw",
        data_format: "markdown",
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        markdown: "",
        ok: false,
        error: `Bright Data ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    return { markdown: text.slice(0, 8000), ok: true };
  } catch (e) {
    return {
      markdown: "",
      ok: false,
      error: e instanceof Error ? e.message : "Bright Data failed",
    };
  }
}
