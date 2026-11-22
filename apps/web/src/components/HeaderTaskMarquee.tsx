"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarqueeTask {
  id: string;
  title: string;
  kind?: string;
  quadrant?: "q1" | "q2" | "q3" | "q4";
  done: boolean;
  dueAt?: string;
}

const CATEGORY_STYLES: Record<
  string,
  { dot: string; border: string; text: string }
> = {
  personal: {
    dot: "bg-pink-500 shadow-[0_0_6px_rgba(236,72,153,0.8)]",
    border: "border-pink-500/20 hover:border-pink-500/50",
    text: "text-pink-500 dark:text-pink-400",
  },
  college: {
    dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]",
    border: "border-emerald-500/20 hover:border-emerald-500/50",
    text: "text-emerald-500 dark:text-emerald-400",
  },
  interview: {
    dot: "bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]",
    border: "border-cyan-500/20 hover:border-cyan-500/50",
    text: "text-cyan-500 dark:text-cyan-400",
  },
  project_prep: {
    dot: "bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]",
    border: "border-cyan-500/20 hover:border-cyan-500/50",
    text: "text-cyan-500 dark:text-cyan-400",
  },
  other: {
    dot: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]",
    border: "border-amber-500/20 hover:border-amber-500/50",
    text: "text-amber-500 dark:text-amber-400",
  },
};

const QUAD_LABELS: Record<string, string> = {
  q1: "Q1",
  q2: "Q2",
  q3: "Q3",
  q4: "Q4",
};

function formatDue(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function HeaderTaskMarquee() {
  const [tasks, setTasks] = useState<MarqueeTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      try {
        const res = await fetch("/api/crm/tasks");
        if (!res.ok) return;
        const data = await res.json();
        const active = (data.tasks || []).filter((t: MarqueeTask) => !t.done);
        if (!cancelled) {
          setTasks(active);
          setLoading(false);
        }
      } catch {
        // silent fail
      }
    }

    void loadTasks();
    const interval = setInterval(loadTasks, 20000);

    const handleUpdate = () => void loadTasks();
    window.addEventListener("vexa-task-updated", handleUpdate);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("vexa-task-updated", handleUpdate);
    };
  }, []);

  const openTasks = useMemo(() => {
    return tasks.slice(0, 16);
  }, [tasks]);

  if (loading && tasks.length === 0) {
    return null;
  }

  if (openTasks.length === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
        <Sparkles className="size-3 text-emerald-500" />
        <span>All tasks complete · Matrix clear</span>
      </div>
    );
  }

  // Duplicate for smooth infinite CSS loop
  const duplicated = [...openTasks, ...openTasks];

  return (
    <div
      className={cn(
        "relative flex h-8 w-full max-w-xl lg:max-w-2xl xl:max-w-3xl items-center overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent_0%,black_8%,black_92%,transparent_100%)] select-none"
      )}
      title="Live Tasks Ticker · Hover to pause"
    >
      <div className="animate-vexa-marquee flex items-center gap-2.5">
        {duplicated.map((task, idx) => {
          const kind = (task.kind || "other").toLowerCase();
          const style = CATEGORY_STYLES[kind] || CATEGORY_STYLES.other;
          const q = task.quadrant || "q2";
          const due = formatDue(task.dueAt);

          return (
            <Link
              key={`${task.id}-${idx}`}
              href="/"
              className={cn(
                "group/chip inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-0.5 text-xs shadow-xs",
                "backdrop-blur-md transition-all duration-200 hover:scale-[1.03] hover:bg-muted/80",
                style.border
              )}
            >
              {/* Category Dot */}
              <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />

              {/* Quadrant Pill */}
              <span className="font-mono text-[9px] font-semibold text-muted-foreground">
                {QUAD_LABELS[q]}
              </span>

              {/* Title */}
              <span className="max-w-[150px] sm:max-w-[200px] truncate font-medium text-[11px] text-foreground group-hover/chip:text-primary transition-colors">
                {task.title}
              </span>

              {/* Due Date if present */}
              {due && (
                <span className="shrink-0 font-mono text-[9px] text-muted-foreground/80 bg-muted/60 px-1.5 py-0.2 rounded">
                  {due}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
