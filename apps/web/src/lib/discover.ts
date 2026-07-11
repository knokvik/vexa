/**
 * Priority job discovery with quality filters.
 * Rejects search-result list pages; prefers real job post URLs.
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
  rawCount?: number;
  /** Per-provider counts after quality filter */
  providers: { firecrawl: number; exa: number };
};

function env(name: string): string {
  return (process.env[name] || "").trim();
}

/** List/search pages that are NOT a single job post */
function isJunkListing(title?: string, url?: string): boolean {
  const t = (title || "").toLowerCase();
  const u = (url || "").toLowerCase();

  if (/^\d[\d,+.\s]*k?\+?\s/.test(t)) return true; // "39,000+ jobs..."
  if (/\b(best|top)\b.+\bjobs?\b/.test(t)) return true;
  if (/\bjobs?\s+in\s+/.test(t) && !/engineer|developer|designer|manager|analyst/i.test(t.split(/jobs?\s+in/i)[0] || "")) {
    // "Frontend Engineer jobs in NYC" OK-ish; "jobs in United States" junk
    if (/united states|remote jobs|now hiring|apply now/i.test(t)) return true;
  }
  if (/jobs?\s*[–\-]\s*apply/i.test(t)) return true;
  if (/^\d[\d,]+\s+frontend/i.test(t)) return true;

  // URL patterns that are search indexes, not posts
  if (/indeed\.com\/q-/.test(u)) return true;
  if (/indeed\.com\/.*\?q=/.test(u)) return true;
  if (/linkedin\.com\/jobs\/search/.test(u)) return true;
  if (/linkedin\.com\/jobs\/collections/.test(u)) return true;
  if (/wellfound\.com\/role\//.test(u) && !/wellfound\.com\/jobs\//.test(u)) {
    // role index pages
    if (!/\/jobs\/\d/.test(u)) return true;
  }
  if (/builtin\w*\.com\/jobs\/dev-engineering\/?$/.test(u)) return true;
  if (/startup\.jobs\/roles\//.test(u)) return true;

  return false;
}

function looksLikeJobPost(title?: string, url?: string): boolean {
  if (isJunkListing(title, url)) return false;
  const u = (url || "").toLowerCase();
  // Positive signals
  if (/greenhouse\.io\/.*\/jobs\/\d+/.test(u)) return true;
  if (/lever\.co\/.+\/[a-f0-9-]{8,}/i.test(u)) return true;
  if (/ashbyhq\.com\/.+\/[a-f0-9-]{8,}/i.test(u)) return true;
  if (/linkedin\.com\/jobs\/view\//.test(u)) return true;
  if (/\/careers\/.+/.test(u) && !/\/careers\/?$/.test(u)) return true;
  if (/\/jobs\/.+/.test(u) && !/\/jobs\/?$/.test(u) && !/\/jobs\/search/.test(u)) {
    return true;
  }
  // Title looks like a role
  if (/\b(engineer|developer|designer|manager|scientist|analyst|director|lead)\b/i.test(title || "")) {
    if (!isJunkListing(title, url)) return true;
  }
  return false;
}

async function firecrawlSearch(
  query: string,
  limit = 5
): Promise<
  Array<{ url?: string; title?: string; description?: string; markdown?: string }>
> {
  const key = env("FIRECRAWL_API_KEY");
  if (!key) throw new Error("FIRECRAWL_API_KEY missing");

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
    throw new Error(`Firecrawl ${res.status}: ${t.slice(0, 180)}`);
  }

  const data = (await res.json()) as {
    success?: boolean;
    data?: Array<{
      url?: string;
      title?: string;
      description?: string;
      markdown?: string;
    }>;
    web?: Array<{ url?: string; title?: string; description?: string }>;
  };

  // Support both shapes Firecrawl may return
  const rows = data.data ?? data.web ?? [];
  return rows;
}

/**
 * Exa is strongest for semantic “meaning” search.
 * We use a precise natural-language query + text contents for ranking.
 */
async function exaSearch(
  query: string,
  num = 6,
  mode: "semantic" | "strict" = "semantic"
): Promise<
  Array<{
    title?: string;
    url?: string;
    text?: string;
    publishedDate?: string;
    score?: number;
  }>
> {
  const key = env("EXA_API_KEY");
  if (!key) throw new Error("EXA_API_KEY missing");

  // Natural language beats keyword soup for Exa
  const semanticQuery =
    mode === "semantic"
      ? `Open job postings for: ${query}. Prefer official career pages or ATS boards (Greenhouse, Lever, Ashby) with a single role, not job search indexes.`
      : query;

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: semanticQuery,
      num_results: num,
      type: "auto",
      use_autoprompt: true,
      contents: { text: { max_characters: 900 } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Exa ${res.status}: ${t.slice(0, 180)}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      title?: string;
      url?: string;
      text?: string;
      publishedDate?: string;
      score?: number;
    }>;
  };
  return data.results ?? [];
}

