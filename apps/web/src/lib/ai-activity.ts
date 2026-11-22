/**
 * Global AI activity tracker.
 * Records which AI provider last interacted with Vexa and when.
 * Stores in dataPath("ai-activity.json") for guaranteed cross-route sync + memory cache.
 */

import fs from "fs";
import { dataPath } from "@/lib/data-root";

export type AiProvider =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "mistral"
  | "kimi"
  | "grok"
  | "copilot"
  | "cursor"
  | "unknown";

export interface AiActivityRecord {
  provider: AiProvider;
  action: string;       // e.g. "add_task", "update_task"
  detail?: string;      // e.g. task title
  at: number;           // Date.now()
}

const g = globalThis as unknown as {
  __vexaAiActivity?: AiActivityRecord | null;
};

/** Detect AI provider from request headers */
export function detectAiProvider(headers: Headers): AiProvider {
  const ua = (headers.get("user-agent") || "").toLowerCase();
  const via = (
    headers.get("x-ai-provider") ||
    headers.get("x-source") ||
    headers.get("x-client") ||
    ""
  ).toLowerCase();

  // Explicit header override
  if (via.includes("chatgpt") || via.includes("openai") || via.includes("gpt")) return "chatgpt";
  if (via.includes("claude") || via.includes("anthropic")) return "claude";
  if (via.includes("grok") || via.includes("xai")) return "grok";
  if (via.includes("gemini") || via.includes("google")) return "gemini";
  if (via.includes("mistral")) return "mistral";
  if (via.includes("kimi") || via.includes("moonshot")) return "kimi";
  if (via.includes("copilot")) return "copilot";
  if (via.includes("cursor")) return "cursor";

  // User-Agent sniffing
  if (ua.includes("chatgpt") || ua.includes("openai") || ua.includes("gptbot")) return "chatgpt";
  if (ua.includes("claude") || ua.includes("anthropic")) return "claude";
  if (ua.includes("grok") || ua.includes("xai")) return "grok";
  if (ua.includes("gemini") || ua.includes("google")) return "gemini";
  if (ua.includes("mistral")) return "mistral";
  if (ua.includes("kimi") || ua.includes("moonshot")) return "kimi";
  if (ua.includes("copilot") || ua.includes("microsoft")) return "copilot";
  if (ua.includes("cursor")) return "cursor";

  // MCP client patterns
  if (ua.includes("mcp") || ua.includes("model-context")) {
    if (ua.includes("desktop")) return "claude";
    return "chatgpt";
  }

  return "chatgpt"; // default to ChatGPT if an external AI tool endpoint was hit
}

function getActivityFilePath(): string {
  try {
    return dataPath("ai-activity.json");
  } catch {
    return "/tmp/vexa-ai-activity.json";
  }
}

/** Record that an AI just performed an action */
export function recordAiActivity(provider: AiProvider, action: string, detail?: string) {
  const rec: AiActivityRecord = {
    provider,
    action,
    detail,
    at: Date.now(),
  };

  g.__vexaAiActivity = rec;

  try {
    const fpath = getActivityFilePath();
    const dir = fpath.substring(0, fpath.lastIndexOf("/"));
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fpath, JSON.stringify(rec), "utf-8");
  } catch {
    // memory fallback is fine
  }
}

/** Get the latest AI activity (null if none or older than 35s) */
export function getAiActivity(): AiActivityRecord | null {
  try {
    const fpath = getActivityFilePath();
    if (fs.existsSync(fpath)) {
      const raw = fs.readFileSync(fpath, "utf-8");
      const parsed = JSON.parse(raw) as AiActivityRecord;
      if (parsed && typeof parsed.at === "number") {
        if (Date.now() - parsed.at < 35_000) {
          g.__vexaAiActivity = parsed;
          return parsed;
        }
      }
    }
  } catch {
    // fallback to memory
  }

  const rec = g.__vexaAiActivity;
  if (!rec) return null;
  if (Date.now() - rec.at > 35_000) {
    g.__vexaAiActivity = null;
    return null;
  }
  return rec;
}
