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

/**
 * GET /api/services/status
 * Live crawlers / free boards / LLM — what is configured and working.
 */
export async function GET() {
  const llm = getLlmRuntimeStatus();
  const cfg = getOpenRouterConfig();
  const disk = await probeDataWritable();

  const services = [
    {
      id: "remotive",
      name: "Remotive",
      kind: "job_board",
      free: true,
      status: "ready" as const,
      workingOn: "Remote job listings API",
    },
    {
      id: "jobicy",
      name: "Jobicy",
      kind: "job_board",
      free: true,
      status: "ready" as const,
      workingOn: "Tagged remote roles",
    },
    {
      id: "himalayas",
      name: "Himalayas",
      kind: "job_board",
      free: true,
      status: "ready" as const,
      workingOn: "Remote job feed",
    },
    {
      id: "weworkremotely",
      name: "We Work Remotely",
      kind: "job_board",
      free: true,
      status: "ready" as const,
      workingOn: "Programming RSS",
    },
    {
      id: "arbeitnow",
      name: "Arbeitnow",
      kind: "job_board",
      free: true,
      status: "ready" as const,
      workingOn: "EU-friendly board API",
    },
    {
      id: "remoteok",
      name: "RemoteOK",
      kind: "job_board",
      free: true,
      status: "ready" as const,
      workingOn: "Remote listings JSON",
    },
    {
      id: "indeed_rss",
      name: "Indeed RSS",
      kind: "job_board",
      free: true,
      status: "degraded" as const,
      workingOn: "Best-effort RSS (often blocked)",
    },
    {
      id: "greenhouse_lever",
      name: "Greenhouse / Lever",
      kind: "ats",
      free: true,
      status: "ready" as const,
      workingOn: "Official public board JSON",
    },
    {
      id: "firecrawl",
      name: "Firecrawl",
      kind: "crawler",
      free: false,
      status: process.env.FIRECRAWL_API_KEY?.trim()
        ? ("ready" as const)
        : ("offline" as const),
      workingOn: process.env.FIRECRAWL_API_KEY?.trim()
        ? "Company career scrape"
        : "Set FIRECRAWL_API_KEY",
    },
    {
      id: "exa",
      name: "Exa",
      kind: "crawler",
      free: false,
      status: process.env.EXA_API_KEY?.trim()
        ? ("ready" as const)
        : ("offline" as const),
      workingOn: process.env.EXA_API_KEY?.trim()
        ? "Semantic people/project search"
        : "Set EXA_API_KEY",
    },
    {
      id: "openrouter",
      name: "OpenRouter LLM",
      kind: "llm",
      free: true,
      status: cfg.configured
        ? llm.displayState === "heuristic"
          ? ("degraded" as const)
          : ("ready" as const)
        : ("offline" as const),
      workingOn: cfg.configured
        ? llm.running
          ? `Running ${llm.displayModel}`
          : `Idle · ${llm.displayModel || cfg.model}`
        : "Set OPENROUTER_API_KEY",
    },
    {
      id: "hunter",
      name: "Hunter.io",
      kind: "contacts",
      free: true,
      status: process.env.HUNTER_API_KEY?.trim()
        ? ("ready" as const)
        : ("offline" as const),
      workingOn: process.env.HUNTER_API_KEY?.trim()
        ? "Domain email search"
        : "Optional HUNTER_API_KEY",
    },
    {
      id: "storage",
      name: "CRM storage",
      kind: "storage",
      free: true,
      status: !disk.ok
        ? ("offline" as const)
        : disk.ephemeral
          ? ("degraded" as const)
          : ("ready" as const),
      workingOn: !disk.ok
        ? `Not writable: ${disk.error || disk.root}`
        : disk.ephemeral
          ? `Ephemeral ${disk.root} (resets on cold start)`
          : disk.root,
    },
  ];

  const ready = services.filter((s) => s.status === "ready").length;
  const offline = services.filter((s) => s.status === "offline").length;
  const tips: string[] = [];
  if (!cfg.configured) {
    tips.push("OPENROUTER_API_KEY missing — AI parse falls back to heuristics.");
  }
  if (disk.ephemeral) {
    tips.push("On Vercel, CRM data lives in /tmp and can reset. Local/dev keeps apps/web/data.");
  }
  if (!process.env.FIRECRAWL_API_KEY?.trim() && !process.env.EXA_API_KEY?.trim()) {
    tips.push("Free boards still work. Firecrawl/Exa unlock deeper company search.");
  }

  return NextResponse.json({
    ok: true,
    summary: `${ready} live · ${offline} offline`,
    appUrl: getAppUrl(),
    env: {
      vercel: Boolean(process.env.VERCEL),
      serverless: isServerlessRuntime(),
    },
    keys: {
      openrouter: cfg.configured,
      firecrawl: Boolean(process.env.FIRECRAWL_API_KEY?.trim()),
      exa: Boolean(process.env.EXA_API_KEY?.trim()),
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
