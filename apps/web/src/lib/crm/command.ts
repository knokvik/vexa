/**
 * Dashboard command bar — detect intent from free text / pasted email.
 */

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
  suggestions: string[];
};

const EMAIL_HINTS =
  /^(from:|subject:|to:|date:)|@\w+\.\w+|we received your application|unfortunately|phone screen|coding challenge|offer letter|calendly\.com/im;

export function parseCommand(raw: string): ParsedCommand {
  const text = raw.trim();
  if (!text) {
    return {
      intent: "unknown",
      confidence: 0,
      suggestions: defaultSuggestions(),
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
      suggestions: [
        "Drop more recruiter emails",
        "Who do I know at this company?",
        "Morning briefing",
      ],
    };
  }

  // Services / scrapers
  if (
    /\b(services?|scrapers?|crawlers?|what.?s (running|online|live)|service status|live stack)\b/i.test(
      text
    )
  ) {
    return {
      intent: "services_status",
      confidence: 0.92,
      suggestions: [
        "Start scrape software engineer",
        "List tasks",
        "Morning briefing",
      ],
    };
  }

  // Start scrape / discover
  const scrape = text.match(
    /^(?:start\s+)?(?:scrape|discover|crawl|run search)\s*[:\-]?\s*(.+)?$/i
  );
  if (
    scrape ||
    /^(start scrape|run discovery|refresh jobs)\b/i.test(text)
  ) {
    const q =
      scrape?.[1]?.trim() ||
      text
        .replace(/^(start\s+)?(scrape|discover|crawl|run search|refresh jobs)\s*/i, "")
        .trim() ||
      "software engineer";
    return {
      intent: "start_scrape",
      confidence: 0.9,
      query: q,
      suggestions: [
        "Start scrape remote intern",
        "Service status",
        "Find frontend engineer",
      ],
    };
  }

  // Complete task
  const done = text.match(
    /^(?:complete|done|finish|check off|mark done)\s*[:\-]?\s*(.+)$/i
  );
  if (done) {
    return {
      intent: "complete_task",
      confidence: 0.9,
      taskTitle: done[1].trim(),
      suggestions: ["List tasks", "Task: next follow-up"],
    };
  }

  // Remove / delete task
  const rem = text.match(
    /^(?:remove|delete|drop)\s+(?:task|todo)?\s*[:\-]?\s*(.+)$/i
  );
  if (rem) {
    return {
      intent: "remove_task",
      confidence: 0.88,
      taskTitle: rem[1].trim(),
      suggestions: ["List tasks", "Add task: …"],
    };
  }

  // List tasks
  if (/\b(list tasks?|show tasks?|my todos?|open tasks?)\b/i.test(text)) {
    return {
      intent: "list_tasks",
      confidence: 0.9,
      suggestions: ["Complete: follow up", "Task: prep interview"],
    };
  }

  // Network
  const who =
    text.match(
      /(?:who do i know|contacts?|people|network)\s+(?:at|@)\s+(.+)/i
    ) || text.match(/^@\s*(.+)/);
  if (who) {
    const company = who[1].trim().replace(/[?!.]+$/, "");
    return {
      intent: "network_query",
      confidence: 0.9,
      company,
      query: company,
      suggestions: [
        `Find contacts at ${company}`,
        "Service status",
        "Morning briefing",
      ],
    };
  }

  // Briefing
  if (
    /\b(briefing|what.?s next|overdue|follow.?ups?|today|this week)\b/i.test(
      text
    )
  ) {
    return {
      intent: "briefing",
      confidence: 0.85,
      suggestions: ["List tasks", "Service status", "Start scrape"],
    };
  }

  // Workspace
  if (/\b(workspace|tables?|open tables|show tables)\b/i.test(text)) {
    return {
      intent: "workspace",
      confidence: 0.9,
      query: "workspace",
      suggestions: ["Add conference: PyCon", "List tasks"],
    };
  }

  // Add task / conference / etc.
  const task =
    text.match(/^(?:add\s+)?(?:task|todo|remind(?:er)?)\s*[:\-]?\s*(.+)/i) ||
    text.match(
      /^(?:add\s+)?(?:conference|meetup|summit|event|hackathon|scholarship)\s*[:\-]?\s*(.+)/i
    );
  if (task || /^(?:task|todo)\s*[:\-]/i.test(text)) {
    let title = (
      task?.[1] ||
      text.replace(/^(?:add\s+)?(?:task|todo)\s*[:\-]?\s*/i, "")
    ).trim();
    let kind: "conference" | "interview" | "personal" | "job" = "personal";
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
      suggestions: [
        "Complete: " + title.slice(0, 24),
        "List tasks",
        "Service status",
      ],
    };
  }

  // Job search
  if (
    /\b(find|search|jobs?|roles?|openings?|hiring|engineer|developer|intern|remote)\b/i.test(
      text
    ) ||
    text.length < 80
  ) {
    const q =
      text
        .replace(/^(find|search|look for|show me)\s+/i, "")
        .replace(/\bjobs?\b/gi, "")
        .trim() || text;
    return {
      intent: "job_search",
      confidence: 0.75,
      query: q,
      suggestions: [
        `Start scrape ${q.slice(0, 30)}`,
        "Service status",
        "Who do I know at Stripe?",
      ],
    };
  }

  return {
    intent: "unknown",
    confidence: 0.3,
    query: text,
    suggestions: defaultSuggestions(),
  };
}

export function defaultSuggestions() {
  return [
    "Paste a recruiter email",
    "Start scrape software engineer",
    "Service status",
    "Task: follow up Stripe",
    "Complete: follow up",
    "List tasks",
    "Morning briefing",
  ];
}

export function liveSuggestions(partial: string): string[] {
  const p = partial.trim().toLowerCase();
  if (!p) return defaultSuggestions();
  if (p.startsWith("from:") || p.includes("@")) {
    return ["Keep pasting full From/Subject/body", "Then send to ingest"];
  }
  if (p.startsWith("who") || p.startsWith("@")) {
    return [
      "Who do I know at Linear?",
      "Who do I know at OpenAI?",
      "Contacts at Stripe",
    ];
  }
  if (p.startsWith("task") || p.startsWith("add") || p.startsWith("complete")) {
    return [
      "Task: follow up Stripe",
      "Complete: follow up",
      "List tasks",
      "Remove task: follow up",
    ];
  }
  if (p.startsWith("scrape") || p.startsWith("start") || p.startsWith("service")) {
    return [
      "Start scrape remote SWE",
      "Service status",
      "Find frontend engineer",
    ];
  }
  return [
    `Find ${partial.trim()}`,
    "Service status",
    "List tasks",
    ...defaultSuggestions().slice(0, 2),
  ].slice(0, 5);
}
