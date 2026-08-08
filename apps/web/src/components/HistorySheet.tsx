"use client";

import { useEffect } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/command-history";

type ChangeRow = {
  action: "added" | "updated" | "completed" | "removed" | "found" | "info";
  table: string;
  detail: string;
};

function rowsFromEntry(h: HistoryEntry): ChangeRow[] {
  const rows: ChangeRow[] = [];
  const intent = h.intent || "";
  const r = h.result || {};

  if (intent === "email_ingest") {
    const ex = (r.extracted || {}) as Record<string, string>;
    rows.push({
      action: "added",
      table: "emails",
      detail: String(ex.jobTitle || h.summary || "email"),
    });
    if (ex.companyName)
      rows.push({
        action: "updated",
        table: "companies",
        detail: ex.companyName,
      });
    if (r.stage)
      rows.push({
        action: "updated",
        table: "applications",
        detail: `stage → ${r.stage}`,
      });
  } else if (intent === "job_search" || intent === "start_scrape") {
    const jobs = (r.jobs as Array<{ title?: string; company?: string }>) || [];
    const n = (r.count as number) ?? jobs.length;
    rows.push({
      action: "found",
      table: "jobs",
      detail: `${n} role(s) from scrapers`,
    });
    for (const j of jobs.slice(0, 6)) {
      rows.push({
        action: "added",
        table: "jobs",
        detail: `${j.title || "Role"} · ${j.company || ""}`,
      });
    }
    const sources = r.sources as Record<string, { count?: number }> | undefined;
    if (sources) {
      for (const [k, v] of Object.entries(sources).slice(0, 8)) {
        rows.push({
          action: "info",
          table: "scrapers",
          detail: `${k}: ${v.count ?? 0}`,
        });
      }
    }
  } else if (intent === "add_task") {
    const t = r.task as { title?: string; kind?: string } | undefined;
    rows.push({
      action: "added",
      table: "tasks",
      detail: t?.title || h.summary,
    });
  } else if (intent === "complete_task") {
    const t = r.task as { title?: string } | undefined;
    rows.push({
      action: "completed",
      table: "tasks",
      detail: t?.title || h.summary,
    });
  } else if (intent === "remove_task") {
    rows.push({
      action: "removed",
      table: "tasks",
      detail: String(r.title || h.summary),
    });
  } else if (intent === "list_tasks") {
    const tasks = (r.tasks as Array<{ title?: string }>) || [];
    rows.push({
      action: "info",
      table: "tasks",
      detail: `${tasks.length} open`,
    });
    for (const t of tasks.slice(0, 8)) {
      rows.push({ action: "info", table: "tasks", detail: t.title || "—" });
    }
  } else if (intent === "services_status") {
    const services =
      (r.services as Array<{ name?: string; status?: string }>) || [];
    rows.push({
      action: "info",
      table: "services",
      detail: String(r.summary || "status"),
    });
    for (const s of services.slice(0, 10)) {
      rows.push({
        action: "info",
        table: "services",
        detail: `${s.name}: ${s.status}`,
      });
    }
  } else if (intent === "network_query") {
    const contacts =
      (r.contacts as Array<{ name?: string; email?: string }>) || [];
    rows.push({
      action: "found",
      table: "contacts",
      detail: `${contacts.length} at ${r.company || "company"}`,
    });
    for (const c of contacts.slice(0, 6)) {
      rows.push({
        action: "info",
        table: "contacts",
        detail: `${c.name} · ${c.email}`,
      });
    }
  } else if (intent === "briefing") {
    rows.push({
      action: "info",
      table: "briefing",
      detail: String(r.summary || h.summary),
    });
  } else {
    for (const line of h.working || []) {
      rows.push({ action: "info", table: "log", detail: line });
    }
  }

  if (!rows.length) {
    rows.push({ action: "info", table: "log", detail: h.summary });
  }
  return rows;
}

const ACTION_STYLE: Record<ChangeRow["action"], string> = {
  added: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  updated: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  removed: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  found: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  info: "bg-muted text-muted-foreground",
};

/**
 * Apple-style sheet rising from bottom with green change rows.
 */
export function HistorySheet({
  entry,
  open,
  onClose,
}: {
  entry: HistoryEntry | null;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const rows = entry ? rowsFromEntry(entry) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed inset-x-0 bottom-0 z-[70] mx-auto max-w-lg px-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-y-0" : "translate-y-[110%]"
        )}
      >
        <div className="overflow-hidden rounded-t-[1.25rem] border border-border/80 bg-background shadow-2xl ring-1 ring-black/5 dark:ring-white/10">
          {/* Grabber */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="h-1 w-9 rounded-full bg-muted-foreground/30" />
          </div>

          <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-1">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                What changed
              </p>
              <p className="truncate text-sm font-semibold">
                {entry?.summary || "—"}
              </p>
              {entry?.intent && (
                <Badge variant="secondary" className="mt-1 text-[9px]">
                  {entry.intent}
                </Badge>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 rounded-full"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>

          <p className="line-clamp-2 px-4 text-[11px] text-muted-foreground">
            {entry?.prompt}
          </p>

          {/* Scrollable body when many rows / long steps */}
          <div className="mt-3 max-h-[min(62vh,480px)] overflow-y-auto overscroll-contain px-3 pb-2">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-1.5">Action</th>
                  <th className="px-2 py-1.5">Table</th>
                  <th className="px-2 py-1.5">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "border-t border-border/40 text-[12px]",
                      row.action === "added" || row.action === "completed"
                        ? "bg-emerald-500/[0.07]"
                        : ""
                    )}
                  >
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize",
                          ACTION_STYLE[row.action]
                        )}
                      >
                        {(row.action === "added" ||
                          row.action === "completed") && (
                          <CheckCircle2 className="size-3" />
                        )}
                        {row.action}
                      </span>
                    </td>
                    <td className="px-2 py-2 font-mono text-[11px] text-muted-foreground">
                      {row.table}
                    </td>
                    <td className="px-2 py-2 text-[12px] font-medium">
                      {row.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {entry?.working && entry.working.length > 0 && (
              <div className="mt-3 rounded-xl border bg-muted/30 p-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                  Steps
                </p>
                <ul className="space-y-0.5">
                  {entry.working.map((line, i) => (
                    <li
                      key={i}
                      className="font-mono text-[10px] text-muted-foreground"
                    >
                      · {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t px-4 py-3">
            {(entry?.intent === "job_search" ||
              entry?.intent === "start_scrape") && (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <Link href="/jobs" onClick={onClose}>
                  Open jobs
                </Link>
              </Button>
            )}
            {(entry?.intent === "add_task" ||
              entry?.intent === "list_tasks" ||
              entry?.intent === "complete_task") && (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <Link href="/timeline" onClick={onClose}>
                  Timeline
                </Link>
              </Button>
            )}
            {entry?.intent === "services_status" && (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <Link href="/services" onClick={onClose}>
                  Services
                </Link>
              </Button>
            )}
            {(entry?.intent === "email_ingest" ||
              entry?.intent === "workspace") && (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                <Link href="/workspace" onClick={onClose}>
                  Tables
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              className="ml-auto h-8 text-xs"
              onClick={onClose}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
