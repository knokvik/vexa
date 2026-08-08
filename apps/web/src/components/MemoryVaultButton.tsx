"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Network,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { MemoryGraph } from "@/components/MemoryGraph";
import type { GraphLink, GraphNode } from "@/lib/memory-graph";

type TaskStep = {
  name: string;
  status: string;
  modelUsed?: string;
  error?: string;
  notes?: string;
};

type TaskRecord = {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown>;
  steps: TaskStep[];
  memoryNotes: string[];
};

type CompanyRow = {
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  appliedCount: number;
  queuedCount: number;
  submittedCount: number;
  jobs: Array<{
    jobId: string;
    title: string;
    url?: string;
    status: string;
    at: string;
  }>;
};

type MemoryEvent = {
  id: string;
  type: string;
  at: string;
  company?: string;
  title?: string;
  query?: string;
  note?: string;
  status?: string;
};

type AppMemoryPayload = {
  updatedAt?: string;
  companies: CompanyRow[];
  searches: string[];
  events: MemoryEvent[];
  paths?: { json?: string; md?: string };
};

type Tab = "graph" | "companies" | "notes";

function statusIcon(status: string) {
  if (status === "done")
    return <CheckCircle2 className="size-3.5 text-success" />;
  if (status === "failed" || status === "error")
    return <XCircle className="size-3.5 text-destructive" />;
  if (status === "running")
    return <Loader2 className="size-3.5 animate-spin text-primary" />;
  return <Circle className="size-3.5 text-muted-foreground" />;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    submitted: "bg-success/15 text-success",
    draft_prepared: "bg-primary/15 text-primary",
    prepared: "bg-primary/15 text-primary",
    apply_later: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    queued: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    discovered: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
    seen: "bg-muted text-muted-foreground",
  };
  return map[status] || "bg-muted text-muted-foreground";
}

