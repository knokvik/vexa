/**
 * Run a single parsed CRM command intent (shared by /api/crm/command and chat).
 */

import type { ParsedCommand } from "./command";
import { ingestEmail, parsePastedEmail } from "./ingest";
import { discoverJobs } from "@/lib/discover";
import { store } from "@/lib/store";
import { whoDoIKnowAt } from "./graph";
import { morningBriefing } from "./actions";
import {
  upsertUserTask,
  deleteUserTask,
  findTasksByTitle,
  listUserTasks,
  listApplications,
  upsertApplication,
  loadCrm,
} from "./db";
import type { JobListing, PipelineStage } from "@vexa/shared";
import { rememberEvent } from "@/lib/app-memory";

export type IntentExecResult = {
  intent: string;
  reply: string;
  working: string[];
  result?: Record<string, unknown>;
  navigate?: string;
  ok: boolean;
};

/** Compact CRM snapshot for chat context */
export async function crmContextSummary(): Promise<string> {
  const db = await loadCrm();
  const openTasks = (db.userTasks || []).filter((t) => !t.done);
  const activeApps = db.applications.filter((a) => a.status === "active");
  const byStage: Record<string, number> = {};
  for (const a of activeApps) {
    byStage[a.stage] = (byStage[a.stage] || 0) + 1;
  }
  const stageLine = Object.entries(byStage)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
  const taskPreview = openTasks
    .slice(0, 8)
    .map((t) => `- ${t.title} [${t.kind}]`)
    .join("\n");
  const appPreview = activeApps
    .slice(0, 8)
    .map((a) => `- ${a.jobTitle} @ ${a.companyName} (${a.stage})`)
    .join("\n");
  const companyPreview = db.companies
    .slice(0, 8)
    .map((c) => c.name)
    .join(", ");

  return [
    `CRM snapshot:`,
    `companies=${db.companies.length} contacts=${db.contacts.length} applications=${activeApps.length} emails=${db.emails.length} open_tasks=${openTasks.length}`,
    stageLine ? `pipeline stages: ${stageLine}` : "pipeline stages: (none)",
    companyPreview ? `companies: ${companyPreview}` : "companies: (none)",
    taskPreview ? `open tasks:\n${taskPreview}` : "open tasks: (none)",
    appPreview ? `active apps:\n${appPreview}` : "active apps: (none)",
  ].join("\n");
}

