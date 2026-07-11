"use client";

import { useEffect, useState } from "react";
import { Activity, Cpu, X } from "lucide-react";
import {
  subscribeActivity,
  type ActivityEvent,
} from "@/lib/activity-bus";
import { cn } from "@/lib/utils";

export function ActivityHud() {
  const [event, setEvent] = useState<ActivityEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const unsub = subscribeActivity((e) => {
      setEvent(e);
      if (e) setHidden(false);
    });
    return () => {
      unsub();
    };
  }, []);

  if (hidden || !event) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-[60] w-[min(100vw-2rem,320px)] rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur",
        "animate-in fade-in slide-in-from-bottom-2 duration-200"
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Activity className="size-3.5" />
          Engine activity
        </div>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:bg-muted"
          onClick={() => setHidden(true)}
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="flex items-start gap-2">
        <Cpu
          className={cn(
            "mt-0.5 size-4 shrink-0",
            event.status === "running" && "animate-pulse text-primary",
            event.status === "done" && "text-success",
            event.status === "error" && "text-destructive"
          )}
        />
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-medium leading-snug">{event.action}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">
            {event.tool}
            {event.model ? ` · ${event.model}` : ""}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {event.status}
          </p>
        </div>
      </div>
    </div>
  );
}

// re-export for convenience in client components
export { reportActivity } from "@/lib/activity-bus";
