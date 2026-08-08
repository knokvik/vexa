/**
 * Command bar intent router — heuristics + optional LLM (chatbot style).
 */

import {
  openRouterChat,
  getOpenRouterConfig,
  getLlmCircuitStatus,
} from "@/lib/openrouter";

export type CommandIntent =
  | "email_ingest"
  | "job_search"
  | "network_query"
  | "add_task"
  | "complete_task"
  | "remove_task"
  | "list_tasks"
  | "start_scrape"
  | "services_status"
  | "briefing"
  | "workspace"
  | "update_stage"
  | "chat"
  | "unknown";

export type ParsedCommand = {
  intent: CommandIntent;
  confidence: number;
  query?: string;
  taskKind?:
    | "job"
    | "conference"
    | "company"
    | "personal"
    | "interview"
    | "other";
  taskTitle?: string;
  company?: string;
  stage?: string;
  /** Short chatbot-style reply shown to the user */
  reply?: string;
  suggestions: string[];
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

const EMAIL_HINTS =
  /^(from:|subject:|to:|date:)|@\w+\.\w+|we received your application|unfortunately|phone screen|coding challenge|offer letter|calendly\.com/im;

/** Sync heuristic parser (fast path) */
export function parseCommand(raw: string): ParsedCommand {
  const text = raw.trim();
  if (!text) {
    return {
      intent: "unknown",
      confidence: 0,
      suggestions: defaultSuggestions(),
      reply: "Tell me what to do — find jobs, add a task, paste an email…",
    };
  }

  // Pasted email
  if (
    EMAIL_HINTS.test(text) ||
    (text.includes("@") &&
      /\n/.test(text) &&
      text.split("\n").length >= 2 &&
      text.length > 40)
  ) {
    return {
      intent: "email_ingest",
      confidence: 0.95,
      reply: "Got it — I'll classify this email and update your pipeline tables.",
      suggestions: ["Morning briefing", "List tasks", "Service status"],
    };
  }

  const lower = text.toLowerCase();

  // Services
  if (
    /\b(services?|scrapers?|crawlers?|what.?s (running|online|live)|service status|live stack|which scrapers)\b/i.test(
      text
    )
  ) {
    return {
      intent: "services_status",
      confidence: 0.92,
      reply: "Checking which scrapers and models are live…",
      suggestions: ["Find software engineer jobs", "List tasks"],
    };
  }

  // Update application stage
  const stageMatch = text.match(
    /(?:mark|set|move|update)\s+(.+?)\s+(?:as|to)\s+(wishlist|applied|screen|technical|onsite|offer|rejected|ghosted|accepted|withdrawn)\b/i
  );
  if (stageMatch) {
    return {
      intent: "update_stage",
      confidence: 0.9,
      company: stageMatch[1].trim(),
      stage: stageMatch[2].toLowerCase(),
      reply: `Updating applications matching “${stageMatch[1].trim()}” → ${stageMatch[2].toLowerCase()}.`,
      suggestions: ["List tasks", "Morning briefing"],
    };
  }

  // Scrape / find jobs (natural language)
  if (
    /\b(find|search|look\s+for|show\s+me|get\s+me|scrape|discover|crawl|openings?|hiring|roles?)\b/i.test(
      text
    ) &&
    /\b(job|jobs|role|roles|position|positions|engineer|developer|intern|hiring|remote|opening)\b/i.test(
      text
    )
  ) {
    const q = extractJobQuery(text);
    return {
      intent: "job_search",
      confidence: 0.9,
      query: q,
      reply: `I'll search free job boards for “${q}” and show matching roles.`,
      suggestions: [
        `Find more ${q}`,
        "Service status",
        "Who do I know at Stripe?",
      ],
    };
  }

  // Broader job search: "software engineer remote", "frontend jobs"
  if (
    /\b(jobs?|roles?|openings?|positions?)\b/i.test(text) ||
    /\b(software|frontend|backend|fullstack|full.?stack|data|ml|swe|intern)\b.+\b(engineer|developer|analyst|scientist)\b/i.test(
      text
    )
  ) {
    const q = extractJobQuery(text);
    return {
      intent: "job_search",
      confidence: 0.85,
      query: q,
      reply: `Searching for “${q}” across free boards…`,
      suggestions: ["Service status", "List tasks"],
    };
  }

  if (
    /^(start scrape|run discovery|refresh jobs|scrape)\b/i.test(text) ||
    /\bstart\s+scrape\b/i.test(text)
  ) {
    const q =
      text
        .replace(/^(start\s+)?(scrape|discover|crawl|run search|refresh jobs)\s*/i, "")
        .trim() || "software engineer";
    return {
      intent: "start_scrape",
      confidence: 0.9,
      query: q,
      reply: `Starting scrapers for “${q}”…`,
      suggestions: ["Service status", "List tasks"],
    };
  }

  // Complete task
  const done = text.match(
    /^(?:complete|done|finish|check off|mark done|mark complete)\s*[:\-]?\s*(.+)$/i
  ) || text.match(/\b(?:complete|finish|mark done)\s+(?:the\s+)?(?:task\s+)?(.+)/i);
  if (done && !/\b(applied|screen|offer)\b/i.test(done[1])) {
    return {
      intent: "complete_task",
      confidence: 0.9,
      taskTitle: done[1].trim(),
      reply: `Marking task matching “${done[1].trim()}” as done.`,
      suggestions: ["List tasks", "Task: next follow-up"],
    };
  }

  // Remove task / row
  const rem =
    text.match(
      /^(?:remove|delete|drop)\s+(?:task|todo|row)?\s*[:\-]?\s*(.+)$/i
    ) ||
    text.match(/\b(?:remove|delete)\s+(?:the\s+)?(?:task\s+)?(.+)/i);
  if (rem) {
    return {
      intent: "remove_task",
      confidence: 0.88,
      taskTitle: rem[1].trim(),
      reply: `Removing task matching “${rem[1].trim()}”.`,
      suggestions: ["List tasks", "Add a task"],
    };
  }

  // List tasks
  if (
    /\b(list|show|what are|my)\s+(my\s+)?(tasks?|todos?)\b/i.test(text) ||
    /\b(open tasks?|pending tasks?|my todos?)\b/i.test(text)
  ) {
    return {
      intent: "list_tasks",
      confidence: 0.9,
      reply: "Pulling your open tasks…",
      suggestions: ["Complete: follow up", "Task: prep interview"],
    };
  }

  // Network
  const who =
    text.match(
      /(?:who do i know|contacts?|people|network)\s+(?:at|@)\s+(.+)/i
    ) ||
    text.match(/\bcontacts?\s+(?:at|for)\s+(.+)/i) ||
    text.match(/^@\s*(.+)/);
  if (who) {
    const company = who[1].trim().replace(/[?!.]+$/, "");
    return {
      intent: "network_query",
      confidence: 0.9,
      company,
      query: company,
      reply: `Looking up who you know at ${company}…`,
      suggestions: [`Find jobs at ${company}`, "Service status"],
    };
  }

  // Workspace / tables
  if (
    /\b(workspace|tables?|open tables|show tables|pipeline board)\b/i.test(text)
  ) {
    return {
      intent: "workspace",
      confidence: 0.9,
      query: "workspace",
      reply: "Opening your tables workspace.",
      suggestions: ["Add conference: PyCon", "List tasks"],
    };
  }

  // Add task / row / conference (before briefing — "follow up" must not steal this)
  if (
    /\b(add|create|new|remind me|remember to)\b/i.test(text) ||
    /\b(todo|task)\b/i.test(text) ||
    /^(?:add\s+)?(?:conference|meetup|summit|hackathon|scholarship)\b/i.test(
      text
    )
  ) {
    let title = text
      .replace(
        /^(please\s+)?(add|create|new|remind me to|remember to|todo|task)\s*[:\-]?\s*/i,
        ""
      )
      .replace(/^(a|an|the)\s+/i, "")
      .trim();
    if (!title) title = text;
    let kind: ParsedCommand["taskKind"] = "personal";
    if (/\bconference|meetup|summit\b/i.test(text)) kind = "conference";
    else if (/\binterview\b/i.test(text)) kind = "interview";
    else if (/\bjob|apply|application\b/i.test(text)) kind = "job";
    else if (/\bhackathon\b/i.test(text)) {
      kind = "personal";
      if (!/hack/i.test(title)) title = `Hackathon: ${title}`;
    } else if (/\bscholarship|grant|fellowship\b/i.test(text)) {
      kind = "personal";
      if (!/scholar/i.test(title)) title = `Scholarship: ${title}`;
    }
    title = title.replace(/\s+by\s+.+$/i, "").trim() || title;
    return {
      intent: "add_task",
      confidence: 0.88,
      taskTitle: title,
      taskKind: kind,
      reply: `Adding task: “${title}” (${kind}).`,
      suggestions: ["List tasks", "Complete: " + title.slice(0, 20)],
    };
  }

  // Briefing (after task add — avoid “follow up” false positive)
  if (
    /\b(briefing|what.?s next|what should i do|priority|overdue)\b/i.test(
      text
    ) ||
    (/\bfollow.?ups?\b/i.test(text) && !/\b(add|task|todo)\b/i.test(text))
  ) {
    return {
      intent: "briefing",
      confidence: 0.85,
      reply: "Building your morning briefing…",
      suggestions: ["List tasks", "Find remote SWE jobs"],
    };
  }

  // Short job-like phrases
  if (text.length < 60 && !/[?]/.test(text)) {
    return {
      intent: "job_search",
      confidence: 0.7,
      query: text,
      reply: `I'll treat that as a job search for “${text}”.`,
      suggestions: ["Service status", "List tasks"],
    };
  }

  return {
    intent: "chat",
    confidence: 0.4,
    query: text,
    reply:
      "I can find jobs, add/complete/remove tasks, paste emails, check scrapers, or brief you. Try: “find remote software engineer jobs”.",
    suggestions: defaultSuggestions(),
  };
}

function extractJobQuery(text: string): string {
  return (
    text
      .replace(
        /^(please\s+)?(can you\s+)?(find|search|look for|show me|get me|scrape|discover)\s+(me\s+)?/i,
        ""
      )
      .replace(/\b(jobs?|roles?|openings?|positions?)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || "software engineer"
  );
}

/**
 * Prefer LLM intent when OpenRouter is configured; fall back to heuristics.
 */
export async function parseCommandSmart(
  raw: string
): Promise<ParsedCommand> {
  const base = parseCommand(raw);
  // High-confidence heuristics or emails: skip LLM
  if (base.confidence >= 0.88 || base.intent === "email_ingest") {
    return base;
  }

  const cfg = getOpenRouterConfig();
  if (!cfg.configured || getLlmCircuitStatus().open) {
    return base;
  }
  if (process.env.VEXA_HEURISTIC_ONLY === "true") return base;

  try {
    const result = await openRouterChat({
      role: "parse",
      maxTokens: 200,
      maxAttempts: 2,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are Vexa's command router for a job-search CRM. Map user messages to ONE intent and extract fields.
Intents: job_search, start_scrape, add_task, complete_task, remove_task, list_tasks, network_query, services_status, briefing, workspace, update_stage, email_ingest, chat, unknown.

Rules:
- "find/show/search jobs", role titles → job_search with query
- "add task", "remind me", "todo" → add_task
- "done/complete" a task → complete_task
- "delete/remove" task → remove_task
- "who do I know at X" → network_query
- scrapers/services status → services_status
- mark application stage → update_stage with company + stage
- general chat/help → chat

Return JSON only:
{"intent":"...","query":"...","taskTitle":"...","taskKind":"personal|job|conference|interview|other","company":"...","stage":"applied|screen|...","reply":"one short sentence to the user","confidence":0.0-1.0}`,
        },
        { role: "user", content: raw.slice(0, 1500) },
      ],
    });
    const m = result.text.match(/\{[\s\S]*\}/);
    if (!m) return base;
    const j = JSON.parse(m[0]) as {
      intent?: string;
      query?: string;
      taskTitle?: string;
      taskKind?: string;
      company?: string;
      stage?: string;
      reply?: string;
      confidence?: number;
    };
    const intent = (
      INTENTS.includes(j.intent as CommandIntent) ? j.intent : base.intent
    ) as CommandIntent;
    const confidence = Math.min(
      1,
      Math.max(base.confidence, Number(j.confidence) || 0.75)
    );
    return {
      intent,
      confidence,
      query: j.query || base.query,
      taskTitle: j.taskTitle || base.taskTitle,
      taskKind: (j.taskKind as ParsedCommand["taskKind"]) || base.taskKind,
      company: j.company || base.company,
      stage: j.stage || base.stage,
      reply: j.reply || base.reply,
      suggestions: base.suggestions.length
        ? base.suggestions
        : defaultSuggestions(),
    };
  } catch {
    return base;
  }
}

export function defaultSuggestions() {
  return [
    "Find remote software engineer jobs",
    "Add task: follow up Stripe",
    "Service status",
    "List tasks",
    "Morning briefing",
    "Who do I know at Linear?",
  ];
}

export function liveSuggestions(partial: string): string[] {
  const p = partial.trim().toLowerCase();
  if (!p) return defaultSuggestions();
  if (p.startsWith("from:") || p.includes("@")) {
    return ["Paste full email then send", "I'll classify and file it"];
  }
  if (p.includes("job") || p.includes("find") || p.includes("search")) {
    return [
      "Find remote software engineer jobs",
      "Find frontend intern roles",
      "Start scrape data scientist",
    ];
  }
  if (p.startsWith("task") || p.startsWith("add") || p.includes("todo")) {
    return [
      "Add task: follow up Stripe",
      "Complete: follow up",
      "List tasks",
    ];
  }
  if (p.includes("service") || p.includes("scrape")) {
    return ["Service status", "Start scrape remote SWE"];
  }
  return [
    `Find ${partial.trim()} jobs`,
    "List tasks",
    "Service status",
    ...defaultSuggestions().slice(0, 2),
  ].slice(0, 5);
}
