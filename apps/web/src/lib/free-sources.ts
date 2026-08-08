/**
 * Zero-cost / freemium discovery + contact sources.
 * Prefer official free APIs & RSS over paid scrapers.
 * Never auto-submits applications.
 */

import type { JobListing } from "@vexa/shared";
import { normalizeJob } from "./ingest/adapters";
import { resolveCompany, cleanJobTitle } from "./job-normalize";
import { buildDiscoveryQuery } from "./query-intent";

export type FreeSourceId =
  | "indeed_rss"
  | "remotive"
  | "arbeitnow"
  | "remoteok"
  | "jobicy"
  | "himalayas"
  | "weworkremotely"
  | "hunter";

export type FreeSourceResult = {
  id: FreeSourceId;
  label: string;
  free: true;
  jobs: JobListing[];
  error?: string;
  durationMs: number;
};

function toJob(partial: {
  id: string;
  title: string;
  company: string;
  url: string;
  description?: string;
  location?: string;
  remote?: boolean;
  source: JobListing["source"];
  postedAt?: string;
}): JobListing {
  const company = resolveCompany({
    company: partial.company,
    title: partial.title,
    url: partial.url,
  });
  return normalizeJob({
    id: partial.id,
    source: partial.source,
    title: cleanJobTitle(partial.title, partial.title),
    company,
    externalUrl: partial.url,
    description: (partial.description || "").slice(0, 4000),
    location: {
      raw: partial.location,
      remote: partial.remote ?? /remote/i.test(partial.location || ""),
    },
    requirements: [],
    responsibilities: [],
    skillsRequired: [],
    employmentType: "full-time",
    experienceLevel: "unknown",
    status: "active",
    postedAt: partial.postedAt,
    scrapedAt: new Date().toISOString(),
  });
}

/** Infer location for Indeed RSS from query tokens (default Remote). */
function inferLocation(query: string): string {
  const q = query.toLowerCase();
  if (/\bremote\b/.test(q)) return "Remote";
  const m = q.match(
    /\b(san francisco|new york|nyc|seattle|austin|boston|chicago|denver|los angeles|london|berlin|toronto|bangalore|hyderabad|pune|mumbai)\b/i
  );
  if (m) {
    const map: Record<string, string> = {
      nyc: "New York, NY",
      "new york": "New York, NY",
      "san francisco": "San Francisco, CA",
      "los angeles": "Los Angeles, CA",
    };
    const key = m[1].toLowerCase();
    return map[key] || m[1].replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "Remote";
}

/** Indeed public RSS — no API key */
export async function fetchIndeedRss(
  query: string,
  location?: string
): Promise<FreeSourceResult> {
  const started = Date.now();
  const id: FreeSourceId = "indeed_rss";
  try {
    const { query: q } = buildDiscoveryQuery(query);
    const loc = location || inferLocation(query);
    const url = `https://www.indeed.com/rss?q=${encodeURIComponent(q)}&l=${encodeURIComponent(loc)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VexaBot/0.1; +https://localhost; job-search)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return {
        id,
        label: "Indeed RSS",
        free: true,
        jobs: [],
        error: `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      };
    }
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 25);
    const jobs: JobListing[] = [];
    let i = 0;
    for (const m of items) {
      const block = m[1];
      const title = decodeXml(
        block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1] ||
          block.match(/<title>(.*?)<\/title>/i)?.[1] ||
          ""
      );
      const link = decodeXml(
        block.match(/<link>(.*?)<\/link>/i)?.[1] ||
          block.match(/<guid[^>]*>(.*?)<\/guid>/i)?.[1] ||
          ""
      );
      const desc = decodeXml(
        block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] ||
          block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ||
          ""
      ).replace(/<[^>]+>/g, " ");
      if (!title || !link) continue;
      // Indeed titles often "Role - Company"
      const parts = title.split(/\s+-\s+/);
      const jobTitle = parts[0] || title;
      const company =
        parts.length > 1 ? parts[parts.length - 1] : "Indeed listing";
      jobs.push(
        toJob({
          id: `indeed_rss_${Date.now()}_${i++}`,
          title: jobTitle,
          company,
          url: link,
          description: desc.slice(0, 2000),
          location: loc,
          remote: /remote/i.test(loc + title),
          source: "indeed",
        })
      );
    }
    return {
      id,
      label: "Indeed RSS",
      free: true,
      jobs,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      id,
      label: "Indeed RSS",
      free: true,
      jobs: [],
      error: e instanceof Error ? e.message : "failed",
      durationMs: Date.now() - started,
    };
  }
}

