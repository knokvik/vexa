"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { JobListing } from "@vexa/shared";
import {
  ExternalLink,
  Loader2,
  Radar,
  Users,
  FolderGit2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSearchDialog } from "@/components/SearchProvider";
import {
  KeywordSearchInput,
  buildKeywordQuery,
} from "@/components/KeywordSearchInput";
import { appendLog } from "@/lib/activity-bus";
import { cn } from "@/lib/utils";

type Intel = {
  people?: Array<{ name: string; role?: string; snippet: string; url?: string }>;
  projects?: Array<{ title: string; description: string; url?: string }>;
  mentions?: { skills?: string[]; requirements?: string[] };
  gaps?: Array<{ skill: string; have: boolean }>;
  readiness?: string;
  waitingReasons?: string[];
  sourcesUsed?: string[];
};

export default function JobsPage() {
  const { openSearch } = useSearchDialog();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intel, setIntel] = useState<Intel | null>(null);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState("software engineer");
  const [keywords, setKeywords] = useState("");
  const [note, setNote] = useState("");

  const selected = jobs.find((j) => j.id === selectedId) || null;

  const load = useCallback(async () => {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    const list = (data.jobs ?? []) as JobListing[];
    setJobs(list);
    const focus = searchParams.get("focus");
    if (focus && list.some((j) => j.id === focus)) {
      setSelectedId(focus);
    } else if (!selectedId && list[0]) {
      setSelectedId(list[0].id);
    }
  }, [searchParams, selectedId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function research(jobId: string) {
    setBusy(true);
    setNote("");
    setIntel(null);
    appendLog({
      kind: "intel",
      message: "Researching people & projects…",
      status: "running",
    });
    try {
      const res = await fetch("/api/jobs/intel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Intel failed");
      setIntel(data.intel || null);
      setSelectedId(jobId);
      appendLog({
        kind: "intel",
        message: `Intel: ${data.intel?.people?.length || 0} people · ${data.intel?.projects?.length || 0} projects`,
        status: "done",
      });
      setNote(
        `Ready · ${data.intel?.readiness || "—"} · sources ${(data.intel?.sourcesUsed || []).join(", ") || "heuristic"}`
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Research failed");
      appendLog({
        kind: "intel",
        message: e instanceof Error ? e.message : "failed",
        status: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function discoverOnly() {
    setRunning(true);
    const query = buildKeywordQuery(q, keywords) || "software engineer";
    const res = await fetch("/api/automation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "find", query }),
    });
    const data = await res.json();
    setRunning(false);
    setNote(data.message || `Found ${data.discovered ?? 0}`);
    await load();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Jobs"
        title="Board & research"
        description="Pick a role → research people & projects in the side panel. You apply."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={running}
            onClick={() => void discoverOnly()}
          >
            {running && <Loader2 className="size-3.5 animate-spin" />}
            Find more
          </Button>
        }
      />

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <KeywordSearchInput
          compact
          value={q}
          onChange={setQ}
          keywords={keywords}
          onKeywordsChange={setKeywords}
          placeholder="Find roles…"
          keywordsPlaceholder="Keywords…"
          onSubmit={(combined) => {
            openSearch(combined || buildKeywordQuery(q, keywords) || undefined);
          }}
        />
      </div>

      {note && (
        <p className="text-xs text-muted-foreground">{note}</p>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Job list */}
        <div className="max-h-[min(70vh,640px)] overflow-y-auto rounded-xl border bg-card shadow-sm">
          {jobs.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No jobs yet.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => openSearch()}
              >
                Search
              </button>
            </p>
          ) : (
            <ul>
              {jobs.map((job) => {
                const on = selectedId === job.id;
                return (
                  <li key={job.id} className="border-b border-border/50 last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(job.id);
                        setIntel(null);
                      }}
                      className={cn(
                        "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors",
                        on ? "bg-muted/60" : "hover:bg-muted/30"
                      )}
                    >
                      <span className="text-[13px] font-semibold leading-snug">
                        {job.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {job.company}
                        {job.location?.remote ? " · Remote" : ""}
                      </span>
                      <div className="mt-0.5 flex gap-1">
                        <Badge variant="secondary" className="text-[9px]">
                          {job.source}
                        </Badge>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Research sidebar */}
        <aside className="flex max-h-[min(70vh,640px)] flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
          {!selected ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Select a job
            </p>
          ) : (
            <>
              <div className="border-b px-3 py-2.5">
                <p className="text-[13px] font-semibold leading-snug">
                  {selected.title}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {selected.company}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={busy}
                    onClick={() => void research(selected.id)}
                  >
                    {busy ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Radar className="size-3" />
                    )}
                    Research people & projects
                  </Button>
                  {selected.externalUrl && (
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" asChild>
                      <a
                        href={selected.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open <ExternalLink className="size-3" />
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" className="h-7 text-[11px]" asChild>
                    <Link
                      href={`/outreach?company=${encodeURIComponent(selected.company)}&jobTitle=${encodeURIComponent(selected.title)}&jobUrl=${encodeURIComponent(selected.externalUrl || "")}`}
                    >
                      Outreach
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-3">
                {!intel && !busy && (
                  <p className="text-[12px] text-muted-foreground">
                    Click research to load hiring contacts, public projects, and
                    skill gaps vs your profile.
                  </p>
                )}
                {busy && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Scanning…
                  </div>
                )}

                {intel?.readiness && (
                  <Badge
                    variant={
                      intel.readiness === "ready" ? "default" : "secondary"
                    }
                  >
                    {intel.readiness}
                  </Badge>
                )}

                {intel?.people && intel.people.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Users className="size-3.5" /> People
                    </h3>
                    <ul className="space-y-2">
                      {intel.people.map((p, i) => (
                        <li
                          key={i}
                          className="rounded-lg border px-2.5 py-2 text-[12px]"
                        >
                          <p className="font-medium">
                            {p.name}
                            {p.role ? (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                · {p.role}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground">
                            {p.snippet}
                          </p>
                          {p.url && (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] underline"
                            >
                              Profile
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {intel?.projects && intel.projects.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <FolderGit2 className="size-3.5" /> Projects
                    </h3>
                    <ul className="space-y-2">
                      {intel.projects.map((p, i) => (
                        <li
                          key={i}
                          className="rounded-lg border px-2.5 py-2 text-[12px]"
                        >
                          <p className="font-medium">{p.title}</p>
                          <p className="mt-0.5 line-clamp-3 text-[11px] text-muted-foreground">
                            {p.description}
                          </p>
                          {p.url && (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] underline"
                            >
                              Link
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {intel?.mentions?.skills && intel.mentions.skills.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                      Skills mentioned
                    </h3>
                    <div className="flex flex-wrap gap-1">
                      {intel.mentions.skills.map((s) => (
                        <Badge key={s} variant="outline" className="text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </section>
                )}

                {intel?.gaps && intel.gaps.length > 0 && (
                  <section>
                    <h3 className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                      Gaps vs you
                    </h3>
                    <ul className="space-y-1 text-[11px]">
                      {intel.gaps.map((g) => (
                        <li key={g.skill} className="flex justify-between">
                          <span>{g.skill}</span>
                          <span
                            className={
                              g.have ? "text-emerald-600" : "text-amber-600"
                            }
                          >
                            {g.have ? "have" : "gap"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {intel?.waitingReasons && intel.waitingReasons.length > 0 && (
                  <ul className="list-inside list-disc text-[11px] text-muted-foreground">
                    {intel.waitingReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
