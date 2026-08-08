import { NextResponse } from "next/server";
import { getLlmRuntimeStatus, getOpenRouterConfig } from "@/lib/openrouter";

/**
 * GET /api/services/status
 * Live crawlers / free boards / LLM — what is configured and working.
 */
export async function GET() {
  const llm = getLlmRuntimeStatus();
  const cfg = getOpenRouterConfig();

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
  ];

  const ready = services.filter((s) => s.status === "ready").length;
  const offline = services.filter((s) => s.status === "offline").length;

  return NextResponse.json({
    ok: true,
    summary: `${ready} live · ${offline} offline`,
    services,
    llm,
  });
}
