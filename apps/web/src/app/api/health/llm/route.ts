import { NextResponse } from "next/server";
import { getOpenRouterConfig, openRouterChat } from "@/lib/openrouter";

/**
 * Lightweight smoke test — tiny prompt, multi-model failover.
 * GET /api/health/llm
 */
export async function GET() {
  const cfg = getOpenRouterConfig();
  if (!cfg.configured) {
    return NextResponse.json(
      { ok: false, error: "OPENROUTER_API_KEY missing" },
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
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        provider: "openrouter",
        model: cfg.model,
        pool: cfg.models,
        error: e instanceof Error ? e.message : "LLM call failed",
      },
      { status: 502 }
    );
  }
}
