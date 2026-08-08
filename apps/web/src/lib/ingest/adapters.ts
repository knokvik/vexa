import type { JobListing } from "@vexa/shared";

/**
 * Job discovery adapters.
 * Production: Firecrawl (primary), Exa (semantic), Bright Data (protected public pages).
 * Never used for application submission.
 */

export interface IngestAdapter {
  name: string;
  fetchJobs(query: string): Promise<JobListing[]>;
}

/** Greenhouse board JSON (public, low risk). */
export async function fetchGreenhouseBoard(
  boardToken: string
): Promise<Partial<JobListing>[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    jobs?: Array<{
      id: number;
      title: string;
      absolute_url: string;
      location?: { name?: string };
      content?: string;
    }>;
  };
  return (data.jobs ?? []).map((j) => ({
    id: `gh_${boardToken}_${j.id}`,
    source: "greenhouse" as const,
    sourceId: String(j.id),
    externalUrl: j.absolute_url,
    title: j.title,
    company: boardToken,
    location: {
      raw: j.location?.name,
      remote: /remote/i.test(j.location?.name ?? ""),
    },
    description: (j.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 5000),
    requirements: [],
    responsibilities: [],
    skillsRequired: [],
    employmentType: "full-time" as const,
    experienceLevel: "unknown" as const,
    status: "active" as const,
    scrapedAt: new Date().toISOString(),
  }));
}