/** Score a candidate against the user query — backbone of “best results”. */
function scoreAgainstQuery(
  query: string,
  job: {
    title?: string;
    company?: string;
    url?: string;
    text?: string;
    source?: string;
  }
): number {
  const q = query.toLowerCase();
  const tokens = q
    .split(/[^a-z0-9+#]+/i)
    .filter((t) => t.length > 1 && !["and", "the", "for", "with", "job", "jobs", "role"].includes(t));
  const hay = `${job.title || ""} ${job.company || ""} ${job.text || ""}`.toLowerCase();
  const url = (job.url || "").toLowerCase();

  let score = 0;
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) {
      hits += 1;
      // Title matches weigh more
      if ((job.title || "").toLowerCase().includes(t)) score += 3;
      else score += 1;
    }
  }
  if (tokens.length) score += (hits / tokens.length) * 4;

  // URL quality boosts
  if (/greenhouse\.io\/.+\/jobs\/\d+/.test(url)) score += 5;
  if (/lever\.co\/.+\/[a-f0-9-]{8,}/.test(url)) score += 5;
  if (/ashbyhq\.com\/.+\/[a-f0-9-]{8,}/.test(url)) score += 5;
  if (/\/careers\/[^/]+/.test(url)) score += 4;
  if (/linkedin\.com\/jobs\/view\//.test(url)) score += 3;
  if (/openai\.com|stripe\.com|uber\.com|adobe\.com|figma\.com|notion\.so/.test(url))
    score += 2;

  // Penalties
  if (isJunkListing(job.title, job.url)) score -= 20;
  if (/indeed\.com\/q-/.test(url)) score -= 15;
  if ((job.text || "").length < 40) score -= 1;
  if ((job.text || "").length > 200) score += 1;

  // Exa semantic hits slightly preferred for company discovery
  if (job.source === "exa") score += 0.5;

  return score;
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
  query: string
): JobListing {
  const desc = (r.markdown || r.description || r.text || "").slice(0, 4000);
  return normalizeJob({
    id: `${prefix}_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
    source,
    title: cleanTitle(r.title, query),
    company: guessCompany(r.title, r.url),
    externalUrl: r.url || `https://example.com/job/${prefix}/${i}`,
    description: desc || "Open the link for full description.",
    location: { remote: /remote/i.test(`${r.title} ${desc}`) },
    skillsRequired: extractSkillsLite(desc),
    requirements: [],
    responsibilities: [],
    employmentType: "full-time",
    experienceLevel: /senior|staff|principal/i.test(`${r.title}`)
      ? "senior"
      : "mid",
    status: "active",
    postedAt: r.publishedDate,
    scrapedAt: new Date().toISOString(),
  });
}

function cleanTitle(title: string | undefined, query: string): string {
  if (!title) return query;
  return title.replace(/\s*[|\-–].{10,}$/, "").trim().slice(0, 120);
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
      const parts = host.split(".");
      const part = parts.length > 2 ? parts[parts.length - 2] : parts[0];
      const skip = new Set([
        "linkedin",
        "indeed",
        "glassdoor",
        "wellfound",
        "jobs",
        "careers",
        "greenhouse",
        "lever",
        "boards",
        "job-boards",
      ]);
      if (part && !skip.has(part)) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
      // greenhouse.io/company/jobs/id
      if (/greenhouse\.io/i.test(host)) {
        const m = url.match(/greenhouse\.io\/([^/]+)/i);
        if (m?.[1] && m[1] !== "jobs") return m[1];
      }
      if (/lever\.co/i.test(host)) {
        const m = url.match(/lever\.co\/([^/]+)/i);
        if (m?.[1]) return m[1];
      }
    } catch {
      /* ignore */
    }
  }
  return title?.split(/[-|@·]/)[0]?.trim().slice(0, 40) || "Company";
}

function isLinkedInUrl(url?: string) {
  return !!url && /linkedin\.com/i.test(url);
}

function classifyTier(url?: string): DiscoverTier {
  if (isLinkedInUrl(url)) return "linkedin";
  if (
    url &&
    /indeed\.|glassdoor\.|wellfound\.|angel\.co|greenhouse\.io|lever\.co|ashbyhq\.|workday\.|myworkdayjobs\.|jobvite\.|smartrecruiters\./i.test(
      url
    )
  ) {
    return "portal";
  }
  return "company";
}

