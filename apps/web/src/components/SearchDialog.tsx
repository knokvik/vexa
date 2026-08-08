"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { JobListing } from "@vexa/shared";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { reportActivity, appendLog } from "@/lib/activity-bus";
import { expandSearchIntent } from "@/lib/query-intent";
import {
  KeywordSearchInput,
  buildKeywordQuery,
} from "@/components/KeywordSearchInput";

type TierId = "free" | "company" | "portal" | "linkedin";

type TierState = {
  id: TierId;
  label: string;
  status: "pending" | "loading" | "done" | "error";
  count: number;
};

type JobCard = JobListing & {
  tier?: TierId;
  match?: { percent?: number };
};

const TIER_META: Array<{ id: TierId; label: string }> = [
  { id: "free", label: "Free boards" },
  { id: "portal", label: "ATS portals" },
  { id: "company", label: "Company sites" },
  { id: "linkedin", label: "LinkedIn" },
];

export function SearchDialog({
  open,
  onOpenChange,
  initialQuery = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [keywords, setKeywords] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [tiers, setTiers] = useState<TierState[]>(() =>
    TIER_META.map((t) => ({ ...t, status: "pending" as const, count: 0 }))
  );
  const [providers, setProviders] = useState({ firecrawl: 0, exa: 0 });
  const [jobs, setJobs] = useState<JobCard[]>([]);
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [intentHint, setIntentHint] = useState<string[]>([]);
  const runIdRef = useRef(0);
  const startedFor = useRef<string | null>(null);

  useEffect(() => {
    if (open && initialQuery) {
      setQuery(initialQuery);
    }
  }, [open, initialQuery]);

  const doneCount = tiers.filter(
    (t) => t.status === "done" || t.status === "error"
  ).length;
  const progress = activeQuery ? (doneCount / tiers.length) * 100 : 0;
  const total = jobs.length;
  const fcPct =
    providers.firecrawl + providers.exa > 0
      ? Math.round(
          (providers.firecrawl / (providers.firecrawl + providers.exa)) * 100
        )
      : 0;
  const exPct = total > 0 || providers.exa > 0 ? 100 - fcPct : 0;

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    const runId = ++runIdRef.current;
    setNote("");
    setActiveQuery(trimmed);
    setRunning(true);
    setJobs([]);
    setExpanded(null);
    setProviders({ firecrawl: 0, exa: 0 });
    setTiers(
      TIER_META.map((t) => ({
        ...t,
        status: "pending" as const,
        count: 0,
      }))
    );

    const intent = expandSearchIntent(trimmed);
    setIntentHint([intent.primary, ...intent.variants].slice(0, 4));
    appendLog({
      kind: "search",
      message: `Search started: ${trimmed}`,
      detail: `expanded → ${intent.primary}`,
      status: "running",
    });

    const seen = new Set<string>();
    let fcTotal = 0;
    let exTotal = 0;
    let addedTotal = 0;

    for (const meta of TIER_META) {
      if (runId !== runIdRef.current) return;
      setTiers((prev) =>
        prev.map((t) =>
          t.id === meta.id ? { ...t, status: "loading" } : t
        )
      );
      reportActivity({
        tool: "discover",
        action: `Searching ${meta.label} · ${intent.primary}`,
        status: "running",
      });

      try {
        const res = await fetch("/api/jobs/discover/tier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, tier: meta.id }),
        });
        const data = await res.json();
        if (runId !== runIdRef.current) return;
        if (data.expansion?.primary) {
          setIntentHint(
            [data.expansion.primary, ...(data.expansion.variants || [])].slice(
              0,
              4
            )
          );
        }

        const incoming = (data.jobs || []) as JobCard[];
        const pv = data.providers || { firecrawl: 0, exa: 0 };
        fcTotal += Number(pv.firecrawl || 0);
        exTotal += Number(pv.exa || 0);
        setProviders({ firecrawl: fcTotal, exa: exTotal });

        let added = 0;
        for (const job of incoming) {
          if (!job.externalUrl || seen.has(job.externalUrl)) continue;
          seen.add(job.externalUrl);
          added += 1;
          addedTotal += 1;
          setJobs((prev) =>
            [...prev, { ...job, tier: meta.id }].sort(
              (a, b) => (b.match?.percent ?? 0) - (a.match?.percent ?? 0)
            )
          );
        }

        const freeDetail =
          meta.id === "free" && data.freeSources
            ? Object.entries(
                data.freeSources as Record<
                  string,
                  { count: number; error?: string }
                >
              )
                .map(
                  ([k, v]) =>
                    `${k}=${v.count}${v.error ? `(!)` : ""}`
                )
                .join(" ")
            : `fc=${pv.firecrawl || 0} exa=${pv.exa || 0}`;

        appendLog({
          kind: "discover",
          message: `${meta.label}: +${added} roles`,
          detail: freeDetail,
          status: "done",
        });

        setTiers((prev) =>
          prev.map((t) =>
            t.id === meta.id
              ? {
                  ...t,
                  status: data.error && added === 0 ? "error" : "done",
                  count: added,
                }
              : t
          )
        );
        reportActivity({
          tool: "discover",
          action: `${meta.label}: ${added} results`,
          status: "done",
        });
      } catch (e) {
        setTiers((prev) =>
          prev.map((t) =>
            t.id === meta.id ? { ...t, status: "error", count: 0 } : t
          )
        );
        appendLog({
          kind: "discover",
          message: `${meta.label} failed`,
          detail: e instanceof Error ? e.message : "error",
          status: "error",
        });
      }
    }

    if (runId === runIdRef.current) {
      setRunning(false);
      appendLog({
        kind: "search",
        message: `Search complete · ${addedTotal} roles`,
        status: "done",
      });
      if (addedTotal === 0) {
        setNote("No solid posts found. Try a more specific query.");
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const q = buildKeywordQuery(initialQuery || query, keywords).trim();
    if (q && startedFor.current !== q && initialQuery) {
      // Auto-run only when opened with a prefilled query
      startedFor.current = q;
      void runSearch(q);
    }
  }, [open, initialQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  async function prepare(jobId: string) {
    setBusyId(jobId);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (data.error && !String(data.error).includes("Already")) {
        setNote(data.error);
      } else {
        setNote("Draft ready — open Inbox to apply.");
        appendLog({
          kind: "draft",
          message: `Draft prepared`,
          detail: jobId,
          status: "done",
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="space-y-1 border-b px-4 py-4 text-left">
          <SheetTitle className="text-base">Live search</SheetTitle>
          <SheetDescription className="text-[12px]">
            Free boards first ($0: Remotive, Jobicy, Himalayas…). Drafts →
            Inbox — never auto-submits.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b px-4 py-3">
          <KeywordSearchInput
            value={query}
            onChange={setQuery}
            keywords={keywords}
            onKeywordsChange={setKeywords}
            disabled={running}
            autoFocus
            placeholder="Role: software engineer, intern…"
            keywordsPlaceholder="Keywords: C++, remote, quant, TypeScript…"
            onSubmit={(combined) => {
              startedFor.current = null;
              void runSearch(combined);
            }}
          />
          {intentHint.length > 0 && (
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Processing:{" "}
              <span className="font-mono text-foreground/80">
                {intentHint.join(" · ")}
              </span>
            </p>
          )}

          {activeQuery && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
              {running ? (
                <Loader2 className="size-3 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="size-3 text-success" />
              )}
              <span className="font-mono tabular-nums">
                {total} hits
                {running ? ` · ${Math.round(progress)}%` : ""}
              </span>
              <span className="rounded-full border px-1.5 py-0.5 font-mono">
                Firecrawl {providers.firecrawl + providers.exa ? `${fcPct}%` : "…"}
              </span>
              <span className="rounded-full border px-1.5 py-0.5 font-mono">
                Exa {providers.firecrawl + providers.exa ? `${exPct}%` : "…"}
              </span>
            </div>
          )}
        </div>

        {note && (
          <p className="border-b px-4 py-2 text-[12px] text-muted-foreground">
            {note}{" "}
            <Link
              href="/inbox"
              className="font-medium text-foreground underline"
              onClick={() => onOpenChange(false)}
            >
              Inbox
            </Link>
          </p>
        )}

        <ul className="flex-1 overflow-y-auto">
          {jobs.length === 0 && !running && (
            <li className="px-4 py-10 text-center text-[13px] text-muted-foreground">
              Search to stream roles here.
            </li>
          )}
          {running && jobs.length === 0 && (
            <li className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </li>
          )}
          {jobs.map((job) => {
            const openRow = expanded === job.id;
            return (
              <li key={job.id} className="border-b border-border/50">
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                  onClick={() =>
                    setExpanded(openRow ? null : job.id)
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      {job.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {job.company}
                      {job.match?.percent != null
                        ? ` · ${job.match.percent}%`
                        : ""}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="shrink-0 text-[9px]"
                  >
                    {job.source || job.tier || "web"}
                  </Badge>
                  <ChevronDown
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-300",
                      openRow && "rotate-180"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    openRow ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-2 px-4 pb-3 pt-0">
                      <p className="line-clamp-3 text-[12px] text-muted-foreground">
                        {job.description || "No description"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={busyId === job.id}
                          onClick={() => void prepare(job.id)}
                        >
                          {busyId === job.id && (
                            <Loader2 className="size-3 animate-spin" />
                          )}
                          Prepare draft
                        </Button>
                        {job.externalUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            asChild
                          >
                            <a
                              href={job.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open <ExternalLink className="size-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-t px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            asChild
            onClick={() => onOpenChange(false)}
          >
            <Link href="/jobs">View all jobs</Link>
          </Button>
          <Button
            size="sm"
            className="h-8"
            asChild
            onClick={() => onOpenChange(false)}
          >
            <Link href="/inbox">Inbox</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