export async function executeIntent(
  parsed: ParsedCommand,
  text: string
): Promise<IntentExecResult> {
  const working: string[] = [
    `Understood: ${parsed.intent}${
      parsed.confidence ? ` (${Math.round(parsed.confidence * 100)}%)` : ""
    }`,
  ];
  if (parsed.reply) working.push(parsed.reply);

  const done = (
    reply: string,
    extra?: {
      result?: Record<string, unknown>;
      navigate?: string;
      ok?: boolean;
    }
  ): IntentExecResult => ({
    intent: parsed.intent,
    reply: reply || parsed.reply || working[working.length - 1] || "Done",
    working,
    result: extra?.result,
    navigate: extra?.navigate,
    ok: extra?.ok !== false,
  });

  if (parsed.intent === "email_ingest") {
    working.push("Classifying email…");
    const input =
      text.includes("From:") || text.includes("Subject:")
        ? parsePastedEmail(text)
        : {
            subject: text.split("\n")[0]?.slice(0, 120) || "Email",
            bodyText: text,
          };
    const result = await ingestEmail(input);
    working.push(
      `${result.classification} → ${result.stage || "linked"}`,
      ...result.notes
    );
    return done(
      `Filed as ${result.classification}${result.stage ? ` · stage ${result.stage}` : ""}${
        result.email.extracted.companyName
          ? ` · ${result.email.extracted.companyName}`
          : ""
      }.`,
      {
        result: {
          classification: result.classification,
          stage: result.stage,
          companyId: result.companyId,
          applicationId: result.applicationId,
          extracted: result.email.extracted,
        },
      }
    );
  }

  if (parsed.intent === "job_search" || parsed.intent === "start_scrape") {
    const query = (parsed.query || text).trim() || "software engineer";
    working.push(`Searching free boards for “${query}”…`);
    await store.ensureHydrated();
    const r = await discoverJobs(query, { skipLinkedIn: true, limit: 30 });
    store.upsertJobs(r.jobs as JobListing[]);
    const sourceLines = Object.entries(r.sources || {}).map(
      ([k, v]) =>
        `${k}: ${(v as { count?: number; error?: string }).count ?? 0}${
          (v as { error?: string }).error ? ` (!)` : ""
        }`
    );
    working.push(`Found ${r.jobs.length} roles`);
    working.push(...sourceLines.slice(0, 10));
    await rememberEvent({
      type: "search",
      query,
      note: `command discover=${r.jobs.length}`,
    }).catch(() => null);

    const top = r.jobs.slice(0, 8).map((j) => ({
      id: j.id,
      title: j.title,
      company: j.company,
      url: j.externalUrl,
      source: j.source,
    }));
    for (const j of top.slice(0, 5)) {
      working.push(`· ${j.title} @ ${j.company}`);
    }
    return done(
      r.jobs.length
        ? `Found ${r.jobs.length} roles for “${query}”. Top ones are listed — open Jobs for the full board.`
        : `No solid matches for “${query}” yet. Try a more specific role or keywords.`,
      {
        result: {
          query,
          count: r.jobs.length,
          jobs: top,
          sources: r.sources,
        },
        navigate: "/jobs",
      }
    );
  }

  if (parsed.intent === "services_status") {
    working.push("Checking live services…");
    const { GET: statusGet } = await import(
      "@/app/api/services/status/route"
    );
    const res = await statusGet();
    const data = await res.json();
    const services = (data.services || []) as Array<{
      name: string;
      status: string;
      workingOn: string;
    }>;
    working.push(data.summary || `${services.length} services`);
    for (const s of services.slice(0, 14)) {
      working.push(`${s.name}: ${s.status} — ${s.workingOn}`);
    }
    return done(data.summary || "Service status ready.", {
      result: { summary: data.summary, services },
      navigate: "/services",
    });
  }

  if (parsed.intent === "network_query") {
    const company = parsed.company || parsed.query || text;
    working.push(`Looking up contacts at ${company}…`);
    const direct = await whoDoIKnowAt(company);
    working.push(`${direct.length} contact(s)`);
    for (const d of direct.slice(0, 8)) {
      working.push(`· ${d.contact.name} <${d.contact.email}>`);
    }
    return done(
      direct.length
        ? `You have ${direct.length} contact(s) at ${company}.`
        : `No contacts at ${company} yet — paste recruiter emails to grow the graph.`,
      {
        result: {
          company,
          contacts: direct.map((d) => ({
            name: d.contact.name,
            email: d.contact.email,
            role: d.contact.roleType,
            title: d.contact.title,
          })),
        },
      }
    );
  }

  if (parsed.intent === "add_task") {
    const title = parsed.taskTitle || text;
    working.push(`Creating task: ${title}`);
    const task = await upsertUserTask({
      title,
      kind: parsed.taskKind || "personal",
    });
    working.push(`Saved · ${task.kind}`);
    return done(`Added task “${task.title}” to your timeline.`, {
      result: { task },
      navigate: "/timeline",
    });
  }

  if (parsed.intent === "complete_task") {
    const q = parsed.taskTitle || text;
    working.push(`Completing task matching “${q}”…`);
    const hits = await findTasksByTitle(q);
    const open = hits.filter((t) => !t.done);
    if (!open.length) {
      working.push("No open task matched");
      return done(`I couldn't find an open task matching “${q}”. Try “list tasks”.`, {
        result: { matched: 0 },
      });
    }
    const t = open[0];
    await upsertUserTask({
      id: t.id,
      title: t.title,
      kind: t.kind,
      done: true,
      dueAt: t.dueAt,
    });
    working.push(`Completed: ${t.title}`);
    return done(`Done — “${t.title}” is completed.`, {
      result: { task: { ...t, done: true } },
    });
  }

  if (parsed.intent === "remove_task") {
    const q = parsed.taskTitle || text;
    working.push(`Removing task matching “${q}”…`);
    const hits = await findTasksByTitle(q);
    if (!hits.length) {
      working.push("No task matched");
      return done(`No task matched “${q}”.`, { result: { removed: 0 } });
    }
    const t = hits[0];
    await deleteUserTask(t.id);
    working.push(`Removed: ${t.title}`);
    return done(`Removed “${t.title}”.`, {
      result: { removed: 1, title: t.title },
    });
  }

  if (parsed.intent === "list_tasks") {
    working.push("Loading open tasks…");
    const tasks = await listUserTasks(false);
    working.push(`${tasks.length} open`);
    for (const t of tasks.slice(0, 12)) {
      working.push(
        `· ${t.title}${t.dueAt ? ` (due ${t.dueAt.slice(0, 10)})` : ""} [${t.kind}]`
      );
    }
    return done(
      tasks.length
        ? `You have ${tasks.length} open task(s).`
        : "No open tasks — say “add task: …” to create one.",
      {
        result: {
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            kind: t.kind,
            dueAt: t.dueAt,
            done: t.done,
          })),
        },
        navigate: "/timeline",
      }
    );
  }

  if (parsed.intent === "update_stage") {
    const company = (parsed.company || "").trim();
    const stage = (parsed.stage || "applied").toLowerCase() as PipelineStage;
    working.push(`Updating stage → ${stage} for “${company}”…`);
    const apps = await listApplications();
    const hits = apps.filter(
      (a) =>
        a.status === "active" &&
        (a.companyName.toLowerCase().includes(company.toLowerCase()) ||
          a.jobTitle.toLowerCase().includes(company.toLowerCase()))
    );
    if (!hits.length) {
      return done(`No active applications matched “${company}”.`, {
        result: { updated: 0 },
      });
    }
    for (const a of hits.slice(0, 5)) {
      await upsertApplication({
        ...a,
        stage,
        lastTouchAt: new Date().toISOString(),
      });
      working.push(`· ${a.jobTitle} @ ${a.companyName} → ${stage}`);
    }
    return done(
      `Updated ${Math.min(hits.length, 5)} application(s) to “${stage}”.`,
      { result: { updated: hits.length, stage, company } }
    );
  }

  if (parsed.intent === "briefing") {
    working.push("Running action engine…");
    const briefing = await morningBriefing();
    working.push(briefing.summary);
    return done(briefing.summary, {
      result: briefing as unknown as Record<string, unknown>,
      navigate: "/timeline",
    });
  }

  if (parsed.intent === "workspace") {
    working.push("Open Workspace for tables");
    return done("Opening your tables workspace.", {
      result: { navigate: "/workspace" },
      navigate: "/workspace",
    });
  }

  // Table / CRM info Q&A
  if (
    parsed.intent === "chat" ||
    parsed.intent === "unknown" ||
    /\b(table|pipeline|how many|what's in|what is in|show me my|crm|applications?|companies)\b/i.test(
      text
    )
  ) {
    const info = await answerCrmQuestion(text);
    if (info) {
      working.push(...info.working);
      return done(info.reply, { result: info.result });
    }
  }

  if (parsed.intent === "chat" || parsed.intent === "unknown") {
    return done(
      parsed.reply ||
        "I can find jobs, add/complete/remove tasks, paste emails, check scrapers, brief you, or explain your tables. Try: “find remote software engineer jobs”.",
      { result: { help: true } }
    );
  }

  // Fallback job search
  working.push("Searching jobs…");
  const r = await discoverJobs(text, { skipLinkedIn: true, limit: 16 });
  store.upsertJobs(r.jobs as JobListing[]);
  working.push(`Found ${r.jobs.length} roles`);
  return done(
    r.jobs.length ? `Found ${r.jobs.length} roles.` : "No roles found — try a clearer job title.",
    {
      result: {
        query: text,
        count: r.jobs.length,
        jobs: r.jobs.slice(0, 8).map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          url: j.externalUrl,
        })),
      },
      navigate: "/jobs",
    }
  );
}

