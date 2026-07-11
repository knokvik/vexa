"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { JobListing } from "@vexa/shared";
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Linkedin,
  Loader2,
  Search,
  Sparkles,
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

const TIER_META: Array<Omit<TierState, "status" | "count">> = [
  {
    id: "company",
    label: "Company career pages",
    priority: 1,
  },
  {
    id: "portal",
    label: "Job portals (Greenhouse, Lever, Indeed…)",
    priority: 2,
  },
  {
    id: "linkedin",
    label: "LinkedIn & protected boards",
    priority: 3,
  },
];

function tierIcon(id: TierId) {
  if (id === "company") return Building2;
  if (id === "portal") return Globe2;
  return Linkedin;
}

function SearchLiveInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQ);
  const [activeQuery, setActiveQuery] = useState(initialQ);
  const [tiers, setTiers] = useState<TierState[]>(() =>
    TIER_META.map((t) => ({ ...t, status: "pending" as const, count: 0 }))
  );
  const [jobs, setJobs] = useState<
    Array<JobListing & { tier?: TierId; appearKey?: string }>
  >([]);
  const [running, setRunning] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [note, setNote] = useState("");

  const doneCount = tiers.filter((t) => t.status === "done" || t.status === "error")
    .length;
  const progress = (doneCount / tiers.length) * 100;
  const allDone = !running && doneCount === tiers.length && activeQuery.length > 0;

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setActiveQuery(trimmed);
    setRunning(true);
    setNote("");
    setJobs([]);
    setTiers(
      TIER_META.map((t) => ({ ...t, status: "pending" as const, count: 0 }))
    );
    router.replace(`/search?q=${encodeURIComponent(trimmed)}`);

    const seen = new Set<string>();

    for (const meta of TIER_META) {
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
        const data = await res.json();
        const incoming = (data.jobs || []) as JobListing[];

        // Progressive: append one-by-one for live feel
        for (const job of incoming) {
          if (seen.has(job.externalUrl)) continue;
          seen.add(job.externalUrl);
          const card = {
            ...job,
            tier: meta.id as TierId,
            appearKey: `${job.id}_${Date.now()}`,
          };
          setJobs((prev) => [...prev, card]);
          await new Promise((r) => setTimeout(r, 120));
        }

        setTiers((prev) =>
          prev.map((t) =>
            t.id === meta.id
              ? {
                  ...t,
                  status: data.error && !incoming.length ? "error" : "done",
                  count: incoming.length,
                  error: data.error,
                  durationMs: data.durationMs,
                }
              : t
          )
        );
      } catch (e) {
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

    setRunning(false);
  }, [router]);

  useEffect(() => {
    if (initialQ.trim()) {
      void runSearch(initialQ);
    }
    // only on mount with initial q
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyAll() {
    if (!jobs.length) return;
    setApplyBusy(true);
    setNote("");
    let ok = 0;
    let fail = 0;
    // Cap for quality / cost — prepare top 5 by priority order already in list
    const batch = jobs.slice(0, 5);
    for (const job of batch) {
      try {
        const res = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id }),
        });
        const data = await res.json();
        if (data.draft || data.error?.includes?.("Already")) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    }
    setApplyBusy(false);
    setNote(
      `Apply-all queued ${ok} draft(s)${fail ? `, ${fail} skipped` : ""}. ATS/humanize ran on each. Open Draft Inbox — full auto-submit later.`
    );
  }

  const sortedJobs = useMemo(() => {
    const prio = { company: 0, portal: 1, linkedin: 2 } as const;
    return [...jobs].sort(
      (a, b) =>
        (prio[a.tier || "portal"] ?? 9) - (prio[b.tier || "portal"] ?? 9)
    );
  }, [jobs]);

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

      {/* Top card: what we're searching */}
      {activeQuery && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                Live search
              </div>
              <p className="text-sm font-semibold tracking-tight">
                “{activeQuery}”
              </p>
              <p className="text-xs text-muted-foreground">
                Priority: company sites → job portals → LinkedIn. Cards appear
                as each source finishes.
              </p>
            </div>
            <div className="flex min-w-[140px] flex-col gap-1.5">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>
                  {doneCount}/{tiers.length} sources
                </span>
                <span>{sortedJobs.length} roles</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source status strip */}
      {activeQuery && (
        <div className="grid gap-2 sm:grid-cols-3">
          {tiers.map((t) => {
            const Icon = tierIcon(t.id);
            return (
              <Card
                key={t.id}
                className={cn(
                  "transition-colors",
                  t.status === "loading" && "border-primary/40",
                  t.status === "done" && "border-success/30",
                  t.status === "error" && "border-destructive/30"
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
                    ) : (
                      <Icon className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.status === "pending" && "Waiting…"}
                      {t.status === "loading" && "Searching…"}
                      {t.status === "done" &&
                        `${t.count} found${t.durationMs ? ` · ${(t.durationMs / 1000).toFixed(1)}s` : ""}`}
                      {t.status === "error" && (t.error?.slice(0, 48) || "Error")}
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

      {/* Actions */}
      {sortedJobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={applyBusy || running} onClick={applyAll}>
            {applyBusy && <Loader2 className="animate-spin" />}
            Apply all (top {Math.min(5, sortedJobs.length)})
          </Button>
          <Button variant="outline" asChild>
            <Link href="/inbox">Open Draft Inbox</Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            Apply-all prepares drafts + ATS/humanize. You still submit via
            one-tap later.
          </span>
        </div>
      )}

      {note && (
        <Alert>
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      )}

      {/* Skeleton loaders while first results pending */}
      {running && sortedJobs.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Progressive result cards */}
      <div className="space-y-3">
        {sortedJobs.map((job) => (
          <Card
            key={job.appearKey || job.id}
            className="animate-in fade-in slide-in-from-bottom-2 duration-300"
          >
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
                      ? "Company site"
                      : job.tier === "portal"
                        ? "Job portal"
                        : "LinkedIn / board"}
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
                  onClick={async () => {
                    setApplyBusy(true);
                    const res = await fetch("/api/applications", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ jobId: job.id }),
                    });
                    const data = await res.json();
                    setApplyBusy(false);
                    setNote(
                      data.error
                        ? data.error
                        : `Draft ready (${data.draft?.status}). Open Inbox for ATS scores.`
                    );
                  }}
                  disabled={applyBusy}
                >
                  Prepare
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {job.description || "No description snippet."}
              </p>
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

      {allDone && sortedJobs.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No roles found for this query. Try broader keywords.
          </CardContent>
        </Card>
      )}

      {!activeQuery && (
        <Card>
          <CardContent className="space-y-2 py-10 text-center">
            <p className="text-sm font-medium">Search for roles</p>
            <p className="text-xs text-muted-foreground">
              Results stream in by priority: company pages first, then portals,
              then LinkedIn.
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
