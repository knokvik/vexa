"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Loader2, Maximize2, X } from "lucide-react";
import {
  getLogs,
  subscribeLogs,
  appendLog,
  type LogLine,
} from "@/lib/activity-bus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function timeLabel(at: number) {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function useLiveLogs() {
  const [logs, setLogs] = useState<LogLine[]>(() => getLogs());
  const seenTask = useRef(new Set<string>());

  useEffect(() => {
    return subscribeLogs(setLogs);
  }, []);

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

  return logs;
}

export function LiveLogsList({
  logs,
  maxHeightClass = "max-h-[200px]",
  dense,
}: {
  logs: LogLine[];
  maxHeightClass?: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("overflow-y-auto font-mono text-[11px]", maxHeightClass)}>
      {logs.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-6 text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Waiting for pipeline activity…
        </div>
      ) : (
        <ul className="divide-y divide-border/30">
          {logs.map((line) => (
            <li
              key={line.id}
              className={cn(
                "flex gap-2 hover:bg-muted/20",
                dense ? "px-2.5 py-1" : "px-3 py-1.5"
              )}
            >
              <span className="w-[4.25rem] shrink-0 tabular-nums text-muted-foreground/80">
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
  );
}

/**
 * Full-screen / side dialog of all pipeline logs.
 */
export function LogsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const logs = useLiveLogs();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="space-y-1 border-b px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4" />
            Pipeline logs
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            Live stream of search, drafts, automation, and memory events.
          </SheetDescription>
        </SheetHeader>
        <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {logs.length} line{logs.length === 1 ? "" : "s"}
          </span>
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <LiveLogsList logs={logs} maxHeightClass="h-full max-h-[calc(100vh-9rem)]" />
        </div>
        <div className="border-t p-3">
          <Button
            variant="outline"
            className="h-9 w-full rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-3.5" />
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Compact card — same footprint as “Where we applied”.
 * Click Show logs → full dialog.
 */
export function LiveLogsWidget({
  className,
}: {
  className?: string;
}) {
  const logs = useLiveLogs();
  const [dialogOpen, setDialogOpen] = useState(false);
  const preview = logs.slice(0, 6);

  return (
    <>
      <section
        className={cn(
          "overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm",
          className
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Activity className="size-3.5 shrink-0 text-muted-foreground" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Live log
            </h2>
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Maximize2 className="size-2.5" />
            Show logs
          </button>
        </div>
        <div className="p-0">
          <LiveLogsList
            logs={preview}
            maxHeightClass="max-h-[160px]"
            dense
          />
          {logs.length > 6 && (
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="w-full border-t border-border/50 py-2 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              +{logs.length - 6} more · open full log
            </button>
          )}
          {logs.length === 0 && (
            <p className="px-3 pb-3 text-center text-[10px] text-muted-foreground">
              Run Automate or Search to fill this stream.
            </p>
          )}
        </div>
      </section>
      <LogsDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