/** Run one priority tier */
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
      // Firecrawl: keyword/web search strengths
      fcQ: `${query} careers "apply" job -site:linkedin.com -site:indeed.com -site:glassdoor.com`,
      // Exa: semantic — “find real open roles”
      exaQ: query,
    },
    portal: {
      label: "Job portals",
      priority: 2,
      fcQ: `${query} (site:boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com)`,
      exaQ: `${query} greenhouse OR lever OR ashby job posting`,
    },
    linkedin: {
      label: "LinkedIn & protected",
      priority: 3,
      fcQ: `${query} site:linkedin.com/jobs/view`,
      exaQ: `${query} linkedin.com/jobs/view`,
    },
  };

  const m = meta[tier];
  const errors: string[] = [];
  let raw: Array<{
    url?: string;
    title?: string;
    description?: string;
    markdown?: string;
    text?: string;
    publishedDate?: string;
    score?: number;
    _src: JobSource;
  }> = [];

  // Backbone: search both, then rank — Exa semantic first for company tier
  const [fcResult, exResult] = await Promise.allSettled([
    firecrawlSearch(m.fcQ, tier === "linkedin" ? 4 : 6),
    exaSearch(
      m.exaQ,
      tier === "linkedin" ? 4 : 6,
      tier === "company" ? "semantic" : "strict"
    ),
  ]);

  if (fcResult.status === "fulfilled") {
    raw.push(
      ...fcResult.value.map((r) => ({ ...r, _src: "firecrawl" as JobSource }))
    );
  } else {
    errors.push(`firecrawl: ${fcResult.reason?.message || fcResult.reason}`);
  }

  if (exResult.status === "fulfilled") {
    raw.push(
      ...exResult.value.map((r) => ({ ...r, _src: "exa" as JobSource }))
    );
  } else {
    errors.push(`exa: ${exResult.reason?.message || exResult.reason}`);
  }

  const rawCount = raw.length;

  // Keep only this tier + quality
  raw = raw.filter((r) => {
    if (!r.url) return false;
    if (!looksLikeJobPost(r.title, r.url)) return false;
    const c = classifyTier(r.url);
    if (tier === "company") return c === "company";
    if (tier === "portal") return c === "portal" || c === "company";
    return c === "linkedin" || /jobs\/view/i.test(r.url);
  });

  // If quality filter wiped everything, fall back to non-junk only
  if (raw.length === 0 && rawCount > 0) {
    // re-fetch from settled results without tier classify, only junk filter
    const again: typeof raw = [];
    if (fcResult.status === "fulfilled") {
      again.push(
        ...fcResult.value
          .filter((r) => r.url && !isJunkListing(r.title, r.url))
          .map((r) => ({ ...r, _src: "firecrawl" as JobSource }))
      );
    }
    if (exResult.status === "fulfilled") {
      again.push(
        ...exResult.value
          .filter((r) => r.url && !isJunkListing(r.title, r.url))
          .map((r) => ({ ...r, _src: "exa" as JobSource }))
      );
    }
    raw = again.slice(0, 6);
  }

  // Rank: go over raw results and keep the best matches for the query
  const ranked = raw
    .map((r) => ({
      r,
      score: scoreAgainstQuery(query, {
        title: r.title,
        url: r.url,
        text: r.markdown || r.description || r.text,
        source: r._src,
      }),
    }))
    .filter((x) => x.score > 2) // drop weak matches
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const jobs: JobListing[] = [];
  const providers = { firecrawl: 0, exa: 0 };
  ranked.forEach(({ r }, i) => {
    const url = r.url!;
    if (seen.has(url)) return;
    seen.add(url);
    if (r._src === "firecrawl") providers.firecrawl += 1;
    if (r._src === "exa") providers.exa += 1;
    jobs.push(toJob(r, r._src, `${r._src}_${tier}`, i, query));
  });

  // Cap per tier so UI stays sharp
  const capped = jobs.slice(0, 8);

  return {
    tier,
    label: m.label,
    priority: m.priority,
    jobs: capped,
    rawCount,
    providers: {
      firecrawl: capped.filter((j) => j.source === "firecrawl").length,
      exa: capped.filter((j) => j.source === "exa").length,
    },
    durationMs: Date.now() - started,
    error: errors.length && !capped.length ? errors.join("; ") : undefined,
  };
}

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
