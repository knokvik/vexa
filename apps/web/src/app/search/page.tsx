"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { JobListing } from "@vexa/shared";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Flame,
  Globe2,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Search,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { JobIntelSheet } from "@/components/JobIntelSheet";
import { reportActivity } from "@/lib/activity-bus";

type TierId = "company" | "portal" | "linkedin";

type TierState = {
  id: TierId;
  label: string;
  priority: number;
  status: "pending" | "loading" | "done" | "error";
  count: number;
  error?: string;
  durationMs?: number;
};

type ProviderStat = {
  id: string;
  label: string;
  color: string;
  count: number;
  status: "idle" | "loading" | "done";
};

type JobMatch = {
  percent: number;
  shortlist: number;
  priority: string;
  priorityLabel: string;
  suggestion: string;
  matchedSkills: string[];
  missingSkills: string[];
  ats?: {
    overall: number;
    keyword: number;
    semantic: number;
    structured: number;
  };
};

type JobCard = JobListing & {
  tier?: TierId;
  appearKey?: string;
  match?: JobMatch;
};

const TIER_META: Array<Omit<TierState, "status" | "count">> = [
  { id: "company", label: "Company sites", priority: 1 },
  { id: "portal", label: "Job portals", priority: 2 },
  { id: "linkedin", label: "LinkedIn", priority: 3 },
];

function tierIcon(id: TierId) {
  if (id === "company") return Building2;
  if (id === "portal") return Globe2;
  return Link2;
}

