"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
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

type Tab = "graph" | "notes";

function statusIcon(status: string) {
  if (status === "done")
    return <CheckCircle2 className="size-3.5 text-success" />;
  if (status === "failed" || status === "error")
    return <XCircle className="size-3.5 text-destructive" />;
  if (status === "running")
    return <Loader2 className="size-3.5 animate-spin text-primary" />;
  return <Circle className="size-3.5 text-muted-foreground" />;
}

export function MemoryVaultButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("graph");
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
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
    } catch {
      setTasks([]);
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
      setMarkdown("");
      setTab("graph");
    }
  }, [open, loadList]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          title="Task memory vault (Obsidian-style graph + notes)"
        >
          <BookOpen className="h-[1.1rem] w-[1.1rem]" />
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
            Obsidian-style graph of tasks, steps, models, and notes. Click a
            green task node to open its Markdown note.
          </SheetDescription>
        </SheetHeader>

        {tab === "graph" && (
          <div className="min-h-0 flex-1 bg-[#0c0c0e] p-2">
            {loading ? (
              <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Building graph…
              </div>
            ) : (
              <MemoryGraph
                tasks={tasks}
                onSelectTask={(id) => void loadDetail(id)}
                className="h-[min(70vh,560px)]"
              />
            )}
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
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(t.updatedAt).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>

            <div className="flex min-h-0 flex-col">
              {selected && (
                <div className="flex flex-wrap items-center gap-1.5 border-b px-3 py-2">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {paths.md || `memory/tasks/${selected.slice(0, 8)}.md`}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-7 text-[10px]"
                    onClick={() => setTab("graph")}
                  >
                    <Network className="size-3" /> Back to graph
                  </Button>
                </div>
              )}
              <ScrollArea className="flex-1">
                <div className="p-4">
                  {!selected && (
                    <p className="text-xs text-muted-foreground">
                      Select a task note, or open{" "}
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={() => setTab("graph")}
                      >
                        Graph
                      </button>{" "}
                      and click a green task node.
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
              {selected && (
                <>
                  <Separator />
                  <div className="space-y-1 p-3 text-[10px] text-muted-foreground">
                    <p>
                      JSON:{" "}
                      <code className="rounded bg-muted px-1">
                        {paths.json || `apps/web/data/tasks/${selected}.json`}
                      </code>
                    </p>
                    <p>
                      Open folder{" "}
                      <code className="rounded bg-muted px-1">memory/</code> in
                      Obsidian for the offline vault.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