/** Lever public postings JSON (no auth). company slug from jobs.lever.co/{slug} */
export async function fetchLeverBoard(
  companySlug: string
): Promise<Partial<JobListing>[]> {
  const slug = companySlug.trim().toLowerCase();
  if (!slug) return [];
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      id: string;
      text: string;
      hostedUrl?: string;
      applyUrl?: string;
      categories?: { location?: string; team?: string; commitment?: string };
      descriptionPlain?: string;
      description?: string;
      createdAt?: number;
    }>;
    if (!Array.isArray(data)) return [];
    return data.map((j) => {
      const loc = j.categories?.location || "";
      const desc =
        j.descriptionPlain ||
        (j.description || "").replace(/<[^>]+>/g, " ").slice(0, 5000);
      return {
        id: `lever_${slug}_${j.id}`,
        source: "lever" as const,
        sourceId: j.id,
        externalUrl: j.hostedUrl || j.applyUrl || `https://jobs.lever.co/${slug}/${j.id}`,
        title: j.text,
        company: slug,
        location: {
          raw: loc,
          remote: /remote/i.test(loc),
        },
        description: desc,
        requirements: [],
        responsibilities: [],
        skillsRequired: [],
        employmentType: "full-time" as const,
        experienceLevel: "unknown" as const,
        status: "active" as const,
        scrapedAt: new Date().toISOString(),
        postedAt: j.createdAt
          ? new Date(j.createdAt).toISOString()
          : undefined,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Public boards we can hit via official JSON (no login, hard to block).
 * Prefer these over LinkedIn/Indeed for apply packages + prefill.
 * Tokens/slugs are board ids, not display names.
 */
export const WELL_KNOWN_GREENHOUSE = [
  "stripe",
  "airbnb",
  "figma",
  "discord",
  "notion",
  "cloudflare",
  "datadog",
  "robinhood",
  "coinbase",
  "reddit",
  "dropbox",
  "airtable",
  "anthropic",
  "openai",
  "ramp",
] as const;

export const WELL_KNOWN_LEVER = [
  "netflix",
  "palantir",
  "twitch",
  "spotify",
  "shopify",
  "netlify",
  "vercel",
] as const;

/**
 * Fetch known public boards when tokens/slugs appear in a query or URL list.
 * Preferred over scraping — official read-only APIs (anti-block path).
 */
export async function fetchOfficialBoards(hints: {
  greenhouseTokens?: string[];
  leverSlugs?: string[];
}): Promise<Partial<JobListing>[]> {
  const out: Partial<JobListing>[] = [];
  const gh = [...new Set(hints.greenhouseTokens || [])].slice(0, 12);
  const lv = [...new Set(hints.leverSlugs || [])].slice(0, 10);
  await Promise.all([
    ...gh.map(async (t) => {
      try {
        const jobs = await fetchGreenhouseBoard(t);
        out.push(...jobs);
      } catch {
        /* ignore board */
      }
    }),
    ...lv.map(async (s) => {
      try {
        const jobs = await fetchLeverBoard(s);
        out.push(...jobs);
      } catch {
        /* ignore */
      }
    }),
  ]);
  return out;
}

/** Extract board tokens from free text / URLs + optional well-known seed */
export function extractBoardHints(
  text: string,
  opts?: { seedWellKnown?: boolean; maxWellKnown?: number }
): {
  greenhouseTokens: string[];
  leverSlugs: string[];
} {
  const greenhouseTokens = new Set<string>();
  const leverSlugs = new Set<string>();
  const gh =
    text.matchAll(
      /(?:boards(?:-api)?\.greenhouse\.io|greenhouse\.io)\/([a-zA-Z0-9_-]+)/gi
    );
  for (const m of gh)
    if (m[1] && m[1] !== "v1" && m[1] !== "embed") greenhouseTokens.add(m[1]);
  const lv = text.matchAll(/(?:jobs\.)?lever\.co\/([a-zA-Z0-9_-]+)/gi);
  for (const m of lv) if (m[1] && m[1] !== "v0") leverSlugs.add(m[1]);
  // bare tokens: "greenhouse:stripe" or "lever:netflix"
  const bareGh = text.matchAll(/greenhouse[:\s]+([a-zA-Z0-9_-]+)/gi);
  for (const m of bareGh) greenhouseTokens.add(m[1]);
  const bareLv = text.matchAll(/lever[:\s]+([a-zA-Z0-9_-]+)/gi);
  for (const m of bareLv) leverSlugs.add(m[1]);

  // Company name matches common boards (stripe, figma, …)
  const lower = text.toLowerCase();
  for (const t of WELL_KNOWN_GREENHOUSE) {
    if (lower.includes(t)) greenhouseTokens.add(t);
  }
  for (const s of WELL_KNOWN_LEVER) {
    if (lower.includes(s)) leverSlugs.add(s);
  }

  // Seed a rotating subset of well-known boards so eng queries always hit ATS APIs
  if (opts?.seedWellKnown && greenhouseTokens.size === 0 && leverSlugs.size === 0) {
    const n = opts.maxWellKnown ?? 6;
    const day = Math.floor(Date.now() / 86400000);
    for (let i = 0; i < n; i++) {
      const t = WELL_KNOWN_GREENHOUSE[(day + i) % WELL_KNOWN_GREENHOUSE.length];
      greenhouseTokens.add(t);
    }
    for (let i = 0; i < Math.min(3, n); i++) {
      const s = WELL_KNOWN_LEVER[(day + i) % WELL_KNOWN_LEVER.length];
      leverSlugs.add(s);
    }
  }

  return {
    greenhouseTokens: [...greenhouseTokens].slice(0, 12),
    leverSlugs: [...leverSlugs].slice(0, 10),
  };
}

/** Filter board jobs by free-text query tokens (title/description). */
export function filterJobsByQuery<
  T extends { title?: string; description?: string; company?: string },
>(jobs: T[], query: string, limit = 20): T[] {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9+#]+/i)
    .filter(
      (t) =>
        t.length > 1 &&
        !["and", "the", "for", "with", "job", "jobs", "role", "remote", "senior"].includes(
          t
        )
    );
  if (!tokens.length) return jobs.slice(0, limit);
  return jobs
    .map((j) => {
      const hay = `${j.title || ""} ${j.company || ""} ${j.description || ""}`.toLowerCase();
      let score = 0;
      for (const t of tokens) if (hay.includes(t)) score += 1;
      // Boost exact title hits
      if (tokens.some((t) => (j.title || "").toLowerCase().includes(t))) score += 2;
      return { j, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.j);
}

/**
 * Firecrawl placeholder — wired in discover.ts when key present.
 */
export async function fetchViaFirecrawl(
  searchQuery: string
): Promise<Partial<JobListing>[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  void searchQuery;
  void key;
  return [];
}

export function normalizeJob(
  partial: Partial<JobListing> &
    Pick<JobListing, "id" | "title" | "company" | "externalUrl">
): JobListing {
  return {
    source: partial.source ?? "manual",
    sourceId: partial.sourceId,
    description: partial.description ?? "",
    requirements: partial.requirements ?? [],
    responsibilities: partial.responsibilities ?? [],
    skillsRequired: partial.skillsRequired ?? [],
    location: partial.location ?? { remote: false },
    employmentType: partial.employmentType ?? "unknown",
    experienceLevel: partial.experienceLevel ?? "unknown",
    status: partial.status ?? "active",
    scrapedAt: partial.scrapedAt ?? new Date().toISOString(),
    salary: partial.salary,
    postedAt: partial.postedAt,
    expiresAt: partial.expiresAt,
    easyApply: partial.easyApply,
    id: partial.id,
    title: partial.title,
    company: partial.company,
    externalUrl: partial.externalUrl,
  };
}
