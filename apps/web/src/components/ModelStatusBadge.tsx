"use client";

import { useCallback, useEffect, useState } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RuntimeStatus = {
  configured?: boolean;
  primary?: string;
  displayModel?: string;
  displayState?: "no_key" | "heuristic" | "running" | "idle";
  running?: { model: string; role?: string | null } | null;
  last?: {
    model: string;
    role?: string | null;
    ok?: boolean | null;
    error?: string | null;
  } | null;
  circuit?: { open?: boolean; failures?: number };
  stats?: { totalCalls?: number; totalSuccess?: number };
  pool?: string[];
};

function short(m?: string | null) {
  if (!m) return "—";
  const base = m.split("/").pop() || m;
  return base.replace(/:free$/i, "").slice(0, 36);
}

/**
 * Same ghost icon style as theme / vault — hover shows which model (e.g. Gemma).
 */
export function ModelStatusBadge() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/health/llm?status=1", {
        cache: "no-store",
      });
      setStatus(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [load]);

  const state = status?.displayState || "idle";
  const modelName =
    state === "running"
      ? short(status?.running?.model || status?.displayModel)
      : state === "heuristic"
        ? "Local heuristics"
        : state === "no_key"
          ? "No API key"
          : short(status?.displayModel || status?.primary);
  const fullModel =
    status?.running?.model || status?.last?.model || status?.primary || "—";

  return (
    <div className="group relative">
      <button
        type="button"
        className={cn(
          "vexa-icon-btn flex h-9 w-9 items-center justify-center rounded-full",
          "text-muted-foreground transition-colors hover:bg-black/[0.06] hover:text-foreground dark:hover:bg-white/10",
          state === "running" && "text-foreground",
          state === "no_key" && "text-destructive",
          state === "heuristic" && "text-amber-600 dark:text-amber-400"
        )}
        aria-label={`AI model: ${modelName}`}
      >
        {state === "running" ? (
          <Loader2 className="size-[18px] animate-spin" />
        ) : (
          <Cpu className="size-[18px]" />
        )}
      </button>

      <div
        className={cn(
          "pointer-events-none absolute right-0 top-[calc(100%+8px)] z-50 w-64",
          "rounded-2xl border border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur-xl",
          "invisible opacity-0 transition-opacity duration-200",
          "group-hover:visible group-hover:pointer-events-auto group-hover:opacity-100"
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Active AI
        </p>
        <p className="mt-1 text-sm font-semibold tracking-tight">{modelName}</p>
        <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">
          {fullModel}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          <span className="rounded-full bg-muted px-2 py-0.5 capitalize">
            {state === "running" ? "Live" : state.replace("_", " ")}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5">OpenRouter</span>
        </div>
        <p className="mt-2 border-t border-border/60 pt-2 text-[10px] leading-snug text-muted-foreground">
          Used for humanize & cold-email drafts. ATS / match stay local.
        </p>
      </div>
    </div>
  );
}
