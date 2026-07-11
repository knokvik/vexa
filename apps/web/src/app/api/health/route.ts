import { NextResponse } from "next/server";
import { getOpenRouterConfig, getLlmCircuitStatus } from "@/lib/openrouter";
import { store } from "@/lib/store";

/** GET /api/health — overall engine status (no expensive calls) */
export async function GET() {
  const cfg = getOpenRouterConfig();
  const circuit = getLlmCircuitStatus();
  return NextResponse.json({
    ok: true,
    singleUser: process.env.VEXA_SINGLE_USER !== "false",
    appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL,
    keys: {
      openrouter: cfg.configured,
      firecrawl: Boolean(process.env.FIRECRAWL_API_KEY),
      exa: Boolean(process.env.EXA_API_KEY),
      brightData: Boolean(process.env.BRIGHT_DATA_API_KEY),
    },
    llm: {
      primary: cfg.model,
      poolSize: cfg.models.length,
      circuit,
    },
    store: {
      jobs: store.listJobs().length,
      drafts: store.listDrafts().length,
      resumes: store.listResumes().length,
    },
  });
}
