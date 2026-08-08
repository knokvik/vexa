import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { discoverJobs } from "@/lib/discover";
import { rememberEvent } from "@/lib/app-memory";
import type { JobListing } from "@vexa/shared";

/**
 * POST /api/automation/start
 * Email-native CRM modes only:
 *   { mode: "find", query? } — discover jobs (no tailor, no auto-apply)
 *
 * Removed: find_draft, full_copilot, tailored resume packages, auto-apply.
 */
export async function POST(request: Request) {
  let mode = "find";
  let query = "software engineer";
  try {
    const body = await request.json();
    if (body.mode) mode = String(body.mode);
    if (body.query) query = String(body.query);
  } catch {
    /* empty */
  }

  // Explicitly reject legacy auto-apply / tailor modes
  if (
    mode === "find_draft" ||
    mode === "full_copilot" ||
    mode === "drafts" ||
    mode === "apply" ||
    mode === "auto_apply"
  ) {
    return NextResponse.json(
      {
        ok: false,
        enabled: false,
        autoApply: false,
        error:
          "Tailor/auto-apply modes removed. Use mode=find for discovery, or /pipeline for email CRM.",
        hint: "POST { mode: 'find', query: '…' } or open /pipeline to drop emails.",
      },
      { status: 410 }
    );
  }

  await store.ensureHydrated();
  let discovered = 0;
  let discoverSources: Record<string, { count: number; error?: string }> = {};

  if (mode === "find" || mode === "discover") {
    try {
      const r = await discoverJobs(query, { skipLinkedIn: true, limit: 40 });
      store.upsertJobs(r.jobs as JobListing[]);
      discovered = r.jobs.length;
      discoverSources = r.sources;
      await rememberEvent({
        type: "search",
        query,
        note: `discover only count=${discovered}`,
        meta: { sources: r.sources, mode: "find" },
      });
    } catch (e) {
      discoverSources = {
        error: {
          count: 0,
          error: e instanceof Error ? e.message : "discover failed",
        },
      };
    }

    return NextResponse.json({
      ok: true,
      enabled: true,
      mode: "find",
      discovered,
      sources: discoverSources,
      prepared: 0,
      autoApply: false,
      tailor: false,
      message: `Discovered ${discovered} roles (free boards + ATS). No resume tailor. No auto-apply. Review on Boards / apply manually with Pipeline graph intel.`,
    });
  }

  return NextResponse.json({
    ok: false,
    error: `Unknown mode ${mode}. Use find | open /pipeline | /outreach | /api/crm/briefing`,
    autoApply: false,
  }, { status: 400 });
}
