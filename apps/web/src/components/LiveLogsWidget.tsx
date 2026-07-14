"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Loader2 } from "lucide-react";
import {
  getLogs,
  subscribeLogs,
  appendLog,
  type LogLine,
} from "@/lib/activity-bus";
import { cn } from "@/lib/utils";

function timeLabel(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Continuous live log stream for the dashboard — no toast overlay.
 * Merges activity bus + polled tasks/memory events.
 */
export function LiveLogsWidget() {
  const [logs, setLogs] = useState<LogLine[]>(() => getLogs());
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenTask = useRef(new Set<string>());

  useEffect(() => {
    return subscribeLogs(setLogs);
  }, []);

  // Seed + poll server events into the same feed
  useEffect(() => {
    let cancelled = false;

    async function pull() {
      try {
        const [tRes, jRes] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/jobs"),
        ]);
        const t = await tRes.json();
        const j = await jRes.json();
        if (cancelled) return;

        const events = t.appMemory?.events || [];
        for (const ev of events.slice(0, 12)) {
          const id = ev.id || `${ev.at}_${ev.type}`;
          if (seenTask.current.has(id)) continue;
          seenTask.current.add(id);
          appendLog({
            id: `mem_${id}`,
            kind: ev.type || "memory",
            message:
              ev.note ||
              [ev.company, ev.title].filter(Boolean).join(" — ") ||
              ev.type ||
              "event",
            detail: ev.company,
            status: "info",
          });
        }

        for (const task of (t.tasks || []).slice(0, 8)) {
          const id = task.id;
          if (seenTask.current.has(`task_${id}`)) continue;
          seenTask.current.add(`task_${id}`);
          appendLog({
            id: `task_${id}`,
            kind: task.type || "task",
            message: `${(task.type || "task").replace(/_/g, " ")} · ${task.status}`,
            detail: task.meta?.company,
            status:
              task.status === "done"
                ? "done"
                : task.status === "failed"
                  ? "error"
                  : task.status === "running"
                    ? "running"
                    : "info",
          });
        }

        const jobs = j.jobs || [];
        if (jobs.length && !seenTask.current.has("jobs_count")) {
          seenTask.current.add("jobs_count");
          appendLog({
            kind: "pipeline",
            message: `${jobs.length} roles in pipeline`,
            status: "info",
          });
        }
      } catch {
        /* ignore */
      }
    }

    void pull();
    const id = setInterval(pull, 12000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Keep scroll at top (newest first) — no need to scroll
  useEffect(() => {
    bottomRef.current?.scrollTo?.({ top: 0 });
  }, [logs.length]);

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Activity className="size-3.5 text-muted-foreground" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Live log
          </h2>
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {logs.length} lines
        </span>
      </div>
      <div
        ref={bottomRef}
        className="max-h-[220px] overflow-y-auto font-mono text-[11px]"
      >
        {logs.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-6 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Waiting for pipeline activity…
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {logs.map((line) => (
              <li
                key={line.id}
                className="flex gap-2 px-3 py-1.5 hover:bg-muted/20"
              >
                <span className="w-[4.5rem] shrink-0 tabular-nums text-muted-foreground/80">
                  {timeLabel(line.at)}
                </span>
                <span
                  className={cn(
                    "mt-1 size-1.5 shrink-0 rounded-full",
                    line.status === "running" && "animate-pulse bg-primary",
                    line.status === "done" && "bg-success",
                    line.status === "error" && "bg-destructive",
                    (!line.status || line.status === "info") &&
                      "bg-muted-foreground/50"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground/90">{line.message}</p>
                  {(line.kind || line.detail) && (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {line.kind}
                      {line.detail ? ` · ${line.detail}` : ""}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
