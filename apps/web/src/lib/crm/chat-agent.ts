/**
 * Multi-turn chat agent: plan 1..N tool steps from user message + CRM context.
 */

import {
  parseCommand,
  parseCommandSmart,
  type CommandIntent,
  type ParsedCommand,
  defaultSuggestions,
} from "./command";
import {
  crmContextSummary,
  executeIntent,
  type IntentExecResult,
} from "./execute-intent";
import {
  openRouterChat,
  getOpenRouterConfig,
  getLlmCircuitStatus,
} from "@/lib/openrouter";

export type ChatTurnMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatAgentResult = {
  ok: boolean;
  reply: string;
  working: string[];
  steps: Array<{ intent: string; reply: string; ok: boolean }>;
  result?: Record<string, unknown>;
  suggestions: string[];
  navigate?: string;
};

const INTENTS: CommandIntent[] = [
  "email_ingest",
  "job_search",
  "network_query",
  "add_task",
  "complete_task",
  "remove_task",
  "list_tasks",
  "start_scrape",
  "services_status",
  "briefing",
  "workspace",
  "update_stage",
  "chat",
  "unknown",
];

type PlanStep = {
  intent: CommandIntent;
  query?: string;
  taskTitle?: string;
  taskKind?: string;
  company?: string;
  stage?: string;
  text?: string;
};

/**
 * Split multi-action user text into ordered steps (heuristic + optional LLM).
 */
export async function planChatSteps(
  text: string,
  history: ChatTurnMessage[],
  crmContext: string
): Promise<{ steps: PlanStep[]; intro?: string }> {
  // Email paste = single step
  if (
    /^(from:|subject:)/im.test(text) ||
    (text.includes("@") && text.split("\n").length >= 3 && text.length > 60)
  ) {
    return { steps: [{ intent: "email_ingest", text }] };
  }

  // Heuristic multi-split on " and then " / " then " / ";" when clear
  const multiParts = splitMultiActions(text);
  if (multiParts.length > 1) {
    const steps: PlanStep[] = [];
    for (const part of multiParts) {
      const p = parseCommand(part);
      steps.push(parsedToStep(p, part));
    }
    return { steps };
  }

  const cfg = getOpenRouterConfig();
  if (
    cfg.configured &&
    !getLlmCircuitStatus().open &&
    process.env.VEXA_HEURISTIC_ONLY !== "true"
  ) {
    try {
      const hist = history
        .slice(-6)
        .map((m) => `${m.role}: ${m.content.slice(0, 400)}`)
        .join("\n");
      const result = await openRouterChat({
        role: "parse",
        maxTokens: 420,
        maxAttempts: process.env.VERCEL ? 1 : 2,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `You are Vexa, a job CRM copilot. Plan 1-4 tool steps for the user.
Tools (intent): job_search, start_scrape, add_task, complete_task, remove_task, list_tasks, network_query, services_status, briefing, workspace, update_stage, email_ingest, chat.

chat intent = answer about tables/pipeline/counts using CRM context (no external search).
If user asks for table info + to add something, use multiple steps.

Return JSON only:
{"intro":"optional short ack","steps":[{"intent":"...","query":"...","taskTitle":"...","taskKind":"personal|job|conference|interview|other","company":"...","stage":"applied|screen|...","text":"fragment to run"}]}

Rules:
- Prefer 1 step when one clear action.
- "add task X and show my tables" → add_task then chat (tables).
- Follow-ups in history matter (e.g. "that one" → previous company/task).
- Never invent tools.`,
          },
          {
            role: "user",
            content: `${crmContext}\n\nRecent chat:\n${hist || "(new session)"}\n\nUser now:\n${text.slice(0, 2000)}`,
          },
        ],
      });
      const m = result.text.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]) as {
          intro?: string;
          steps?: Array<Record<string, string>>;
        };
        const steps = (j.steps || [])
          .map((s) => {
            const intent = (
              INTENTS.includes(s.intent as CommandIntent)
                ? s.intent
                : "chat"
            ) as CommandIntent;
            return {
              intent,
              query: s.query,
              taskTitle: s.taskTitle,
              taskKind: s.taskKind,
              company: s.company,
              stage: s.stage,
              text: s.text || text,
            } satisfies PlanStep;
          })
          .slice(0, 4);
        if (steps.length) return { steps, intro: j.intro };
      }
    } catch {
      /* fall through */
    }
  }

  // Single smart parse
  const p = await parseCommandSmart(text);
  return { steps: [parsedToStep(p, text)] };
}

