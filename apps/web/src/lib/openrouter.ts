/**
 * OpenRouter multi-model router (free pool + failover + circuit breaker).
 * Circuit breaker: after repeated free-tier failures, skip network briefly
 * so draft pipeline stays fast on heuristics.
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterChatOptions = {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  role?: "default" | "humanize" | "parse" | "shortlist" | "rank";
  /** Max models to try (default 2 when circuit half-open, 3 normal) */
  maxAttempts?: number;
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

/** Process-local circuit breaker */
const circuit = {
  failures: 0,
  openUntil: 0,
};

/** Live runtime — what model is running / last used (for title bar) */
const runtime = {
  currentModel: null as string | null,
  currentRole: null as string | null,
  currentStartedAt: null as number | null,
  lastModel: null as string | null,
  lastRole: null as string | null,
  lastAt: null as number | null,
  lastOk: null as boolean | null,
  lastError: null as string | null,
  totalCalls: 0,
  totalSuccess: 0,
};

function circuitOpen(): boolean {
  return Date.now() < circuit.openUntil;
}

function recordSuccess() {
  circuit.failures = 0;
  circuit.openUntil = 0;
}

function recordFailure() {
  circuit.failures += 1;
  // After 2 consecutive hard fails, cool down 3 minutes (free-tier storms)
  if (circuit.failures >= 2) {
    circuit.openUntil = Date.now() + 3 * 60 * 1000;
  }
}

export function getLlmCircuitStatus() {
  return {
    open: circuitOpen(),
    failures: circuit.failures,
    openUntil: circuit.openUntil
      ? new Date(circuit.openUntil).toISOString()
      : null,
  };
}

/** Snapshot for header / health UI — no network call */
export function getLlmRuntimeStatus() {
  const cfg = getOpenRouterConfig();
  const circ = getLlmCircuitStatus();
  const heuristicOnly = process.env.VEXA_HEURISTIC_ONLY === "true";
  return {
    configured: cfg.configured,
    primary: cfg.model,
    pool: cfg.models,
    circuit: circ,
    heuristicOnly,
    /** Active OpenRouter model mid-request */
    running: runtime.currentModel
      ? {
          model: runtime.currentModel,
          role: runtime.currentRole,
          startedAt: runtime.currentStartedAt
            ? new Date(runtime.currentStartedAt).toISOString()
            : null,
        }
      : null,
    last: runtime.lastModel
      ? {
          model: runtime.lastModel,
          role: runtime.lastRole,
          at: runtime.lastAt
            ? new Date(runtime.lastAt).toISOString()
            : null,
          ok: runtime.lastOk,
          error: runtime.lastError,
        }
      : null,
    stats: {
      totalCalls: runtime.totalCalls,
      totalSuccess: runtime.totalSuccess,
    },
    /** Short label for title bar */
    displayModel: runtime.currentModel
      ? shortModelName(runtime.currentModel)
      : runtime.lastModel
        ? shortModelName(runtime.lastModel)
        : shortModelName(cfg.model),
    displayState: !cfg.configured
      ? "no_key"
      : heuristicOnly || circ.open
        ? "heuristic"
        : runtime.currentModel
          ? "running"
          : "idle",
  };
}

function shortModelName(model: string): string {
  // google/gemma-4-26b-a4b-it:free → gemma-4-26b
  const base = model.split("/").pop() || model;
  return base.replace(/:free$/i, "").replace(/-instruct$/i, "").slice(0, 28);
}

export function getOpenRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const primary =
    process.env.OPENROUTER_MODEL?.trim() || DEFAULT_POOL[0];
  const poolRaw = process.env.OPENROUTER_MODELS?.trim();
  const pool = poolRaw
    ? poolRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_POOL;
  const models = [primary, ...pool.filter((m) => m !== primary)];
  const vercel = (process.env.VERCEL_URL || "").trim();
  const vercelUrl = vercel
    ? vercel.startsWith("http")
      ? vercel
      : `https://${vercel}`
    : "";
  const referer =
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    vercelUrl ||
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
    const prefer = [
      "nvidia/llama-nemotron-rerank-vl-1b-v2:free",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
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

  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS || "6000");
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number.isFinite(timeoutMs) ? timeoutMs : 6000
  );

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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

    const body = (await res.json()) as {
      error?: { message?: string; code?: number };
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: unknown;
    };

    if (!res.ok) {
      throw new Error(body.error?.message || `OpenRouter HTTP ${res.status}`);
    }

    const text = body.choices?.[0]?.message?.content?.trim() || "";
    if (!text) throw new Error("Empty model response");
    return { text, model: body.model || model, usage: body.usage };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chat with free-model failover. Throws if circuit open or all attempts fail.
 */
export async function openRouterChat(
  opts: OpenRouterChatOptions
): Promise<ChatResult> {
  const cfg = getOpenRouterConfig();
  if (!cfg.apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  if (process.env.VEXA_HEURISTIC_ONLY === "true") {
    throw new Error("VEXA_HEURISTIC_ONLY=true");
  }

  if (circuitOpen()) {
    throw new Error(
      `LLM circuit open until ${new Date(circuit.openUntil).toISOString()}`
    );
  }

  const models = opts.model
    ? [opts.model, ...poolForRole(opts.role).filter((m) => m !== opts.model)]
    : poolForRole(opts.role);

  const envMax = Number(process.env.OPENROUTER_MAX_ATTEMPTS || "2");
  const maxAttempts = Math.min(
    models.length,
    opts.maxAttempts ?? (Number.isFinite(envMax) ? envMax : 2)
  );
  const attempts: ChatResult["attempts"] = [];
  let lastError = "All models failed";

  for (const model of models.slice(0, maxAttempts)) {
    runtime.currentModel = model;
    runtime.currentRole = opts.role || "default";
    runtime.currentStartedAt = Date.now();
    runtime.totalCalls += 1;
    try {
      const result = await callOnce(model, opts);
      attempts.push({ model, ok: true });
      recordSuccess();
      runtime.lastModel = result.model || model;
      runtime.lastRole = opts.role || "default";
      runtime.lastAt = Date.now();
      runtime.lastOk = true;
      runtime.lastError = null;
      runtime.totalSuccess += 1;
      runtime.currentModel = null;
      runtime.currentRole = null;
      runtime.currentStartedAt = null;
      return { ...result, attempts };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? "timeout 10s"
            : e.message
          : String(e);
      attempts.push({ model, ok: false, error: msg });
      lastError = msg;
      runtime.lastModel = model;
      runtime.lastRole = opts.role || "default";
      runtime.lastAt = Date.now();
      runtime.lastOk = false;
      runtime.lastError = msg;
    }
  }

  runtime.currentModel = null;
  runtime.currentRole = null;
  runtime.currentStartedAt = null;
  recordFailure();
  throw new Error(`${lastError} | attempts=${attempts.length}`);
}