function decodeXml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** Remotive free remote jobs API — no key */
export async function fetchRemotive(query: string): Promise<FreeSourceResult> {
  const started = Date.now();
  const id: FreeSourceId = "remotive";
  try {
    const { query: q } = buildDiscoveryQuery(query);
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(q)}&limit=20`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return {
        id,
        label: "Remotive",
        free: true,
        jobs: [],
        error: `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      };
    }
    const data = (await res.json()) as {
      jobs?: Array<{
        id: number;
        title?: string;
        company_name?: string;
        url?: string;
        description?: string;
        candidate_required_location?: string;
        publication_date?: string;
      }>;
    };
    const jobs = (data.jobs || []).slice(0, 20).map((j, i) =>
      toJob({
        id: `remotive_${j.id || i}`,
        title: j.title || "Role",
        company: j.company_name || "Company",
        url: j.url || `https://remotive.com/remote-jobs/${j.id}`,
        description: (j.description || "").replace(/<[^>]+>/g, " "),
        location: j.candidate_required_location || "Remote",
        remote: true,
        source: "remotive",
        postedAt: j.publication_date,
      })
    );
    return {
      id,
      label: "Remotive",
      free: true,
      jobs,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      id,
      label: "Remotive",
      free: true,
      jobs: [],
      error: e instanceof Error ? e.message : "failed",
      durationMs: Date.now() - started,
    };
  }
}

/** Arbeitnow free job board API */
export async function fetchArbeitnow(query: string): Promise<FreeSourceResult> {
  const started = Date.now();
  const id: FreeSourceId = "arbeitnow";
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return {
        id,
        label: "Arbeitnow",
        free: true,
        jobs: [],
        error: `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      };
    }
    const data = (await res.json()) as {
      data?: Array<{
        slug?: string;
        title?: string;
        company_name?: string;
        url?: string;
        description?: string;
        location?: string;
        remote?: boolean;
        created_at?: number;
        tags?: string[];
      }>;
    };
    const { query: q } = buildDiscoveryQuery(query);
    const tokens = q
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((t) => t.length > 2);
    const rows = (data.data || []).filter((j) => {
      if (!tokens.length) return true;
      const hay = `${j.title} ${j.company_name} ${(j.tags || []).join(" ")} ${j.description || ""}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
    const jobs = rows.slice(0, 20).map((j, i) =>
      toJob({
        id: `arbeitnow_${j.slug || i}`,
        title: j.title || "Role",
        company: j.company_name || "Company",
        url: j.url || `https://www.arbeitnow.com/jobs/${j.slug}`,
        description: (j.description || "").replace(/<[^>]+>/g, " "),
        location: j.location || (j.remote ? "Remote" : ""),
        remote: Boolean(j.remote),
        source: "arbeitnow",
        postedAt: j.created_at
          ? new Date(j.created_at * 1000).toISOString()
          : undefined,
      })
    );
    return {
      id,
      label: "Arbeitnow",
      free: true,
      jobs,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      id,
      label: "Arbeitnow",
      free: true,
      jobs: [],
      error: e instanceof Error ? e.message : "failed",
      durationMs: Date.now() - started,
    };
  }
}