function SearchLiveInner() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [activeQuery, setActiveQuery] = useState("");
  const [tiers, setTiers] = useState<TierState[]>(() =>
    TIER_META.map((t) => ({ ...t, status: "pending" as const, count: 0 }))
  );
  const [providers, setProviders] = useState<ProviderStat[]>([
    { id: "firecrawl", label: "Firecrawl", color: "bg-orange-500", count: 0, status: "idle" },
    { id: "exa", label: "Exa", color: "bg-violet-500", count: 0, status: "idle" },
    { id: "bright_data", label: "Bright Data", color: "bg-sky-500", count: 0, status: "idle" },
  ]);
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [running, setRunning] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [note, setNote] = useState("");
  const [fatal, setFatal] = useState("");
  /** Placeholder slots while waiting for first cards */
  const [skeletonCount, setSkeletonCount] = useState(0);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [intelJob, setIntelJob] = useState<JobListing | null>(null);
  const [intelOpen, setIntelOpen] = useState(false);

  const runIdRef = useRef(0);
  const startedForQ = useRef<string | null>(null);

  const doneCount = tiers.filter(
    (t) => t.status === "done" || t.status === "error"
  ).length;
  const progress = activeQuery ? (doneCount / tiers.length) * 100 : 0;
  const allDone =
    !running && doneCount === tiers.length && activeQuery.length > 0;

  const totalResults = jobs.length;
  const providerPercents = useMemo(() => {
    const total = Math.max(
      1,
      providers.reduce((s, p) => s + p.count, 0)
    );
    return providers.map((p) => ({
      ...p,
      pct: Math.round((p.count / total) * 100),
    }));
  }, [providers]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setFatal("Enter a search query first.");
      return;
    }

    const runId = ++runIdRef.current;
    setFatal("");
    setNote("");
    setActiveQuery(trimmed);
    setRunning(true);
    setJobs([]);
    setSkeletonCount(6);
    setTiers(
      TIER_META.map((t) => ({
        ...t,
        status: "pending" as const,
        count: 0,
        error: undefined,
        durationMs: undefined,
      }))
    );
    setProviders([
      { id: "firecrawl", label: "Firecrawl", color: "bg-orange-500", count: 0, status: "loading" },
      { id: "exa", label: "Exa", color: "bg-violet-500", count: 0, status: "loading" },
      { id: "bright_data", label: "Bright Data", color: "bg-sky-500", count: 0, status: "idle" },
    ]);

    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        `/search?q=${encodeURIComponent(trimmed)}`
      );
    }

    const seen = new Set<string>();
    let total = 0;
    let fcTotal = 0;
    let exTotal = 0;

    for (const meta of TIER_META) {
      if (runId !== runIdRef.current) return;

      setTiers((prev) =>
        prev.map((t) =>
          t.id === meta.id ? { ...t, status: "loading", error: undefined } : t
        )
      );

      try {
        reportActivity({
          tool: "Exa + Firecrawl",
          action: `Searching ${meta.label}`,
          status: "running",
        });

        const res = await fetch("/api/jobs/discover/tier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, tier: meta.id }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
        }

        const data = await res.json();
        if (runId !== runIdRef.current) return;

        const incoming = (data.jobs || []) as JobCard[];
        const pv = data.providers || { firecrawl: 0, exa: 0 };
        fcTotal += Number(pv.firecrawl || 0);
        exTotal += Number(pv.exa || 0);

        setProviders((prev) =>
          prev.map((p) => {
            if (p.id === "firecrawl")
              return { ...p, count: fcTotal, status: "loading" as const };
            if (p.id === "exa")
              return { ...p, count: exTotal, status: "loading" as const };
            return p;
          })
        );

        reportActivity({
          tool: "ATS hybrid scorer",
          action: `Scoring ${incoming.length} roles (keyword+semantic+structured)`,
          model: "local-ats-v2",
          status: "running",
        });

        let added = 0;
        for (const job of incoming) {
          if (runId !== runIdRef.current) return;
          if (!job.externalUrl || seen.has(job.externalUrl)) continue;
          seen.add(job.externalUrl);
          added += 1;
          total += 1;
          setSkeletonCount((s) => Math.max(0, s - 1));
          const card: JobCard = {
            ...job,
            tier: meta.id,
            appearKey: `${job.id}_${total}`,
          };
          setJobs((prev) => {
            const next = [...prev, card];
            // keep overall list sorted by match %
            return next.sort(
              (a, b) => (b.match?.percent ?? 0) - (a.match?.percent ?? 0)
            );
          });
          await new Promise((r) => setTimeout(r, 140));
        }

        reportActivity({
          tool: "Exa + Firecrawl",
          action: `${meta.label}: ${added} ranked results`,
          status: "done",
        });

        setTiers((prev) =>
          prev.map((t) =>
            t.id === meta.id
              ? {
                  ...t,
                  status: data.error && added === 0 ? "error" : "done",
                  count: added,
                  error: data.error,
                  durationMs: data.durationMs,
                }
              : t
          )
        );
      } catch (e) {
        if (runId !== runIdRef.current) return;
        setTiers((prev) =>
          prev.map((t) =>
            t.id === meta.id
              ? {
                  ...t,
                  status: "error",
                  count: 0,
                  error: e instanceof Error ? e.message : "failed",
                }
              : t
          )
        );
      }
    }

    if (runId === runIdRef.current) {
      setProviders((prev) =>
        prev.map((p) =>
          p.id === "bright_data"
            ? { ...p, status: "idle" as const }
            : { ...p, status: "done" as const }
        )
      );
      setSkeletonCount(0);
      setRunning(false);
      if (total === 0) {
        setNote(
          "No solid job posts found. Try a more specific query (company + role)."
        );
      }
    }
  }, []);

  useEffect(() => {
    const q = initialQ.trim();
    if (q && startedForQ.current !== q) {
      startedForQ.current = q;
      void runSearch(q);
    }
  }, [initialQ, runSearch]);

  async function applyAll() {
    if (!jobs.length) return;
    setApplyBusy(true);
    setNote("");
    let ok = 0;
    let fail = 0;
    const batch = jobs.slice(0, 5);
    for (const job of batch) {
      try {
        const res = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        });
        const data = await res.json();
        if (data.draft || String(data.error || "").includes("Already")) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    }
    setApplyBusy(false);
    setNote(
      `Queued ${ok} draft(s)${fail ? `, ${fail} failed` : ""}. Open Draft Inbox.`
    );
  }

  const showSkeletons = running || skeletonCount > 0;

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch(query);
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="e.g. senior frontend engineer remote React"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={running}
          />
        </div>
        <Button type="submit" disabled={running || !query.trim()}>
          {running ? <Loader2 className="animate-spin" /> : <Search />}
          {running ? "Searching…" : "Search live"}
        </Button>
      </form>

      {fatal && (
        <Alert variant="destructive">
          <AlertDescription>{fatal}</AlertDescription>
        </Alert>
      )}

      {/* Top: query + provider share */}
      {activeQuery && (
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-medium text-primary">
                  {running ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {running ? "Live search in progress" : "Search complete"}
                </div>
                <p className="text-sm font-semibold tracking-tight">
                  “{activeQuery}”
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalResults} result{totalResults === 1 ? "" : "s"} · sources
                  run in priority order
                </p>
              </div>
              <div className="w-full min-w-[160px] sm:w-48">
                <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>
                    {doneCount}/{tiers.length} tiers
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            </div>

            {/* Provider percentages */}
            <div className="grid gap-2 sm:grid-cols-3">
              {providerPercents.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border bg-card px-3 py-2.5 shadow-sm"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      {p.id === "firecrawl" && (
                        <Flame className="size-3.5 text-orange-500" />
                      )}
                      {p.id === "exa" && (
                        <Zap className="size-3.5 text-violet-500" />
                      )}
                      {p.id === "bright_data" && (
                        <Globe2 className="size-3.5 text-sky-500" />
                      )}
                      {p.label}
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {p.id === "bright_data"
                        ? "off"
                        : `${p.count}${totalResults > 0 ? ` · ${p.pct}%` : ""}`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        p.color,
                        p.status === "loading" && "animate-pulse"
                      )}
                      style={{
                        width:
                          p.id === "bright_data"
                            ? p.status === "loading"
                              ? "30%"
                              : "0%"
                            : totalResults
                              ? `${p.pct}%`
                              : p.status === "loading"
                                ? "40%"
                                : "0%",
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {p.id === "bright_data" &&
                      "Unlocker for hard pages — not needed for Exa/Firecrawl yet"}
                    {p.id !== "bright_data" && p.status === "loading" && "Fetching…"}
                    {p.id !== "bright_data" &&
                      p.status === "done" &&
                      p.count > 0 &&
                      "Share of results"}
                    {p.id !== "bright_data" &&
                      p.status === "done" &&
                      p.count === 0 &&
                      "No hits"}
                    {p.id !== "bright_data" && p.status === "idle" && "Idle"}
                  </p>
                </div>
              ))}
            </div>

            {/* Tier strip */}
            <div className="flex flex-wrap gap-2">
              {tiers.map((t) => {
                const Icon = tierIcon(t.id);
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
                      t.status === "loading" && "border-primary/40 bg-primary/5",
                      t.status === "done" && "border-success/30 bg-success/5",
                      t.status === "error" && "border-destructive/30"
                    )}
                  >
                    {t.status === "loading" ? (
                      <Loader2 className="size-3 animate-spin text-primary" />
                    ) : t.status === "done" ? (
                      <CheckCircle2 className="size-3 text-success" />
                    ) : t.status === "error" ? (
                      <XCircle className="size-3 text-destructive" />
                    ) : (
                      <Icon className="size-3 text-muted-foreground" />
                    )}
                    <span className="font-medium">{t.label}</span>
                    <span className="text-muted-foreground">
                      {t.status === "done"
                        ? t.count
                        : t.status === "loading"
                          ? "…"
                          : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(jobs.length > 0 || running) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {jobs.length > 0 && (
              <>
                <Button disabled={applyBusy || running} onClick={applyAll}>
                  {applyBusy && <Loader2 className="animate-spin" />}
                  Apply all (top {Math.min(5, jobs.length)})
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/inbox">Draft Inbox</Link>
                </Button>
              </>
            )}
          </div>
          {/* List / grid toggle */}
          <div className="inline-flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm">
            <Button
              type="button"
              size="sm"
              variant={view === "grid" ? "default" : "ghost"}
              className="h-7 px-2"
              onClick={() => setView("grid")}
              title="Grid view"
            >
              <LayoutGrid className="size-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1">Grid</span>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={view === "list" ? "default" : "ghost"}
              className="h-7 px-2"
              onClick={() => setView("list")}
              title="List view"
            >
              <List className="size-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1">List</span>
            </Button>
          </div>
        </div>
      )}

      {note && (
        <Alert>
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      )}

      {/* Results: natural height, grid or list — appear one by one */}
      <div
        className={cn(
          "gap-3",
          view === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : "flex flex-col"
        )}
      >
        {jobs.map((job) => (
          <Card
            key={job.appearKey || job.id}
            className={cn(
              "overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-300",
              view === "list" && "flex flex-col sm:flex-row sm:items-stretch"
            )}
          >
            <CardHeader
              className={cn(
                "space-y-2 p-4 pb-2",
                view === "list" && "sm:w-[40%] sm:shrink-0 sm:pb-4"
              )}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={
                    job.tier === "company"
                      ? "default"
                      : job.tier === "portal"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-[10px]"
                >
                  {job.tier === "company"
                    ? "Company"
                    : job.tier === "portal"
                      ? "Portal"
                      : "LinkedIn"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {job.source}
                </Badge>
                {job.location?.remote && (
                  <Badge variant="success" className="text-[10px]">
                    Remote
                  </Badge>
                )}
              </div>
              <CardTitle className="line-clamp-2 text-sm leading-snug">
                {job.title}
              </CardTitle>
              <CardDescription className="truncate text-xs">
                {job.company}
              </CardDescription>
              {/* Match rate + priority suggestion */}
              {job.match && (
                <div className="mt-1 flex items-start gap-2 rounded-lg border bg-muted/40 p-2">
                  <div className="min-w-[3.25rem] text-center">
                    <div
                      className={cn(
                        "font-mono text-lg font-semibold tabular-nums leading-none",
                        job.match.percent >= 70
                          ? "text-success"
                          : job.match.percent >= 55
                            ? "text-primary"
                            : "text-warning"
                      )}
                    >
                      {job.match.percent}%
                    </div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                      match
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 border-l pl-2">
                    <Badge
                      variant={
                        job.match.priority === "apply_first" ||
                        job.match.priority === "strong"
                          ? "success"
                          : job.match.priority === "skip"
                            ? "outline"
                            : "secondary"
                      }
                      className="mb-1 text-[9px]"
                    >
                      {job.match.priorityLabel}
                    </Badge>
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      {job.match.suggestion}
                    </p>
                    {job.match.ats && (
                      <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                        ATS k{job.match.ats.keyword}·s{job.match.ats.semantic}
                        ·x{job.match.ats.structured}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent
              className={cn(
                "flex flex-col gap-3 p-4 pt-0",
                view === "list" && "sm:flex-1 sm:justify-between sm:pt-4"
              )}
            >
              <p
                className={cn(
                  "text-[11px] leading-relaxed text-muted-foreground",
                  view === "grid" ? "line-clamp-3" : "line-clamp-2"
                )}
              >
                {job.description || "Open for full description."}
              </p>
              {job.skillsRequired?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {job.skillsRequired.slice(0, 5).map((s) => (
                    <Badge key={s} variant="outline" className="text-[9px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
              <div
                className={cn(
                  "flex gap-2",
                  view === "list" && "sm:justify-end"
                )}
              >
                <Button variant="outline" size="sm" asChild>
                  <a href={job.externalUrl} target="_blank" rel="noreferrer">
                    Open <ExternalLink className="size-3" />
                  </a>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    reportActivity({
                      tool: "Exa + Firecrawl",
                      action: `Intel scan: ${job.company} · ${job.title}`,
                      status: "running",
                    });
                    setIntelJob(job);
                    setIntelOpen(true);
                  }}
                >
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Compact loading placeholders (not forced square) */}
        {showSkeletons &&
          Array.from({ length: Math.max(skeletonCount, running ? 2 : 0) }).map(
            (_, i) => (
              <Card key={`sk-${i}`} className="overflow-hidden">
                <CardContent className="flex items-center gap-3 p-4">
                  <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {running
                        ? tiers.find((t) => t.status === "loading")?.label ||
                          "Searching…"
                        : "Loading…"}
                    </p>
                    <div className="h-1.5 w-3/4 animate-pulse rounded-full bg-muted" />
                    <div className="h-1.5 w-1/2 animate-pulse rounded-full bg-muted" />
                  </div>
                </CardContent>
              </Card>
            )
          )}
      </div>

      {allDone && jobs.length === 0 && (
        <Card>
          <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">
            <p>No job posts passed quality filters.</p>
            <p className="text-xs">
              Try a company + role, e.g. “Stripe frontend engineer”.
            </p>
          </CardContent>
        </Card>
      )}

      {!activeQuery && !running && (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <p className="text-sm font-medium">Search for roles</p>
            <p className="text-xs text-muted-foreground">
              Live cards appear one-by-one. Click Apply to scan the role,
              people, and projects before drafting.
            </p>
          </CardContent>
        </Card>
      )}

      <JobIntelSheet
        open={intelOpen}
        onOpenChange={setIntelOpen}
        job={intelJob}
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading search…
        </div>
      }
    >
      <SearchLiveInner />
    </Suspense>
  );
}
