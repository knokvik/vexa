import { NextResponse } from "next/server";
import { matchProfileToJob } from "@vexa/intelligence";
import { discoverTier, type DiscoverTier } from "@/lib/discover";
import { store } from "@/lib/store";
import { rememberEvent } from "@/lib/app-memory";
import { buildDiscoveryQuery } from "@/lib/query-intent";
import type { JobListing } from "@vexa/shared";
const TIERS: DiscoverTier[] = ["free", "company", "portal", "linkedin"];

/**
 * POST /api/jobs/discover/tier
 * Body: { query: string, tier: "free" | "company" | "portal" | "linkedin" }
 * Expands intent keywords (intern, quant, SWE, …) before searching.
 * Free tier = Indeed RSS + Remotive + Arbeitnow + RemoteOK ($0).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawQuery = String(body.query || "").trim();
    const tier = body.tier as DiscoverTier;

    if (!rawQuery) {
      return NextResponse.json({ error: "query required" }, { status: 400 });
    }
    if (!TIERS.includes(tier)) {
      return NextResponse.json(
        { error: "tier must be free | company | portal | linkedin" },
        { status: 400 }
      );
    }

    const { query, expansion } = buildDiscoveryQuery(rawQuery);
    const result = await discoverTier(query, tier);
    if (result.jobs.length) {
      store.upsertJobs(result.jobs as JobListing[]);
    }

    // Remember search once (free or company tier) + companies discovered
    if (tier === "free" || tier === "company") {
      await rememberEvent({
        type: "search",
        query,
        note: `tier=${tier} found=${result.jobs.length}`,
        meta: { tier, freeSources: result.freeSources },
      });
    }
    const seenCos = new Set<string>();
    for (const j of result.jobs.slice(0, 12)) {
      const key = (j.company || "").trim().toLowerCase();
      if (!key || seenCos.has(key)) continue;
      seenCos.add(key);
      await rememberEvent({
        type: "discovered",
        company: j.company,
        title: j.title,
        jobId: j.id,
        url: j.externalUrl,
        query,
        note: `via ${tier}`,
        meta: { tier },
      });
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
      query,
      expansion,
      jobs: jobsWithMatch,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "tier failed" },
      { status: 502 }
    );
  }
}
