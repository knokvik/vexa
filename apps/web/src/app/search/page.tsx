"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { JobListing } from "@vexa/shared";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Link2,
  Loader2,
  Search,
  Sparkles,
  XCircle,
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

type JobCard = JobListing & { tier?: TierId; appearKey?: string };

const TIER_META: Array<Omit<TierState, "status" | "count">> = [
  { id: "company", label: "Company career pages", priority: 1 },
  { id: "portal", label: "Job portals", priority: 2 },
  { id: "linkedin", label: "LinkedIn & protected", priority: 3 },
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
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [running, setRunning] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [note, setNote] = useState("");
  const [fatal, setFatal] = useState("");

  const runIdRef = useRef(0);
  const startedForQ = useRef<string | null>(null);

  const doneCount = tiers.filter(
    (t) => t.status === "done" || t.status === "error"
  ).length;
  const progress = activeQuery ? (doneCount / tiers.length) * 100 : 0;
  const allDone =
    !running && doneCount === tiers.length && activeQuery.length > 0;

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
    setTiers(
      TIER_META.map((t) => ({
        ...t,
        status: "pending" as const,
        count: 0,
        error: undefined,
        durationMs: undefined,
      }))
    );

    // Update URL without remounting / canceling React state
    if (typeof window !== "undefined") {
      const url = `/search?q=${encodeURIComponent(trimmed)}`;
      window.history.replaceState(null, "", url);
    }

    const seen = new Set<string>();
    let total = 0;

    for (const meta of TIER_META) {
      if (runId !== runIdRef.current) return; // cancelled by newer search

      setTiers((prev) =>
        prev.map((t) =>
          t.id === meta.id ? { ...t, status: "loading", error: undefined } : t
        )
      );

      try {
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

        const incoming = (data.jobs || []) as JobListing[];
        let added = 0;

        for (const job of incoming) {
          if (runId !== runIdRef.current) return;
          if (!job.externalUrl || seen.has(job.externalUrl)) continue;
          seen.add(job.externalUrl);
          added += 1;
          total += 1;
          const card: JobCard = {
            ...job,
            tier: meta.id,
            appearKey: `${job.id}_${total}`,
          };
          setJobs((prev) => [...prev, card]);
          await new Promise((r) => setTimeout(r, 80));
        }

        setTiers((prev) =>
          prev.map((t) =>
            t.id === meta.id
              ? {
                  ...t,
                  status:
                    data.error && added === 0 ? "error" : "done",
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
      setRunning(false);
      if (total === 0) {
        setNote(
          "No solid job posts found (filtered out list/search pages). Try a more specific query like “Stripe frontend engineer”."
        );
      }
    }
  }, []);

  // Auto-start when landing with ?q=
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
      `Queued ${ok} draft(s)${fail ? `, ${fail} failed` : ""}. Open Draft Inbox for ATS scores.`
    );
  }

  return (
    <div className="space-y-6">
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

      {activeQuery && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                {running ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {running ? "Searching live…" : "Search complete"}
              </div>
              <p className="text-sm font-semibold tracking-tight">
                “{activeQuery}”
              </p>
              <p className="text-xs text-muted-foreground">
                Priority: company sites → portals → LinkedIn. Real job posts
                only (list pages filtered out).
              </p>
            </div>
            <div className="flex min-w-[150px] flex-col gap-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>
                  {doneCount}/{tiers.length} sources
                </span>
                <span>{jobs.length} roles</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      )}

      {activeQuery && (
        <div className="grid gap-2 sm:grid-cols-3">
          {tiers.map((t) => {
            const Icon = tierIcon(t.id);
            return (
              <Card
                key={t.id}
                className={cn(
                  t.status === "loading" && "border-primary/40",
                  t.status === "done" && "border-success/30",
                  t.status === "error" && "border-destructive/40"
                )}
              >
                <CardContent className="flex items-center gap-3 p-3">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg bg-muted",
                      t.status === "loading" && "bg-primary/10 text-primary"
                    )}
                  >
                    {t.status === "loading" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : t.status === "done" ? (
                      <CheckCircle2 className="size-4 text-success" />
                    ) : t.status === "error" ? (
                      <XCircle className="size-4 text-destructive" />
                    ) : (
                      <Icon className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{t.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.status === "pending" && "Waiting…"}
                      {t.status === "loading" && "Searching…"}
                      {t.status === "done" &&
                        `${t.count} found${t.durationMs ? ` · ${(t.durationMs / 1000).toFixed(1)}s` : ""}`}
                      {t.status === "error" &&
                        (t.error?.slice(0, 60) || "Error")}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    P{t.priority}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={applyBusy || running} onClick={applyAll}>
            {applyBusy && <Loader2 className="animate-spin" />}
            Apply all (top {Math.min(5, jobs.length)})
          </Button>
          <Button variant="outline" asChild>
            <Link href="/inbox">Draft Inbox</Link>
          </Button>
        </div>
      )}

      {note && (
        <Alert>
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      )}

      {running && jobs.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <Card key={job.appearKey || job.id}>
            <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{job.title}</CardTitle>
                  <Badge
                    variant={
                      job.tier === "company"
                        ? "default"
                        : job.tier === "portal"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {job.tier === "company"
                      ? "Company"
                      : job.tier === "portal"
                        ? "Portal"
                        : "LinkedIn"}
                  </Badge>
                  <Badge variant="outline">{job.source}</Badge>
                  {job.location?.remote && (
                    <Badge variant="success">Remote</Badge>
                  )}
                </div>
                <CardDescription>
                  {job.company}
                  {job.location?.city ? ` · ${job.location.city}` : ""}
                </CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={job.externalUrl} target="_blank" rel="noreferrer">
                    Open <ExternalLink className="size-3.5" />
                  </a>
                </Button>
                <Button
                  size="sm"
                  disabled={applyBusy}
                  onClick={async () => {
                    setApplyBusy(true);
                    try {
                      const res = await fetch("/api/applications", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ jobId: job.id }),
                      });
                      const data = await res.json();
                      setNote(
                        data.error
                          ? String(data.error)
                          : `Draft ready (${data.draft?.status}). Open Inbox.`
                      );
                    } finally {
                      setApplyBusy(false);
                    }
                  }}
                >
                  Prepare
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {job.description || "Open the link for full description."}
              </p>
              <a
                href={job.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="block truncate text-[11px] text-primary hover:underline"
              >
                {job.externalUrl}
              </a>
              {job.skillsRequired?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {job.skillsRequired.slice(0, 6).map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {allDone && jobs.length === 0 && (
        <Card>
          <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">
            <p>No job posts passed quality filters.</p>
            <p className="text-xs">
              Try: “frontend engineer greenhouse” or a company name + role.
            </p>
          </CardContent>
        </Card>
      )}

      {!activeQuery && !running && (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <p className="text-sm font-medium">Search for roles</p>
            <p className="text-xs text-muted-foreground">
              Type a query and hit Search live. Results stream by priority.
            </p>
          </CardContent>
        </Card>
      )}
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
