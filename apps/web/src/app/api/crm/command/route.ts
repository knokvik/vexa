import { NextResponse } from "next/server";
import {
  parseCommand,
  parseCommandSmart,
  liveSuggestions,
} from "@/lib/crm/command";
import { ingestEmail, parsePastedEmail } from "@/lib/crm/ingest";
import { discoverJobs } from "@/lib/discover";
import { store } from "@/lib/store";
import { whoDoIKnowAt } from "@/lib/crm/graph";
import { morningBriefing } from "@/lib/crm/actions";
import {
  upsertUserTask,
  deleteUserTask,
  findTasksByTitle,
  listUserTasks,
  listApplications,
  upsertApplication,
} from "@/lib/crm/db";
import type { JobListing, PipelineStage } from "@vexa/shared";
import { rememberEvent } from "@/lib/app-memory";

/**
 * Chatbot-style command bar: understand intent, run the tool, reply.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (typeof body.suggest === "string") {
      return NextResponse.json({
        ok: true,
        suggestions: liveSuggestions(body.suggest),
        parse: parseCommand(body.suggest),
      });
    }

    const text = String(body.text || body.raw || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const parsed = await parseCommandSmart(text);
    const working: string[] = [
      `Understood: ${parsed.intent}${parsed.confidence ? ` (${Math.round(parsed.confidence * 100)}%)` : ""}`,
    ];
    if (parsed.reply) working.push(parsed.reply);

    const withReply = (
      extra: Record<string, unknown>,
      reply?: string
    ) =>
      NextResponse.json({
        ok: true,
        intent: parsed.intent,
        reply: reply || parsed.reply || working[working.length - 1],
        working,
        suggestions: parsed.suggestions,
        ...extra,
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
      return withReply(
        {
          result: {
            classification: result.classification,
            stage: result.stage,
            companyId: result.companyId,
            applicationId: result.applicationId,
            extracted: result.email.extracted,
          },
        },
        `Filed as ${result.classification}${result.stage ? ` · stage ${result.stage}` : ""}${result.email.extracted.companyName ? ` · ${result.email.extracted.companyName}` : ""}.`
      );
    }

    if (
      parsed.intent === "job_search" ||
      parsed.intent === "start_scrape"
    ) {
      const query = (parsed.query || text).trim() || "software engineer";
      working.push(`Searching free boards for “${query}”…`);
      await store.ensureHydrated();
      const r = await discoverJobs(query, { skipLinkedIn: true, limit: 30 });
      store.upsertJobs(r.jobs as JobListing[]);
      const sourceLines = Object.entries(r.sources || {}).map(
        ([k, v]) =>
          `${k}: ${(v as { count?: number; error?: string }).count ?? 0}${(v as { error?: string }).error ? ` (!)` : ""}`
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

      return withReply(
        {
          result: {
            query,
            count: r.jobs.length,
            jobs: top,
            sources: r.sources,
          },
          navigate: "/jobs",
        },
        r.jobs.length
          ? `Found ${r.jobs.length} roles for “${query}”. Top ones are listed below — open Jobs for the full board.`
          : `No solid matches for “${query}” yet. Try a more specific role or keywords.`
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
      return withReply(
        {
          result: { summary: data.summary, services },
          navigate: "/services",
        },
        data.summary || "Service status ready."
      );
    }

    if (parsed.intent === "network_query") {
      const company = parsed.company || parsed.query || text;
      working.push(`Looking up contacts at ${company}…`);
      const direct = await whoDoIKnowAt(company);
      working.push(`${direct.length} contact(s)`);
      for (const d of direct.slice(0, 8)) {
        working.push(`· ${d.contact.name} <${d.contact.email}>`);
      }
      return withReply(
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
        },
        direct.length
          ? `You have ${direct.length} contact(s) at ${company}.`
          : `No contacts at ${company} yet — paste recruiter emails to grow the graph.`
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
      return withReply(
        { result: { task }, navigate: "/timeline" },
        `Added task “${task.title}” to your timeline.`
      );
    }

    if (parsed.intent === "complete_task") {
      const q = parsed.taskTitle || text;
      working.push(`Completing task matching “${q}”…`);
      const hits = await findTasksByTitle(q);
      const open = hits.filter((t) => !t.done);
      if (!open.length) {
        working.push("No open task matched");
        return withReply(
          { result: { matched: 0 } },
          `I couldn't find an open task matching “${q}”. Try “list tasks”.`
        );
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
      return withReply(
        { result: { task: { ...t, done: true } } },
        `Done — “${t.title}” is completed.`
      );
    }

    if (parsed.intent === "remove_task") {
      const q = parsed.taskTitle || text;
      working.push(`Removing task matching “${q}”…`);
      const hits = await findTasksByTitle(q);
      if (!hits.length) {
        working.push("No task matched");
        return withReply(
          { result: { removed: 0 } },
          `No task matched “${q}”.`
        );
      }
      const t = hits[0];
      await deleteUserTask(t.id);
      working.push(`Removed: ${t.title}`);
      return withReply(
        { result: { removed: 1, title: t.title } },
        `Removed “${t.title}”.`
      );
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
      return withReply(
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
        },
        tasks.length
          ? `You have ${tasks.length} open task(s).`
          : "No open tasks — say “add task: …” to create one."
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
        return withReply(
          { result: { updated: 0 } },
          `No active applications matched “${company}”.`
        );
      }
      for (const a of hits.slice(0, 5)) {
        await upsertApplication({
          ...a,
          stage,
          lastTouchAt: new Date().toISOString(),
        });
        working.push(`· ${a.jobTitle} @ ${a.companyName} → ${stage}`);
      }
      return withReply(
        { result: { updated: hits.length, stage, company } },
        `Updated ${Math.min(hits.length, 5)} application(s) to “${stage}”.`
      );
    }

    if (parsed.intent === "briefing") {
      working.push("Running action engine…");
      const briefing = await morningBriefing();
      working.push(briefing.summary);
      return withReply(
        { result: briefing, navigate: "/timeline" },
        briefing.summary
      );
    }

    if (parsed.intent === "workspace") {
      return withReply(
        {
          working: ["Open Workspace for tables"],
          result: { navigate: "/workspace" },
          navigate: "/workspace",
        },
        "Opening your tables workspace."
      );
    }

    if (parsed.intent === "chat" || parsed.intent === "unknown") {
      return withReply(
        {
          result: { help: true },
        },
        parsed.reply ||
          "I can find jobs, add/complete/remove tasks, paste emails, check scrapers, or brief you. Try: “find remote software engineer jobs”."
      );
    }

    // Fallback: job search
    working.push("Searching jobs…");
    const r = await discoverJobs(text, { skipLinkedIn: true, limit: 16 });
    store.upsertJobs(r.jobs as JobListing[]);
    working.push(`Found ${r.jobs.length} roles`);
    return withReply(
      {
        intent: "job_search",
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
      },
      r.jobs.length
        ? `Found ${r.jobs.length} roles.`
        : "No roles found — try a clearer job title."
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "command failed",
        reply: e instanceof Error ? e.message : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