/** Jobicy free remote jobs API (no key) */
export async function fetchJobicy(query: string): Promise<FreeSourceResult> {
  const started = Date.now();
  const id: FreeSourceId = "jobicy";
  try {
    const { query: q } = buildDiscoveryQuery(query);
    // Jobicy tag is a single keyword; pick first useful token
    const tag =
      q
        .toLowerCase()
        .split(/[^a-z0-9+#]+/)
        .find((t) => t.length > 2 && !/remote|job|jobs|engineer|developer/.test(t)) ||
      "software";
    const url = `https://jobicy.com/api/v2/remote-jobs?count=20&tag=${encodeURIComponent(tag)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return {
        id,
        label: "Jobicy",
        free: true,
        jobs: [],
        error: `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      };
    }
    const data = (await res.json()) as {
      jobs?: Array<{
        id?: number | string;
        jobTitle?: string;
        companyName?: string;
        url?: string;
        jobDescription?: string;
        jobGeo?: string;
        pubDate?: string;
      }>;
    };
    const tokens = q
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((t) => t.length > 2);
    const rows = (data.jobs || []).filter((j) => {
      if (!tokens.length) return true;
      const hay = `${j.jobTitle} ${j.companyName} ${j.jobDescription || ""}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
    const jobs = rows.slice(0, 20).map((j, i) =>
      toJob({
        id: `jobicy_${j.id || i}`,
        title: j.jobTitle || "Role",
        company: j.companyName || "Company",
        url: j.url || `https://jobicy.com/job/${j.id}`,
        description: (j.jobDescription || "").replace(/<[^>]+>/g, " "),
        location: j.jobGeo || "Remote",
        remote: true,
        source: "jobicy",
        postedAt: j.pubDate,
      })
    );
    return {
      id,
      label: "Jobicy",
      free: true,
      jobs,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      id,
      label: "Jobicy",
      free: true,
      jobs: [],
      error: e instanceof Error ? e.message : "failed",
      durationMs: Date.now() - started,
    };
  }
}

