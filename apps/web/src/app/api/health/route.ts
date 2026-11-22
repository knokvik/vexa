import { NextResponse } from "next/server";
import { getOpenRouterConfig, getLlmCircuitStatus } from "@/lib/openrouter";
import { store } from "@/lib/store";
import {
  getDataRoot,
  isEphemeralStorage,
  isServerlessRuntime,
  probeDataWritable,
} from "@/lib/data-root";
import { getAppUrl } from "@/lib/oauth/config";
import { getCrmStorageStatus } from "@/lib/crm/db";

export const dynamic = "force-dynamic";

/** GET /api/health — overall engine status (no expensive calls) */
export async function GET() {
  const cfg = getOpenRouterConfig();
  const circuit = getLlmCircuitStatus();
  const disk = await probeDataWritable();
  const crmStorage = getCrmStorageStatus();

  const strip = (v?: string | null) =>
    (v || "")
      .trim()
      .replace(/^['"]|['"]$/g, "")
      .trim();
  const keys = {
    openrouter: cfg.configured,
    firecrawl: Boolean(strip(process.env.FIRECRAWL_API_KEY)),
    exa: Boolean(strip(process.env.EXA_API_KEY)),
    brightData: Boolean(strip(process.env.BRIGHT_DATA_API_KEY)),
    hunter: Boolean(strip(process.env.HUNTER_API_KEY)),
  };

  const tips: string[] = [];
  if (!keys.openrouter) {
    tips.push("Set OPENROUTER_API_KEY in Vercel → Settings → Environment Variables (Production), then Redeploy.");
  }
  if (!disk.ok) {
    tips.push(
      `Data directory not writable (${disk.root}): ${disk.error || "unknown"}. Tasks/CRM may only last for one instance.`
    );
  } else if (disk.ephemeral && !crmStorage.configured) {
    tips.push(
      crmStorage.warning || "Configure shared durable storage for Vercel before using tasks and CRM data."
    );
  }
  if (
    process.env.NEXT_PUBLIC_APP_URL &&
    /localhost|127\.0\.0\.1/i.test(process.env.NEXT_PUBLIC_APP_URL)
  ) {
    tips.push(
      "NEXT_PUBLIC_APP_URL is still localhost — set it to your https://….vercel.app URL and Redeploy."
    );
  }
  if (!keys.firecrawl && !keys.exa) {
    tips.push(
      "Free job boards work without Firecrawl/Exa. Add those keys only for deeper company/people search."
    );
  }

  const ready =
    disk.ok &&
    (!isServerlessRuntime() || crmStorage.configured) &&
    // openrouter optional for free boards
    true;

  return NextResponse.json({
    ok: ready,
    env: {
      vercel: Boolean(process.env.VERCEL),
      serverless: isServerlessRuntime(),
      nodeEnv: process.env.NODE_ENV,
      region: process.env.VERCEL_REGION || null,
    },
    singleUser: process.env.VEXA_SINGLE_USER !== "false",
    appUrl: getAppUrl(),
    configuredAppUrl:
      process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || null,
    keys,
    llm: {
      primary: cfg.model,
      poolSize: cfg.models.length,
      referer: cfg.referer,
      circuit,
    },
    storage: {
      root: getDataRoot(),
      ephemeral: isEphemeralStorage(),
      writable: disk.ok,
      error: disk.error || null,
      durable: crmStorage.durable,
      provider: crmStorage.provider,
    },
    store: {
      jobs: store.listJobs().length,
      drafts: store.listDrafts().length,
      resumes: store.listResumes().length,
    },
    tips,
    check: {
      healthLlm: "/api/health/llm",
      services: "/api/services/status",
      command: "POST /api/crm/command { text: \"find remote software engineer jobs\" }",
    },
  });
}
