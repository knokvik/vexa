import { NextResponse } from "next/server";
import { discoverTier, type DiscoverTier } from "@/lib/discover";
import { store } from "@/lib/store";
import type { JobListing } from "@vexa/shared";

const TIERS: DiscoverTier[] = ["company", "portal", "linkedin"];

/**
 * POST /api/jobs/discover/tier
 * Body: { query: string, tier: "company" | "portal" | "linkedin" }
 *
 * Live search calls this three times in priority order so the UI can
 * stream cards as each tier finishes.
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

    return NextResponse.json({
      ok: !result.error || result.jobs.length > 0,
      ...result,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "tier failed" },
      { status: 502 }
    );
  }
}