/** Himalayas free jobs API (no key) */
export async function fetchHimalayas(query: string): Promise<FreeSourceResult> {
  const started = Date.now();
  const id: FreeSourceId = "himalayas";
  try {
    const res = await fetch("https://himalayas.app/jobs/api?limit=40", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return {
        id,
        label: "Himalayas",
        free: true,
        jobs: [],
        error: `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      };
    }
    const data = (await res.json()) as {
      jobs?: Array<{
        title?: string;
        companyName?: string;
        applicationLink?: string;
        excerpt?: string;
        description?: string;
        locationRestrictions?: string[];
        pubDate?: number;
        guid?: string;
      }>;
    };
    const { query: q } = buildDiscoveryQuery(query);
    const tokens = q
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((t) => t.length > 2);
    const rows = (data.jobs || []).filter((j) => {
      if (!tokens.length) return true;
      const hay = `${j.title} ${j.companyName} ${j.excerpt || ""} ${j.description || ""}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
    const jobs = rows.slice(0, 20).map((j, i) =>
      toJob({
        id: `himalayas_${j.guid || i}`,
        title: j.title || "Role",
        company: j.companyName || "Company",
        url: j.applicationLink || `https://himalayas.app/jobs`,
        description: (j.excerpt || j.description || "").replace(/<[^>]+>/g, " "),
        location: (j.locationRestrictions || []).join(", ") || "Remote",
        remote: true,
        source: "himalayas",
        postedAt: j.pubDate
          ? new Date(j.pubDate * 1000).toISOString()
          : undefined,
      })
    );
    return {
      id,
      label: "Himalayas",
      free: true,
      jobs,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      id,
      label: "Himalayas",
      free: true,
      jobs: [],
      error: e instanceof Error ? e.message : "failed",
      durationMs: Date.now() - started,
    };
  }
}

/** We Work Remotely RSS (no key) */
export async function fetchWeWorkRemotely(
  query: string
): Promise<FreeSourceResult> {
  const started = Date.now();
  const id: FreeSourceId = "weworkremotely";
  try {
    const res = await fetch(
      "https://weworkremotely.com/categories/remote-programming-jobs.rss",
      {
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "User-Agent": "VexaBot/0.1 (job discovery)",
        },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) {
      return {
        id,
        label: "We Work Remotely",
        free: true,
        jobs: [],
        error: `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      };
    }
    const xml = await res.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 30);
    const { query: q } = buildDiscoveryQuery(query);
    const tokens = q
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((t) => t.length > 2);
    const jobs: JobListing[] = [];
    let i = 0;
    for (const m of items) {
      const block = m[1];
      const title = decodeXml(
        block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i)?.[1] ||
          block.match(/<title>(.*?)<\/title>/i)?.[1] ||
          ""
      );
      const link = decodeXml(
        block.match(/<link>(.*?)<\/link>/i)?.[1] ||
          block.match(/<guid[^>]*>(.*?)<\/guid>/i)?.[1] ||
          ""
      );
      const desc = decodeXml(
        block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] ||
          block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ||
          ""
      ).replace(/<[^>]+>/g, " ");
      if (!title || !link) continue;
      const hay = `${title} ${desc}`.toLowerCase();
      if (tokens.length && !tokens.some((t) => hay.includes(t))) continue;
      // WWR titles often "Company: Role"
      const parts = title.split(/:\s+/);
      const company = parts.length > 1 ? parts[0] : "We Work Remotely";
      const jobTitle = parts.length > 1 ? parts.slice(1).join(": ") : title;
      jobs.push(
        toJob({
          id: `wwr_${Date.now()}_${i++}`,
          title: jobTitle,
          company,
          url: link,
          description: desc.slice(0, 2000),
          location: "Remote",
          remote: true,
          source: "weworkremotely",
        })
      );
    }
    return {
      id,
      label: "We Work Remotely",
      free: true,
      jobs: jobs.slice(0, 20),
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      id,
      label: "We Work Remotely",
      free: true,
      jobs: [],
      error: e instanceof Error ? e.message : "failed",
      durationMs: Date.now() - started,
    };
  }
}

/** RemoteOK public JSON (no key) */
export async function fetchRemoteOk(query: string): Promise<FreeSourceResult> {
  const started = Date.now();
  const id: FreeSourceId = "remoteok";
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: {
        Accept: "application/json",
        "User-Agent": "VexaBot/0.1 (job discovery)",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return {
        id,
        label: "RemoteOK",
        free: true,
        jobs: [],
        error: `HTTP ${res.status}`,
        durationMs: Date.now() - started,
      };
    }
    const data = (await res.json()) as Array<{
      id?: string | number;
      position?: string;
      company?: string;
      url?: string;
      description?: string;
      location?: string;
      date?: string;
      tags?: string[];
    }>;
    // First item is often metadata
    const rows = Array.isArray(data) ? data.slice(1) : [];
    const { query: q } = buildDiscoveryQuery(query);
    const tokens = q
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter((t) => t.length > 2);
    const filtered = rows.filter((j) => {
      if (!tokens.length) return true;
      const hay = `${j.position} ${j.company} ${(j.tags || []).join(" ")} ${j.description || ""}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
    const jobs = filtered.slice(0, 20).map((j, i) =>
      toJob({
        id: `remoteok_${j.id || i}`,
        title: j.position || "Role",
        company: j.company || "Company",
        url: j.url || `https://remoteok.com/remote-jobs/${j.id}`,
        description: (j.description || "").replace(/<[^>]+>/g, " "),
        location: j.location || "Remote",
        remote: true,
        source: "remoteok",
        postedAt: j.date,
      })
    );
    return {
      id,
      label: "RemoteOK",
      free: true,
      jobs,
      durationMs: Date.now() - started,
    };
  } catch (e) {
    return {
      id,
      label: "RemoteOK",
      free: true,
      jobs: [],
      error: e instanceof Error ? e.message : "failed",
      durationMs: Date.now() - started,
    };
  }
}

/** Run all free job sources in parallel */
export async function discoverFreeJobs(query: string): Promise<{
  jobs: JobListing[];
  sources: Record<string, { count: number; error?: string; free: true }>;
}> {
  // Indeed RSS is often blocked (404/403) — still tried; others are reliable $0 APIs
  const results = await Promise.all([
    fetchIndeedRss(query),
    fetchRemotive(query),
    fetchArbeitnow(query),
    fetchRemoteOk(query),
    fetchJobicy(query),
    fetchHimalayas(query),
    fetchWeWorkRemotely(query),
  ]);
  const sources: Record<string, { count: number; error?: string; free: true }> =
    {};
  const jobs: JobListing[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    sources[r.id] = {
      count: r.jobs.length,
      error: r.error,
      free: true,
    };
    for (const j of r.jobs) {
      if (seen.has(j.externalUrl)) continue;
      seen.add(j.externalUrl);
      jobs.push(j);
    }
  }
  return { jobs, sources };
}

// ─── Free contact / email finding ─────────────────────────────────

export type ContactFindResult = {
  emails: Array<{
    email: string;
    confidence: number;
    source: string;
    type?: string;
  }>;
  domain?: string;
  sourcesUsed: string[];
  freeCreditsNote: string;
};

/** Common free-tier email tools (for UI / docs) */
export const FREE_CONTACT_STACK = [
  { name: "GetProspect", credits: "600/mo", note: "Chrome ext bulk" },
  { name: "Apollo.io", credits: "100/mo", note: "DB + sequences" },
  { name: "Prospeo", credits: "75/mo", note: "High accuracy" },
  { name: "Skrapp", credits: "50/mo", note: "LinkedIn" },
  { name: "Hunter.io", credits: "25/mo", note: "Domain search API" },
  { name: "Snov.io", credits: "50/mo", note: "Campaigns" },
] as const;

function companyDomain(company: string): string {
  const slug = company
    .toLowerCase()
    .replace(/\s+(inc|llc|ltd|corp|co|io|ai)\.?$/i, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 32);
  return slug ? `${slug}.com` : "";
}

/** Pattern-based email guesses (always free, user must verify) */
export function patternEmails(
  fullName: string,
  company: string
): ContactFindResult["emails"] {
  const parts = fullName
    .toLowerCase()
    .replace(/[^a-z\s.-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return [];
  const first = parts[0];
  const last = parts[parts.length - 1] || first;
  const domain = companyDomain(company);
  if (!domain) return [];
  const patterns = [
    `${first}.${last}@${domain}`,
    `${first}${last}@${domain}`,
    `${first[0]}${last}@${domain}`,
    `${first}@${domain}`,
    `${first}_${last}@${domain}`,
    `${last}.${first}@${domain}`,
    `recruiting@${domain}`,
    `talent@${domain}`,
    `careers@${domain}`,
    `jobs@${domain}`,
    `hr@${domain}`,
  ];
  return patterns.map((email, i) => ({
    email,
    confidence: i < 4 ? 0.45 : i < 6 ? 0.35 : 0.55,
    source: "pattern",
    type: i >= 6 ? "role" : "person",
  }));
}

/** Hunter.io free tier domain search (optional HUNTER_API_KEY) */
export async function hunterDomainSearch(
  company: string,
  fullName?: string
): Promise<ContactFindResult["emails"]> {
  const key = (process.env.HUNTER_API_KEY || "").trim();
  if (!key) return [];
  const domain = companyDomain(company);
  if (!domain) return [];
  try {
    const url = new URL("https://api.hunter.io/v2/domain-search");
    url.searchParams.set("domain", domain);
    url.searchParams.set("api_key", key);
    url.searchParams.set("limit", "10");
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts[0]) url.searchParams.set("first_name", parts[0]);
      if (parts.length > 1)
        url.searchParams.set("last_name", parts[parts.length - 1]);
    }
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: {
        emails?: Array<{
          value?: string;
          confidence?: number;
          type?: string;
          first_name?: string;
          last_name?: string;
        }>;
      };
    };
    return (data.data?.emails || [])
      .filter((e) => e.value)
      .map((e) => ({
        email: e.value!,
        confidence: (e.confidence ?? 50) / 100,
        source: "hunter",
        type: e.type || "personal",
      }));
  } catch {
    return [];
  }
}

/** Find contacts: Hunter (if key) + free patterns. Never auto-sends. */
export async function findContacts(input: {
  company: string;
  fullName?: string;
  role?: string;
}): Promise<ContactFindResult> {
  const sourcesUsed: string[] = ["pattern"];
  const emails = patternEmails(
    input.fullName || "Talent Recruiting",
    input.company
  );

  const hunter = await hunterDomainSearch(input.company, input.fullName);
  if (hunter.length) {
    sourcesUsed.push("hunter");
    // Hunter first (higher confidence)
    const seen = new Set(hunter.map((e) => e.email.toLowerCase()));
    for (const e of emails) {
      if (!seen.has(e.email.toLowerCase())) hunter.push(e);
    }
    return {
      emails: hunter.slice(0, 12),
      domain: companyDomain(input.company),
      sourcesUsed,
      freeCreditsNote:
        "Hunter free: ~25 searches/mo. Patterns are free guesses — verify before send. Stack GetProspect/Apollo/Prospeo in browser for more credits.",
    };
  }

  return {
    emails: emails.slice(0, 12),
    domain: companyDomain(input.company),
    sourcesUsed,
    freeCreditsNote:
      "No HUNTER_API_KEY — using free pattern guesses only. Optional: set HUNTER_API_KEY for domain search. Browser free tiers: GetProspect 600, Apollo 100, Prospeo 75/mo.",
  };
}
