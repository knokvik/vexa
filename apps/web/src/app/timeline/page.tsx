"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Mail,
  Calendar,
  Briefcase,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Target,
  Plus,
  Circle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { appendLog } from "@/lib/activity-bus";

type Item = {
  id: string;
  kind: "email" | "event" | "application" | "action";
  at: string;
  title: string;
  detail?: string;
  companyName?: string;
};

type Task = {
  id: string;
  title: string;
  kind: string;
  companyName?: string;
  dueAt?: string;
  done: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Briefing = {
  summary?: string;
  openActions?: Array<{
    id: string;
    title: string;
    priority: string;
    kind: string;
    dueAt?: string;
  }>;
  interviewsSoon?: Array<{ id: string; title: string; datetime?: string }>;
  conversion?: { appliedToScreen: number; screenToOffer: number };
  activeCount?: number;
};

const KIND_ICON = {
  email: Mail,
  event: Calendar,
  application: Briefcase,
  action: ListTodo,
};

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

export default function TimelinePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [newKind, setNewKind] = useState("personal");
  const [busy, setBusy] = useState(false);
  const [logFilter, setLogFilter] = useState<"all" | "today" | "week">("all");

  const load = useCallback(async (co?: string) => {
    setLoading(true);
    try {
      const q = co ? `?company=${encodeURIComponent(co)}` : "";
      const [tRes, bRes, taskRes] = await Promise.all([
        fetch(`/api/crm/timeline${q}`),
        fetch("/api/crm/briefing"),
        fetch("/api/crm/tasks"),
      ]);
      const t = await tRes.json();
      const b = await bRes.json();
      const tk = await taskRes.json();
      setItems(t.items || []);
      setBriefing(b);
      // include done for daily tracking
      const open = tk.tasks || [];
      // also load done via table? tasks API only open — re-fetch includeDone
      setTasks(open);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openTasks = useMemo(
    () => tasks.filter((t) => !t.done),
    [tasks]
  );

  const dueSoon = useMemo(() => {
    return openTasks
      .map((t) => ({ t, d: daysUntil(t.dueAt) }))
      .filter((x) => x.d != null && x.d <= 7)
      .sort((a, b) => (a.d ?? 99) - (b.d ?? 99));
  }, [openTasks]);

  const overdue = useMemo(
    () =>
      openTasks.filter((t) => {
        const d = daysUntil(t.dueAt);
        return d != null && d < 0;
      }),
    [openTasks]
  );

  async function addTask() {
    if (!newTitle.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          kind: newKind,
          dueAt: newDue
            ? new Date(newDue + "T12:00:00").toISOString()
            : undefined,
        }),
      });
      appendLog({
        kind: "task",
        message: `Task added: ${newTitle.trim()}`,
        detail: newDue ? `due ${newDue}` : undefined,
        status: "done",
      });
      setNewTitle("");
      setNewDue("");
      await load(company.trim() || undefined);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(t: Task) {
    await fetch("/api/crm/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: t.id,
        title: t.title,
        kind: t.kind,
        done: !t.done,
        dueAt: t.dueAt,
      }),
    });
    appendLog({
      kind: "task",
      message: t.done ? `Reopened: ${t.title}` : `Completed: ${t.title}`,
      status: "done",
    });
    await load(company.trim() || undefined);
  }

  async function doneAction(id: string) {
    await fetch("/api/crm/briefing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: id }),
    });
    appendLog({
      kind: "action",
      message: "Action completed",
      status: "done",
    });
    await load(company.trim() || undefined);
  }

  const filteredLog = useMemo(() => {
    const now = Date.now();
    return items.filter((it) => {
      const t = new Date(it.at).getTime();
      if (logFilter === "today") {
        return now - t < 86400000;
      }
      if (logFilter === "week") {
        return now - t < 7 * 86400000;
      }
      return true;
    });
  }, [items, logFilter]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Ops"
        title="Timeline"
        description="Current tasks · deadlines · daily complete · activity log hooks."
      />

      {/* Focus strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
            <Target className="size-3.5" /> Today
          </p>
          <p className="mt-1 text-sm font-medium leading-snug">
            {briefing?.summary || "No briefing yet"}
          </p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {openTasks.length} open tasks · {overdue.length} overdue
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            Conversion
          </p>
          <p className="mt-2 font-mono text-2xl font-semibold">
            {briefing?.conversion?.appliedToScreen ?? 0}
            <span className="text-sm font-normal text-muted-foreground">
              % →screen
            </span>
          </p>
          <p className="font-mono text-sm text-muted-foreground">
            {briefing?.conversion?.screenToOffer ?? 0}% →offer
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
            <AlertTriangle className="size-3.5 text-amber-500" /> Deadlines
          </p>
          <ul className="mt-1.5 max-h-20 space-y-1 overflow-y-auto">
            {dueSoon.slice(0, 4).map(({ t, d }) => (
              <li key={t.id} className="truncate text-xs">
                <span
                  className={cn(
                    "font-mono",
                    (d ?? 0) < 0 ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {d != null && d < 0
                    ? `${Math.abs(d)}d late`
                    : d === 0
                      ? "today"
                      : `${d}d`}
                </span>{" "}
                {t.title}
              </li>
            ))}
            {!dueSoon.length && (
              <li className="text-xs text-muted-foreground">
                No deadlines in 7 days
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* Current tasks table */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Current tasks
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {openTasks.length} open
            </span>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-[10px] font-medium text-muted-foreground">
                <th className="w-8 px-2 py-1.5" />
                <th className="px-2 py-1.5">Task</th>
                <th className="px-2 py-1.5">Kind</th>
                <th className="px-2 py-1.5 text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {openTasks.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    No open tasks — add below
                  </td>
                </tr>
              )}
              {openTasks.map((t) => {
                const d = daysUntil(t.dueAt);
                return (
                  <tr
                    key={t.id}
                    className="border-t border-border/50 hover:bg-muted/40"
                  >
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted"
                        title="Mark complete"
                        onClick={() => void toggleTask(t)}
                      >
                        <Circle className="size-4 text-muted-foreground" />
                      </button>
                    </td>
                    <td className="px-2 py-2 text-sm font-medium">{t.title}</td>
                    <td className="px-2 py-2">
                      <Badge variant="outline" className="text-[9px] capitalize">
                        {t.kind}
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2 text-right font-mono text-[11px]",
                        d != null && d < 0
                          ? "text-destructive"
                          : d != null && d <= 2
                            ? "text-amber-600"
                            : "text-muted-foreground"
                      )}
                    >
                      {t.dueAt?.slice(0, 10) || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Add task */}
          <div className="space-y-2 border-t p-3">
            <div className="flex flex-wrap gap-1">
              {(["personal", "job", "interview", "conference"] as const).map(
                (k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setNewKind(k)}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[10px] capitalize",
                      newKind === k
                        ? "border-foreground bg-foreground text-background"
                        : "text-muted-foreground"
                    )}
                  >
                    {k}
                  </button>
                )
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Input
                className="h-8 min-w-[140px] flex-1 text-xs"
                placeholder="Task title…"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addTask()}
              />
              <Input
                type="date"
                className="h-8 w-[140px] text-xs"
                value={newDue}
                onChange={(e) => setNewDue(e.target.value)}
              />
              <Button
                size="sm"
                className="h-8"
                disabled={busy || !newTitle.trim()}
                onClick={() => void addTask()}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Plus className="size-3.5" />
                )}
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* System actions + interviews */}
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested actions
            </div>
            <ul className="max-h-48 divide-y overflow-y-auto">
              {(briefing?.openActions || []).slice(0, 8).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {a.kind} · {a.priority}
                      {a.dueAt ? ` · ${a.dueAt.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 text-xs"
                    onClick={() => void doneAction(a.id)}
                  >
                    <CheckCircle2 className="size-3.5" /> Done
                  </Button>
                </li>
              ))}
              {!briefing?.openActions?.length && (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No system actions — ingest emails to generate follow-ups
                </li>
              )}
            </ul>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Upcoming interviews
            </div>
            <ul className="divide-y">
              {(briefing?.interviewsSoon || []).map((e) => (
                <li key={e.id} className="px-3 py-2 text-sm">
                  <p className="font-medium">{e.title}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {e.datetime?.slice(0, 16).replace("T", " ") || "TBD"}
                  </p>
                </li>
              ))}
              {!briefing?.interviewsSoon?.length && (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                  None in 48h
                </li>
              )}
            </ul>
          </div>

          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/workspace">Open full tables →</Link>
          </Button>
        </div>
      </div>

      {/* Activity log (hooks) */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Activity log
          </span>
          <div className="flex gap-1">
            {(["all", "today", "week"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setLogFilter(f)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] capitalize",
                  logFilter === f
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="border-b px-3 py-2">
          <Input
            placeholder="Filter log by company…"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void load(company.trim() || undefined);
            }}
            className="h-8 max-w-xs text-xs"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-3 py-8 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (
          <ol className="max-h-80 space-y-0 overflow-y-auto border-l-0 p-3">
            {filteredLog.map((item) => {
              const Icon = KIND_ICON[item.kind] || Mail;
              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex gap-2 border-b border-border/40 py-2 last:border-0"
                >
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[9px]">
                        {item.kind}
                      </Badge>
                      <time className="font-mono text-[10px] text-muted-foreground">
                        {item.at?.slice(0, 16).replace("T", " ")}
                      </time>
                      {item.companyName && (
                        <span className="text-[11px] text-muted-foreground">
                          {item.companyName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.detail && (
                      <p className="text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
            {filteredLog.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No log entries. Commands on Home append here as hooks.
              </li>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}