export function MemoryVaultButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("graph");
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [appMemory, setAppMemory] = useState<AppMemoryPayload>({
    companies: [],
    searches: [],
    events: [],
  });
  const [appGraph, setAppGraph] = useState<{
    nodes: GraphNode[];
    links: GraphLink[];
  }>({ nodes: [], links: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [paths, setPaths] = useState<{ json?: string; md?: string }>({});
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
      setAppMemory(
        data.appMemory || {
          companies: [],
          searches: [],
          events: [],
        }
      );
      setAppGraph(data.appGraph || { nodes: [], links: [] });
    } catch {
      setTasks([]);
      setAppMemory({ companies: [], searches: [], events: [] });
      setAppGraph({ nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setSelected(id);
    setTab("notes");
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/tasks?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      setMarkdown(data.markdown || "");
      setPaths(data.paths || {});
    } catch {
      setMarkdown("_Failed to load note_");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadList();
      setSelected(null);
      setSelectedCompany(null);
      setMarkdown("");
      setTab("graph");
    }
  }, [open, loadList]);

  const companies = [...(appMemory.companies || [])].sort((a, b) =>
    b.lastSeenAt.localeCompare(a.lastSeenAt)
  );
  const activeCompany =
    companies.find((c) => c.name === selectedCompany) || companies[0] || null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="vexa-icon-btn relative h-9 w-9 rounded-full"
          title="Memory vault — companies applied, tasks, graph"
        >
          <BookOpen className="h-[1.1rem] w-[1.1rem]" />
          {companies.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-semibold text-black">
              {companies.length > 99 ? "99+" : companies.length}
            </span>
          )}
          <span className="sr-only">Open memory vault</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl"
      >
        <SheetHeader className="space-y-2 border-b p-4 text-left">
          <div className="flex items-center justify-between gap-2 pr-6">
            <SheetTitle className="flex items-center gap-2 text-base">
              <BookOpen className="size-4 text-primary" />
              Memory vault
            </SheetTitle>
            <div className="flex items-center gap-1">
              <div className="inline-flex rounded-lg border p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={tab === "graph" ? "default" : "ghost"}
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setTab("graph")}
                >
                  <Network className="size-3.5" />
                  Graph
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={tab === "companies" ? "default" : "ghost"}
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setTab("companies")}
                >
                  <Building2 className="size-3.5" />
                  All
                  {companies.length > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-0.5 h-4 px-1 text-[9px]"
                    >
                      {companies.length}
                    </Badge>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={tab === "notes" ? "default" : "ghost"}
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setTab("notes")}
                >
                  <FileText className="size-3.5" />
                  Notes
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => void loadList()}
                disabled={loading}
              >
                <RefreshCw
                  className={cn("size-3.5", loading && "animate-spin")}
                />
              </Button>
            </div>
          </div>
          <SheetDescription className="text-xs">
            Light graph settles then freezes so you can read it. Cyan = companies.
            Drag nodes to rearrange; click green tasks for notes.
          </SheetDescription>
        </SheetHeader>

        {tab === "graph" && (
          <div className="min-h-0 flex-1 bg-slate-50 p-2 dark:bg-[#0c0c0e]">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Building graph…
              </div>
            ) : (
              <MemoryGraph
                tasks={tasks}
                extra={appGraph}
                onSelectTask={(id) => void loadDetail(id)}
                className="h-[min(70vh,560px)]"
              />
            )}
          </div>
        )}

        {tab === "companies" && (
          <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[12rem_1fr]">
            <ScrollArea className="border-b sm:border-b-0 sm:border-r">
              <div className="space-y-0.5 p-2">
                {loading && (
                  <p className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Loading…
                  </p>
                )}
                {!loading && companies.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">
                    No companies yet. Search jobs, open Apply intel, or queue
                    Apply later.
                  </p>
                )}
                {companies.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setSelectedCompany(c.name)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted",
                      (selectedCompany || companies[0]?.name) === c.name &&
                        "bg-accent text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <Building2 className="size-3 shrink-0 text-cyan-500" />
                      <span className="truncate font-medium">{c.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Q{c.queuedCount} · D{c.appliedCount} · S
                      {c.submittedCount}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>

            <ScrollArea className="flex-1">
              <div className="space-y-4 p-4">
                {!activeCompany && !loading && (
                  <p className="text-xs text-muted-foreground">
                    Companies you touch show up here and in{" "}
                    <code className="rounded bg-muted px-1">
                      memory/APP_MEMORY.md
                    </code>
                    .
                  </p>
                )}

                {activeCompany && (
                  <>
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Building2 className="size-4 text-cyan-500" />
                        {activeCompany.name}
                      </h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        First{" "}
                        {new Date(activeCompany.firstSeenAt).toLocaleString()} ·
                        Last{" "}
                        {new Date(activeCompany.lastSeenAt).toLocaleString()}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          Queued {activeCompany.queuedCount}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Drafted {activeCompany.appliedCount}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Submitted {activeCompany.submittedCount}
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Roles
                      </p>
                      {activeCompany.jobs.map((j) => (
                        <div
                          key={j.jobId + j.at}
                          className="rounded-lg border p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium">
                                {j.title}
                              </p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {j.jobId.slice(0, 12)}…
                              </p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                                statusBadge(j.status)
                              )}
                            >
                              {j.status}
                            </span>
                          </div>
                          {j.url && (
                            <a
                              href={j.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 block truncate text-[10px] text-primary hover:underline"
                            >
                              {j.url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {(appMemory.searches?.length ?? 0) > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Recent searches
                      </p>
                      <ul className="flex flex-wrap gap-1.5">
                        {appMemory.searches.slice(0, 20).map((q) => (
                          <li key={q}>
                            <Badge
                              variant="secondary"
                              className="max-w-[14rem] truncate font-normal text-[10px]"
                            >
                              {q}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {tab === "notes" && (
          <div className="grid min-h-0 flex-1 grid-cols-1 sm:grid-cols-[11rem_1fr]">
            <ScrollArea className="border-b sm:border-b-0 sm:border-r">
              <div className="space-y-0.5 p-2">
                {loading && (
                  <p className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Loading…
                  </p>
                )}
                {!loading && tasks.length === 0 && (
                  <p className="p-3 text-xs text-muted-foreground">
                    No tasks yet. Run a search or prepare a draft.
                  </p>
                )}
                {tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void loadDetail(t.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-2 py-2 text-left text-xs transition-colors hover:bg-muted",
                      selected === t.id && "bg-accent text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {statusIcon(t.status)}
                      <span className="truncate font-medium">{t.type}</span>
                    </div>
                    <span className="truncate font-mono text-[10px] text-muted-foreground">
                      {t.id.slice(0, 8)}…
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>

            <div className="flex min-h-0 flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {!selected && (
                    <p className="text-xs text-muted-foreground">
                      Select a task note or open Graph.
                    </p>
                  )}
                  {detailLoading && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Opening note…
                    </p>
                  )}
                  {selected && !detailLoading && (
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/90">
                      {markdown}
                    </pre>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
