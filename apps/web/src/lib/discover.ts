/**
 * Job discovery clients — Firecrawl (primary), Exa (semantic), Bright Data (protected).
 * Single-user internal tool; keep calls light.
 */

import type { JobListing } from "@vexa/shared";
import { normalizeJob } from "./ingest/adapters";

function env(name: string): string {
  return (process.env[name] || "").trim();
}

export async function discoverWithFirecrawl(
  query: string
): Promise<Partial<JobListing>[]> {
  const key = env("FIRECRAWL_API_KEY");
  if (!key) return [];

  // Firecrawl search — limit 3 for cost
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `${query} job posting careers`,
      limit: 3,
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
    success?: boolean;
  };

  const rows = data.data ?? [];
  return rows.map((r, i) =>
    normalizeJob({
      id: `fc_${Date.now()}_${i}`,
      source: "firecrawl",
      title: r.title || query,
      company: guessCompany(r.title, r.url),
      externalUrl: r.url || `https://example.com/job/${i}`,
      description: (r.markdown || r.description || "").slice(0, 4000),
      location: { remote: /remote/i.test(r.title || r.description || "") },
      skillsRequired: [],
      requirements: [],
      responsibilities: [],
      employmentType: "full-time",
      experienceLevel: "unknown",
      status: "active",
      scrapedAt: new Date().toISOString(),
    })
  );
}

export async function discoverWithExa(
  query: string
): Promise<Partial<JobListing>[]> {
  const key = env("EXA_API_KEY");
  if (!key) return [];

  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `${query} hiring job openings`,
      num_results: 3,
      type: "auto",
      contents: { text: { max_characters: 800 } },
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

  return (data.results ?? []).map((r, i) =>
    normalizeJob({
      id: `exa_${Date.now()}_${i}`,
      source: "exa",
      title: r.title || query,
      company: guessCompany(r.title, r.url),
      externalUrl: r.url || `https://example.com/exa/${i}`,
      description: (r.text || "").slice(0, 4000),
      location: { remote: /remote/i.test(`${r.title} ${r.text}`) },
      skillsRequired: [],
      requirements: [],
      responsibilities: [],
      employmentType: "full-time",
      experienceLevel: "unknown",
      status: "active",
      postedAt: r.publishedDate,
      scrapedAt: new Date().toISOString(),
    })
  );
}

/**
 * Bright Data Web Unlocker — for protected public pages only.
 * Keep usage minimal (1 URL) during smoke tests.
 */
export async function scrapeWithBrightData(
  url: string
): Promise<{ markdown: string; ok: boolean; error?: string }> {
  const key = env("BRIGHT_DATA_API_KEY");
  if (!key) return { markdown: "", ok: false, error: "BRIGHT_DATA_API_KEY missing" };

  // Bright Data API token auth variants differ by product;
  // try request API with Bearer.
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

export async function discoverJobs(query: string): Promise<{
  jobs: JobListing[];
  sources: Record<string, { count: number; error?: string }>;
}> {
  const sources: Record<string, { count: number; error?: string }> = {};
  const jobs: JobListing[] = [];

  try {
    const fc = await discoverWithFirecrawl(query);
    sources.firecrawl = { count: fc.length };
    jobs.push(...(fc as JobListing[]));
  } catch (e) {
    sources.firecrawl = {
      count: 0,
      error: e instanceof Error ? e.message : "fail",
    };
  }

  try {
    const ex = await discoverWithExa(query);
    sources.exa = { count: ex.length };
    jobs.push(...(ex as JobListing[]));
  } catch (e) {
    sources.exa = {
      count: 0,
      error: e instanceof Error ? e.message : "fail",
    };
  }

  // Dedup by URL
  const seen = new Set<string>();
  const unique = jobs.filter((j) => {
    const k = j.externalUrl;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { jobs: unique, sources };
}

function guessCompany(title?: string, url?: string): string {
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "");
      const part = host.split(".")[0];
      if (part && !["linkedin", "indeed", "glassdoor", " lev"].includes(part)) {
        return part.charAt(0).toUpperCase() + part.slice(1);
      }
    } catch {
      /* ignore */
    }
  }
  return title?.split(/[-|@]/)[0]?.trim().slice(0, 40) || "Company";
}
