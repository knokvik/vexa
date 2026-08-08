import { NextResponse } from "next/server";
import { parseCommand, liveSuggestions } from "@/lib/crm/command";
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
} from "@/lib/crm/db";
import type { JobListing } from "@vexa/shared";
import { rememberEvent } from "@/lib/app-memory";

/**
 * Universal command bar — email, jobs, tasks, scrapers, services.
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

    const parsed = parseCommand(text);
    const working: string[] = [`Intent: ${parsed.intent}`];

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
      return NextResponse.json({
        ok: true,
        intent: parsed.intent,
        working,
        result: {
          classification: result.classification,
          stage: result.stage,
          companyId: result.companyId,
          applicationId: result.applicationId,
          extracted: result.email.extracted,
        },
        suggestions: parsed.suggestions,
      });
    }

    if (
      parsed.intent === "job_search" ||
      parsed.intent === "start_scrape"
    ) {
      const query = parsed.query || text;
      working.push(
        parsed.intent === "start_scrape"
          ? `Starting free scrapers for “${query}”…`
          : `Searching free boards for “${query}”…`
      );
      await store.ensureHydrated();
      const r = await discoverJobs(query, { skipLinkedIn: true, limit: 30 });
      store.upsertJobs(r.jobs as JobListing[]);
      const sourceLines = Object.entries(r.sources || {}).map(
        ([k, v]) =>
          `${k}: ${(v as { count?: number; error?: string }).count ?? 0}${(v as { error?: string }).error ? ` (${(v as { error?: string }).error})` : ""}`
      );
      working.push(`Found ${r.jobs.length} roles`);
      working.push(...sourceLines.slice(0, 12));
      await rememberEvent({
        type: "search",
        query,
        note: `command discover=${r.jobs.length}`,
      }).catch(() => null);
      return NextResponse.json({
        ok: true,
        intent: parsed.intent,
        working,
        result: {
          query,
          count: r.jobs.length,
          jobs: r.jobs.slice(0, 10).map((j) => ({
            id: j.id,
            title: j.title,
            company: j.company,
            url: j.externalUrl,
            source: j.source,
          })),
          sources: r.sources,
        },
        suggestions: parsed.suggestions,
        navigate: "/jobs",
      });
    }

    if (parsed.intent === "services_status") {
      working.push("Checking live services…");
      const { GET: statusGet } = await import("@/app/api/services/status/route");
      const res = await statusGet();
      const data = await res.json();
      const services = (data.services || []) as Array<{
        name: string;
        status: string;
        workingOn: string;
        kind: string;
      }>;
      working.push(data.summary || `${services.length} services`);
      for (const s of services.slice(0, 14)) {
        working.push(`${s.name}: ${s.status} — ${s.workingOn}`);
      }
      return NextResponse.json({
        ok: true,
        intent: parsed.intent,
        working,
        result: { summary: data.summary, services },
        suggestions: parsed.suggestions,
        navigate: "/services",
      });
    }

    if (parsed.intent === "network_query") {
      const company = parsed.company || parsed.query || text;
      working.push(`Looking up contacts at ${company}…`);
      const direct = await whoDoIKnowAt(company);
      working.push(`${direct.length} contact(s)`);
      return NextResponse.json({
        ok: true,
        intent: parsed.intent,
        working,
        result: {
          company,
          contacts: direct.map((d) => ({
            name: d.contact.name,
            email: d.contact.email,
            role: d.contact.roleType,
            title: d.contact.title,
          })),
        },
        suggestions: parsed.suggestions,
      });
    }

    if (parsed.intent === "add_task") {
      const title = parsed.taskTitle || text;
      working.push(`Creating task: ${title}`);
      const task = await upsertUserTask({
        title,
        kind: parsed.taskKind || "personal",
      });
      working.push(`Saved · id ${task.id} · kind ${task.kind}`);
      return NextResponse.json({
        ok: true,
        intent: parsed.intent,
        working,
        result: { task },
        suggestions: parsed.suggestions,
      });
    }

    if (parsed.intent === "complete_task") {
      const q = parsed.taskTitle || text;
      working.push(`Completing task matching “${q}”…`);
      const hits = await findTasksByTitle(q);
      const open = hits.filter((t) => !t.done);
      if (!open.length) {
        working.push("No open task matched");
        return NextResponse.json({
          ok: true,
          intent: parsed.intent,
          working,
          result: { matched: 0 },
          suggestions: ["List tasks", "Task: new item"],
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
      return NextResponse.json({
        ok: true,
        intent: parsed.intent,
        working,
        result: { task: { ...t, done: true } },
        suggestions: parsed.suggestions,
      });
    }

    if (parsed.intent === "remove_task") {
      const q = parsed.taskTitle || text;
      working.push(`Removing task matching “${q}”…`);
      const hits = await findTasksByTitle(q);
      if (!hits.length) {
        working.push("No task matched");
        return NextResponse.json({
          ok: true,
          intent: parsed.intent,
          working,
          result: { removed: 0 },
        });
      }
      const t = hits[0];
      await deleteUserTask(t.id);
      working.push(`Removed: ${t.title}`);
      return NextResponse.json({
        ok: true,
        intent: parsed.intent,
        working,
        result: { removed: 1, title: t.title },
        suggestions: parsed.suggestions,
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
      return NextResponse.json({
        ok: true,
        intent: parsed.intent,
        working,
        result: {
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            kind: t.kind,
            dueAt: t.dueAt,
            done: t.done,
          })),
        },
        suggestions: parsed.suggestions,
        navigate: "/timeline",
      });
    }

    if (parsed.intent === "briefing") {
      working.push("Running action engine…");
      const briefing = await morningBriefing();
      working.push(briefing.summary);
      return NextResponse.json({
        ok: true,
        intent: parsed.intent,
        working,
        result: briefing,
        suggestions: parsed.suggestions,
      });
    }

    if (parsed.intent === "workspace" || /workspace|tables?/i.test(text)) {
      return NextResponse.json({
        ok: true,
        intent: "workspace",
        working: ["Open Workspace for tables"],
        result: { navigate: "/workspace" },
        suggestions: ["List tasks", "Service status"],
        navigate: "/workspace",
      });
    }

    // Fallback job search
    working.push("Treating as job search…");
    const r = await discoverJobs(text, { skipLinkedIn: true, limit: 16 });
    store.upsertJobs(r.jobs as JobListing[]);
    working.push(`Found ${r.jobs.length} roles`);
    return NextResponse.json({
      ok: true,
      intent: "job_search",
      working,
      result: {
        query: text,
        count: r.jobs.length,
        jobs: r.jobs.slice(0, 6).map((j) => ({
          id: j.id,
          title: j.title,
          company: j.company,
          url: j.externalUrl,
        })),
      },
      suggestions: liveSuggestions(text),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "command failed" },
      { status: 500 }
    );
  }
}