async function answerCrmQuestion(text: string): Promise<{
  reply: string;
  working: string[];
  result?: Record<string, unknown>;
} | null> {
  const lower = text.toLowerCase();
  const wantsInfo =
    /\b(how many|what('s| is| are)|show|list|table|pipeline|summary|status of my|in my)\b/i.test(
      text
    ) ||
    /\b(applications?|companies|contacts|tasks|emails|jobs tracked)\b/i.test(
      text
    );
  if (!wantsInfo && !/\btable\b/i.test(text)) return null;

  const db = await loadCrm();
  const openTasks = (db.userTasks || []).filter((t) => !t.done);
  const activeApps = db.applications.filter((a) => a.status === "active");
  const working = ["Looking at your CRM tables…"];

  if (/\btasks?\b/i.test(lower) && !/\bapplication/i.test(lower)) {
    working.push(`${openTasks.length} open tasks`);
    const lines = openTasks.slice(0, 12).map((t) => `· ${t.title} [${t.kind}]`);
    return {
      working: [...working, ...lines],
      reply:
        openTasks.length === 0
          ? "Your tasks table is empty — no open tasks."
          : `Tasks table: **${openTasks.length} open**.\n${lines.join("\n")}`,
      result: {
        table: "tasks",
        count: openTasks.length,
        tasks: openTasks.slice(0, 20),
      },
    };
  }

  if (/\bcompan/i.test(lower)) {
    working.push(`${db.companies.length} companies`);
    const names = db.companies.slice(0, 15).map((c) => c.name);
    return {
      working: [...working, ...names.map((n) => `· ${n}`)],
      reply:
        db.companies.length === 0
          ? "Companies table is empty. Paste recruiter emails or add applications to fill it."
          : `Companies table: **${db.companies.length}**.\n${names.map((n) => `· ${n}`).join("\n")}`,
      result: { table: "companies", count: db.companies.length, names },
    };
  }

  if (/\bcontact/i.test(lower)) {
    working.push(`${db.contacts.length} contacts`);
    const lines = db.contacts
      .slice(0, 12)
      .map((c) => `· ${c.name} <${c.email}>${c.companyName ? ` · ${c.companyName}` : ""}`);
    return {
      working: [...working, ...lines],
      reply:
        db.contacts.length === 0
          ? "Contacts table is empty."
          : `Contacts: **${db.contacts.length}**.\n${lines.join("\n")}`,
      result: { table: "contacts", count: db.contacts.length },
    };
  }

  if (/\b(application|pipeline|stage)\b/i.test(lower)) {
    const byStage: Record<string, number> = {};
    for (const a of activeApps) {
      byStage[a.stage] = (byStage[a.stage] || 0) + 1;
    }
    const stageLines = Object.entries(byStage).map(([k, v]) => `· ${k}: ${v}`);
    const appLines = activeApps
      .slice(0, 10)
      .map((a) => `· ${a.jobTitle} @ ${a.companyName} (${a.stage})`);
    working.push(`${activeApps.length} active applications`);
    return {
      working: [...working, ...stageLines, ...appLines],
      reply:
        activeApps.length === 0
          ? "Pipeline is empty — no active applications."
          : `Pipeline: **${activeApps.length} active**.\n${stageLines.join("\n")}\n\n${appLines.join("\n")}`,
      result: {
        table: "applications",
        count: activeApps.length,
        byStage,
      },
    };
  }

  // Full tables overview
  working.push("Building tables overview…");
  const reply = [
    "Here's what's in your tables right now:",
    `· **Companies** — ${db.companies.length}`,
    `· **Contacts** — ${db.contacts.length}`,
    `· **Applications** — ${activeApps.length} active`,
    `· **Emails** — ${db.emails.length}`,
    `· **Jobs tracked** — ${db.jobs.length}`,
    `· **Open tasks** — ${openTasks.length}`,
    "",
    "Ask about a specific table, e.g. “list my tasks” or “show pipeline”.",
  ].join("\n");
  return {
    working,
    reply,
    result: {
      table: "overview",
      companies: db.companies.length,
      contacts: db.contacts.length,
      applications: activeApps.length,
      emails: db.emails.length,
      jobs: db.jobs.length,
      tasks: openTasks.length,
    },
  };
}
