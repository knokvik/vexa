import { NextResponse } from "next/server";
import { matchProfileToJob } from "@vexa/intelligence";
import { discoverTier, type DiscoverTier } from "@/lib/discover";
import { store } from "@/lib/store";
import type { JobListing } from "@vexa/shared";
const TIERS: DiscoverTier[] = ["company", "portal", "linkedin"];

/**
 * POST /api/jobs/discover/tier
 * Body: { query: string, tier: "company" | "portal" | "linkedin" }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = String(body.query || "").trim();
    const tier = body.tier as DiscoverTier;

    if (!query) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }
    if (!TIERS.includes(tier)) {
      return NextResponse.json(
        { error: "tier must be company | portal | linkedin" },
        { status: 400 }
      );
    }

    const result = await discoverTier(query, tier);
    if (result.jobs.length) {
      store.upsertJobs(result.jobs as JobListing[]);
    }

    const profile = store.getProfile();
    const jobsWithMatch = result.jobs.map((job) => {
      const m = matchProfileToJob(profile, job as JobListing);
      return {
        ...job,
        match: {
          percent: m.matchPercent,
          shortlist: m.shortlistProbability,
          priority: m.priority,
          priorityLabel: m.priorityLabel,
          suggestion: m.suggestion,
          matchedSkills: m.matchedSkills,
          missingSkills: m.missingSkills,
          ats: {
            overall: m.ats.overallScore,
            keyword: m.ats.keywordMatchScore,
            semantic: m.ats.semanticScore,
            structured: m.ats.structuredScore,
          },
        },
      };
    });

    // Sort best match first within tier
    jobsWithMatch.sort(
      (a, b) => (b.match?.percent ?? 0) - (a.match?.percent ?? 0)
    );

    return NextResponse.json({
      ok: !result.error || result.jobs.length > 0,
      ...result,
      jobs: jobsWithMatch,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "tier failed" },
      { status: 502 }
    );
  }
}
