"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  subscribeLogs,
  getLogs,
  subscribeActivity,
  getCurrentActivity,
  type LogLine,
  type ActivityEvent,
} from "@/lib/activity-bus";
import { cn } from "@/lib/utils";

/**
 * Animated log strip for the title bar — shows latest CRM / AI action.
 */
export function HeaderActivityTicker({ className }: { className?: string }) {
  const [line, setLine] = useState<LogLine | null>(null);
  const [running, setRunning] = useState<ActivityEvent | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const logs = getLogs();
    if (logs[0]) setLine(logs[0]);
    setRunning(getCurrentActivity());

    const unsubL = subscribeLogs((logs) => {
      if (logs[0]) {
        setLine(logs[0]);
        setPulse(true);
        window.setTimeout(() => setPulse(false), 600);
      }
    });
    const unsubA = subscribeActivity((e) => setRunning(e));
    return () => {
      unsubL();
      unsubA();
    };
  }, []);

  const text =
    running?.status === "running"
      ? running.action
      : line
        ? line.message
        : "Ready";

  const isRun =
    running?.status === "running" || line?.status === "running";

  return (
    <div
      className={cn(
        "hidden max-w-[min(40vw,280px)] items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[11px] transition-all duration-500 md:flex",
        pulse && "bg-emerald-500/15 ring-1 ring-emerald-500/30",
        isRun && "text-foreground",
        !isRun && "text-muted-foreground",
        className
      )}
      title={line?.detail || text}
    >
      {isRun ? (
        <Loader2 className="size-3 shrink-0 animate-spin text-emerald-500" />
      ) : (
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            line?.status === "error"
              ? "bg-destructive"
              : line
                ? "bg-emerald-500"
                : "bg-muted-foreground/40"
          )}
        />
      )}
      <span className="truncate font-mono tracking-tight">{text}</span>
    </div>
  );
}
