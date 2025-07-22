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

/**
 * Firecrawl placeholder — wire API key in env FIRECRAWL_API_KEY.
 * Returns empty when unset so local dev stays offline-friendly.
 */
export async function fetchViaFirecrawl(
  searchQuery: string
): Promise<Partial<JobListing>[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];

  // Minimal shape — expand when key is present.
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
