"use client";

import { useEffect, useState } from "react";
import { Loader2, Radio, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Svc = {
  id: string;
  name: string;
  kind: string;
  free: boolean;
  status: "ready" | "degraded" | "offline";
  workingOn: string;
};

export default function ServicesPage() {
  const [services, setServices] = useState<Svc[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | "all">("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/services/status");
        const data = await res.json();
        if (!cancelled) {
          setServices(data.services || []);
          setSummary(data.summary || "");
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

  const kinds = ["all", "job_board", "ats", "crawler", "llm", "contacts"];
  const shown =
    filter === "all"
      ? services
      : services.filter((s) => s.kind === filter);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Live stack"
        title="Services"
        description="Crawlers, free boards, and LLM status — what is online and what it is working on."
      />

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
              className="rounded-xl border bg-card p-3 shadow-sm"
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
                    ? "default"
                    : s.status === "degraded"
                      ? "secondary"
                      : "outline"
                }
                className="mt-2 text-[10px]"
              >
                {s.status}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Svc["status"] }) {
  if (status === "ready")
    return <Wifi className="size-4 text-emerald-500" />;
  if (status === "degraded")
    return <AlertTriangle className="size-4 text-amber-500" />;
  return <WifiOff className="size-4 text-muted-foreground" />;
}
