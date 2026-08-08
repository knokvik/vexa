"use client";

import { useEffect, useState } from "react";
import { Loader2, Wifi, WifiOff, AlertTriangle, CircleDashed } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SvcStatus = "ready" | "degraded" | "offline" | "optional";

type Svc = {
  id: string;
  name: string;
  kind: string;
  free: boolean;
  status: SvcStatus;
  workingOn: string;
};

export default function ServicesPage() {
  const [services, setServices] = useState<Svc[]>([]);
  const [summary, setSummary] = useState("");
  const [tips, setTips] = useState<string[]>([]);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | "all">("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/services/status", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) {
          setServices(data.services || []);
          setSummary(data.summary || "");
          setTips(Array.isArray(data.tips) ? data.tips : []);
          setKeys(data.keys || {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const id = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const kinds = [
    "all",
    "job_board",
    "ats",
    "crawler",
    "llm",
    "contacts",
    "storage",
  ];
  const shown =
    filter === "all" ? services : services.filter((s) => s.kind === filter);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Live stack"
        title="Services"
        description="Crawlers, free boards, and LLM status — green = ready to use."
      />

      {/* Key chips — quick confirmation env is live */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["openrouter", "OpenRouter"],
            ["firecrawl", "Firecrawl"],
            ["exa", "Exa"],
            ["hunter", "Hunter"],
          ] as const
        ).map(([k, label]) => {
          const on = Boolean(keys[k]);
          return (
            <span
              key={k}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                on
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  on ? "bg-emerald-500" : "bg-muted-foreground/40"
                )}
              />
              {label}
              {on ? " · key" : " · —"}
            </span>
          );
        })}
      </div>

      {tips.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[12px] text-muted-foreground">
          {tips.map((t) => (
            <li key={t}>· {t}</li>
          ))}
        </ul>
      )}

      {/* Sub-bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-full border bg-muted/40 p-1">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium capitalize transition",
              filter === k
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {k === "all" ? "All" : k.replace("_", " ")}
          </button>
        ))}
        <span className="ml-auto px-2 font-mono text-[11px] text-muted-foreground">
          {summary}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => (
            <div
              key={s.id}
              className={cn(
                "rounded-xl border bg-card p-3 shadow-sm",
                s.status === "ready" && "border-emerald-500/25"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {s.kind.replace("_", " ")}
                    {s.free ? " · free" : " · key"}
                  </p>
                </div>
                <StatusIcon status={s.status} />
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                {s.workingOn}
              </p>
              <Badge
                variant={
                  s.status === "ready"
                    ? "success"
                    : s.status === "degraded"
                      ? "warning"
                      : s.status === "optional"
                        ? "secondary"
                        : "outline"
                }
                className={cn(
                  "mt-2 text-[10px]",
                  s.status === "ready" &&
                    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                )}
              >
                {s.status === "ready"
                  ? "ready"
                  : s.status === "optional"
                    ? "optional"
                    : s.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: SvcStatus }) {
  if (status === "ready")
    return <Wifi className="size-4 text-emerald-500" />;
  if (status === "degraded")
    return <AlertTriangle className="size-4 text-amber-500" />;
  if (status === "optional")
    return <CircleDashed className="size-4 text-muted-foreground" />;
  return <WifiOff className="size-4 text-muted-foreground" />;
}
