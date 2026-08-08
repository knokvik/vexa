import { NextResponse } from "next/server";
import { getLlmRuntimeStatus, getOpenRouterConfig } from "@/lib/openrouter";
import {
  getDataRoot,
  isEphemeralStorage,
  isServerlessRuntime,
  probeDataWritable,
} from "@/lib/data-root";
import { getAppUrl } from "@/lib/oauth/config";

export const dynamic = "force-dynamic";

/** Strip quotes/newlines people paste into Vercel UI */
function envKey(name: string): string {
  return (process.env[name] || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

type SvcStatus = "ready" | "degraded" | "offline" | "optional";

/**
 * GET /api/services/status
 * Live crawlers / free boards / LLM — what is configured and working.
 */
export async function GET() {
  const llm = getLlmRuntimeStatus();
  const cfg = getOpenRouterConfig();
  const disk = await probeDataWritable();
  const firecrawl = envKey("FIRECRAWL_API_KEY");
  const exa = envKey("EXA_API_KEY");
  const hunter = envKey("HUNTER_API_KEY");
  const circuitOpen = Boolean(llm.circuit?.open);

  const services: Array<{
    id: string;
    name: string;
    kind: string;
    free: boolean;
    status: SvcStatus;
    workingOn: string;
  }> = [
    {
      id: "remotive",
      name: "Remotive",
      kind: "job_board",
      free: true,
      status: "ready",
      workingOn: "Remote job listings API",
    },
    {
      id: "jobicy",
      name: "Jobicy",
      kind: "job_board",
      free: true,
      status: "ready",
      workingOn: "Tagged remote roles",
    },
    {
      id: "himalayas",
      name: "Himalayas",
      kind: "job_board",
      free: true,
      status: "ready",
      workingOn: "Remote job feed",
    },
    {
      id: "weworkremotely",
      name: "We Work Remotely",
      kind: "job_board",
      free: true,
      status: "ready",
      workingOn: "Programming RSS",
    },
    {
      id: "arbeitnow",
      name: "Arbeitnow",
      kind: "job_board",
      free: true,
      status: "ready",
      workingOn: "EU-friendly board API",
    },
    {
      id: "remoteok",
      name: "RemoteOK",
      kind: "job_board",
      free: true,
      status: "ready",
      workingOn: "Remote listings JSON",
    },
    {
      id: "indeed_rss",
      name: "Indeed RSS",
      kind: "job_board",
      free: true,
      status: "degraded",
      workingOn: "Best-effort RSS (often blocked from cloud IPs)",
    },
    {
      id: "greenhouse_lever",
      name: "Greenhouse / Lever",
      kind: "ats",
      free: true,
      status: "ready",
      workingOn: "Official public board JSON",
    },
    {
      id: "firecrawl",
      name: "Firecrawl",
      kind: "crawler",
      free: false,
      status: firecrawl ? "ready" : "optional",
      workingOn: firecrawl
        ? "Key loaded · company career scrape"
        : "Optional — set FIRECRAWL_API_KEY",
    },
    {
      id: "exa",
      name: "Exa",
      kind: "crawler",
      free: false,
      status: exa ? "ready" : "optional",
      workingOn: exa
        ? "Key loaded · semantic people/project search"
        : "Optional — set EXA_API_KEY",
    },
    {
      id: "openrouter",
      name: "OpenRouter LLM",
      kind: "llm",
      free: true,
      // Green when key is present. Amber only if circuit tripped after hard fails.
      status: !cfg.configured
        ? "offline"
        : circuitOpen
          ? "degraded"
          : "ready",
      workingOn: !cfg.configured
        ? "Set OPENROUTER_API_KEY in Vercel (Production) + Redeploy"
        : circuitOpen
          ? `Key loaded · cooling down (free-model rate limit)`
          : llm.running
            ? `Key loaded · running ${llm.displayModel}`
            : `Key loaded · idle · ${llm.displayModel || cfg.model}`,
    },
    {
      id: "hunter",
      name: "Hunter.io",
      kind: "contacts",
      free: true,
      status: hunter ? "ready" : "optional",
      workingOn: hunter
        ? "Key loaded · domain email search"
        : "Optional — set HUNTER_API_KEY",
    },
    {
      id: "storage",
      name: "CRM storage",
      kind: "storage",
      free: true,
      // Writable /tmp is "ready" on Vercel (green). Note ephemeral in workingOn.
      status: !disk.ok ? "offline" : "ready",
      workingOn: !disk.ok
        ? `Not writable: ${disk.error || disk.root}`
        : disk.ephemeral
          ? `Ready (ephemeral /tmp — resets on cold start)`
          : `Ready · ${disk.root}`,
    },
  ];

  const ready = services.filter((s) => s.status === "ready").length;
  const offline = services.filter((s) => s.status === "offline").length;
  const optional = services.filter((s) => s.status === "optional").length;
  const tips: string[] = [];
  if (!cfg.configured) {
    tips.push(
      "OPENROUTER_API_KEY missing or not on Production — add in Vercel → Env → Redeploy."
    );
  }
  if (disk.ephemeral) {
    tips.push(
      "Storage is green when writable. On Vercel data still resets on cold starts (expected)."
    );
  }
  if (!firecrawl && !exa) {
    tips.push(
      "Free boards stay green without Firecrawl/Exa. Those keys only deepen search."
    );
  }

  return NextResponse.json({
    ok: true,
    summary: `${ready} ready · ${optional} optional · ${offline} offline`,
    appUrl: getAppUrl(),
    env: {
      vercel: Boolean(process.env.VERCEL),
      serverless: isServerlessRuntime(),
    },
    keys: {
      openrouter: cfg.configured,
      firecrawl: Boolean(firecrawl),
      exa: Boolean(exa),
      hunter: Boolean(hunter),
    },
    storage: {
      root: getDataRoot(),
      ephemeral: isEphemeralStorage(),
      writable: disk.ok,
    },
    tips,
    services,
    llm,
  });
}
