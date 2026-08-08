import { NextResponse } from "next/server";
import {
  getOpenRouterConfig,
  getLlmCircuitStatus,
  getLlmRuntimeStatus,
  openRouterChat,
} from "@/lib/openrouter";

/**
 * GET /api/health/llm
 *  ?status=1  → lightweight runtime snapshot (no LLM call) for title bar
 *  default    → tiny smoke ping + model pool
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusOnly =
    searchParams.get("status") === "1" ||
    searchParams.get("statusOnly") === "1";

  if (statusOnly) {
    return NextResponse.json({
      ok: true,
      provider: "openrouter",
      ...getLlmRuntimeStatus(),
    });
  }

  const cfg = getOpenRouterConfig();
  if (!cfg.configured) {
    return NextResponse.json(
      {
        ok: false,
        error: "OPENROUTER_API_KEY missing",
        ...getLlmRuntimeStatus(),
      },
      { status: 503 }
    );
  }

  try {
    const result = await openRouterChat({
      messages: [
        {
          role: "user",
          content: "Reply with exactly one word: pong",
        },
      ],
      maxTokens: 8,
      temperature: 0,
    });

    return NextResponse.json({
      ok: true,
      provider: "openrouter",
      model: result.model,
      reply: result.text,
      usage: result.usage,
      attempts: result.attempts,
      pool: cfg.models,
      circuit: getLlmCircuitStatus(),
      runtime: getLlmRuntimeStatus(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        provider: "openrouter",
        model: cfg.model,
        pool: cfg.models,
        circuit: getLlmCircuitStatus(),
        runtime: getLlmRuntimeStatus(),
        error: e instanceof Error ? e.message : "LLM call failed",
        note: "Draft pipeline still works via local heuristics when free models are rate-limited.",
      },
      { status: 502 }
    );
  }
}