function parsedToStep(p: ParsedCommand, text: string): PlanStep {
  return {
    intent: p.intent,
    query: p.query,
    taskTitle: p.taskTitle,
    taskKind: p.taskKind,
    company: p.company,
    stage: p.stage,
    text,
  };
}

function splitMultiActions(text: string): string[] {
  // "add task X and find Y jobs" / "… then list tasks"
  const parts = text
    .split(
      /\s+(?:and then|then|also|;\s*|and (?=(?:add|find|list|show|search|complete|remove|mark|check|who)))/i
    )
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  if (parts.length < 2) return [text];
  // Avoid splitting normal "and" inside job titles
  if (parts.length > 4) return [text];
  return parts;
}

function stepToParsed(step: PlanStep, original: string): ParsedCommand {
  return {
    intent: step.intent,
    confidence: 0.9,
    query: step.query,
    taskTitle: step.taskTitle,
    taskKind: step.taskKind as ParsedCommand["taskKind"],
    company: step.company,
    stage: step.stage,
    suggestions: defaultSuggestions(),
  };
}

export async function runChatAgent(
  text: string,
  history: ChatTurnMessage[] = []
): Promise<ChatAgentResult> {
  const working: string[] = [];
  const crmContext = await crmContextSummary();
  working.push("Loaded CRM context");

  const { steps, intro } = await planChatSteps(text, history, crmContext);
  working.push(
    steps.length > 1
      ? `Plan: ${steps.length} steps → ${steps.map((s) => s.intent).join(" → ")}`
      : `Plan: ${steps[0]?.intent || "chat"}`
  );
  if (intro) working.push(intro);

  const stepResults: IntentExecResult[] = [];
  let navigate: string | undefined;
  let lastResult: Record<string, unknown> | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const fragment = (step.text || text).trim() || text;
    const parsed = stepToParsed(step, fragment);
    // For multi-step, re-parse fragment if fields missing
    let finalParsed = parsed;
    if (
      !step.taskTitle &&
      !step.query &&
      !step.company &&
      step.intent !== "chat" &&
      step.intent !== "list_tasks" &&
      step.intent !== "briefing" &&
      step.intent !== "services_status" &&
      step.intent !== "workspace"
    ) {
      finalParsed = await parseCommandSmart(fragment);
      finalParsed = {
        ...finalParsed,
        intent: step.intent !== "unknown" ? step.intent : finalParsed.intent,
      };
    }
    working.push(`── Step ${i + 1}/${steps.length}: ${finalParsed.intent}`);
    try {
      const r = await executeIntent(finalParsed, fragment);
      stepResults.push(r);
      working.push(...r.working.slice(0, 12));
      if (r.navigate) navigate = r.navigate;
      if (r.result) lastResult = r.result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "step failed";
      working.push(`Error: ${msg}`);
      stepResults.push({
        intent: finalParsed.intent,
        reply: msg,
        working: [msg],
        ok: false,
      });
    }
  }

  const replies = stepResults.map((r) => r.reply).filter(Boolean);
  const reply =
    replies.length === 0
      ? "I couldn't complete that — try rephrasing."
      : replies.length === 1
        ? replies[0]
        : replies.map((r, i) => `${i + 1}. ${r}`).join("\n\n");

  return {
    ok: stepResults.every((r) => r.ok),
    reply,
    working,
    steps: stepResults.map((r) => ({
      intent: r.intent,
      reply: r.reply,
      ok: r.ok,
    })),
    result: lastResult,
    suggestions: defaultSuggestions(),
    navigate,
  };
}
