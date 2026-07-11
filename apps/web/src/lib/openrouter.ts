/**
 * OpenRouter multi-model router (free pool + failover).
 * Keeps max_tokens low by default to save quota.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterChatOptions = {
  messages: ChatMessage[];
  model?: string;
  /** Prefer short responses — default from env or 128 */
  maxTokens?: number;
  temperature?: number;
  /** Role for model pool selection */
  role?: "default" | "humanize" | "parse" | "shortlist" | "rank";
};

export type ChatResult = {
  text: string;
  model: string;
  usage?: unknown;
  attempts: Array<{ model: string; ok: boolean; error?: string }>;
};

const DEFAULT_POOL = [
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
];

export function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const primary =
    process.env.OPENROUTER_MODEL?.trim() || DEFAULT_POOL[0];
  const poolRaw = process.env.OPENROUTER_MODELS?.trim();
  const pool = poolRaw
    ? poolRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_POOL;
  // Ensure primary is first
  const models = [primary, ...pool.filter((m) => m !== primary)];
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://127.0.0.1:5173";
  const title = process.env.OPENROUTER_APP_TITLE?.trim() || "Vexa";
  const defaultMaxTokens = Number(
    process.env.OPENROUTER_MAX_TOKENS_DEFAULT || "128"
  );
  return {
    apiKey,
    model: primary,
    models,
    referer,
    title,
    defaultMaxTokens: Number.isFinite(defaultMaxTokens) ? defaultMaxTokens : 128,
    configured: Boolean(apiKey),
  };
}

function poolForRole(role: OpenRouterChatOptions["role"]): string[] {
  const cfg = getOpenRouterConfig();
  const all = cfg.models;
  if (role === "shortlist" || role === "rank") {
    // Prefer reasoning / rank-friendly first when present
    const prefer = [
      "nvidia/llama-nemotron-rerank-vl-1b-v2:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
    ];
    return [...prefer.filter((m) => all.includes(m)), ...all];
  }
  return all;
}

async function callOnce(
  model: string,
  opts: OpenRouterChatOptions
): Promise<{ text: string; model: string; usage?: unknown }> {
  const cfg = getOpenRouterConfig();
  if (!cfg.apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  // Fast fail — free models often queue/rate-limit; don't hang the pipeline
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  let res: Response;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "HTTP-Referer": cfg.referer,
        "X-Title": cfg.title,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        max_tokens: opts.maxTokens ?? cfg.defaultMaxTokens,
        temperature: opts.temperature ?? 0.2,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const body = (await res.json()) as {
    error?: { message?: string; code?: number };
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };

  if (!res.ok) {
    throw new Error(
      body.error?.message || `OpenRouter HTTP ${res.status}`
    );
  }

  const text = body.choices?.[0]?.message?.content?.trim() || "";
  if (!text) throw new Error("Empty model response");
  return { text, model: body.model || model, usage: body.usage };
}

/**
 * Chat with automatic free-model failover (429 / empty / error).
 */
export async function openRouterChat(
  opts: OpenRouterChatOptions
): Promise<ChatResult> {
  const cfg = getOpenRouterConfig();
  if (!cfg.apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const models = opts.model
    ? [opts.model, ...poolForRole(opts.role).filter((m) => m !== opts.model)]
    : poolForRole(opts.role);

  // Cap attempts so free-tier rate-limits don't burn 60s+
  const maxAttempts = Math.min(models.length, 3);
  const attempts: ChatResult["attempts"] = [];
  let lastError = "All models failed";

  for (const model of models.slice(0, maxAttempts)) {
    try {
      const result = await callOnce(model, opts);
      attempts.push({ model, ok: true });
      return { ...result, attempts };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? "timeout 12s"
            : e.message
          : String(e);
      attempts.push({ model, ok: false, error: msg });
      lastError = msg;
      // continue to next model
    }
  }

  throw new Error(`${lastError} | attempts=${attempts.length}`);
}

/** Back-compat simple export used by health route */
export async function openRouterChatSimple(
  opts: OpenRouterChatOptions
): Promise<{ text: string; model: string; usage?: unknown }> {
  const r = await openRouterChat(opts);
  return { text: r.text, model: r.model, usage: r.usage };
}
