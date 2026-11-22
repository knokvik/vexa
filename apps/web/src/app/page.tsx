"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flame,
  GraduationCap,
  Heart,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Target,
  Trash2,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { CrmUserTask, EisenhowerQuadrant, UserTaskKind } from "@vexa/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceTranscribeButton } from "@/components/VoiceTranscribeButton";
import { cn } from "@/lib/utils";

type TaskCategoryKey = "personal" | "college" | "interview" | "other";

interface CategoryMeta {
  key: TaskCategoryKey;
  label: string;
  icon: typeof Heart;
  colorName: string;
  chipBorder: string;
  chipBg: string;
  chipText: string;
  dotColor: string;
}

const CATEGORIES: Record<TaskCategoryKey, CategoryMeta> = {
  personal: {
    key: "personal",
    label: "Personal",
    icon: Heart,
    colorName: "pink",
    chipBorder: "border-pink-500/60 hover:border-pink-400",
    chipBg: "bg-pink-500/15 hover:bg-pink-500/25 dark:bg-pink-950/40",
    chipText: "text-pink-300 dark:text-pink-200",
    dotColor: "bg-pink-400",
  },
  college: {
    key: "college",
    label: "College",
    icon: GraduationCap,
    colorName: "green",
    chipBorder: "border-emerald-500/60 hover:border-emerald-400",
    chipBg: "bg-emerald-500/15 hover:bg-emerald-500/25 dark:bg-emerald-950/40",
    chipText: "text-emerald-300 dark:text-emerald-200",
    dotColor: "bg-emerald-400",
  },
  interview: {
    key: "interview",
    label: "Prep / Projects",
    icon: Zap,
    colorName: "cyan",
    chipBorder: "border-cyan-500/60 hover:border-cyan-400",
    chipBg: "bg-cyan-500/15 hover:bg-cyan-500/25 dark:bg-cyan-950/40",
    chipText: "text-cyan-300 dark:text-cyan-200",
    dotColor: "bg-cyan-400",
  },
  other: {
    key: "other",
    label: "Career",
    icon: Wrench,
    colorName: "amber",
    chipBorder: "border-amber-500/60 hover:border-amber-400",
    chipBg: "bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-950/40",
    chipText: "text-amber-300 dark:text-amber-200",
    dotColor: "bg-amber-400",
  },
};

function resolveCategory(kind?: string): CategoryMeta {
  if (!kind) return CATEGORIES.personal;
  if (kind === "personal") return CATEGORIES.personal;
  if (kind === "college") return CATEGORIES.college;
  if (
    kind === "interview" ||
    kind === "project_prep" ||
    kind.includes("interview") ||
    kind.includes("prep") ||
    kind.includes("project")
  ) {
    return CATEGORIES.interview;
  }
  return CATEGORIES.other;
}

interface QuadrantConfig {
  id: EisenhowerQuadrant;
  label: string;
  tag: string;
  icon: typeof Flame;
  accentText: string;
}

const QUADRANTS: QuadrantConfig[] = [
  {
    id: "q1",
    label: "Q1 · Urgent & Important",
    tag: "DO FIRST",
    icon: Flame,
    accentText: "text-rose-400",
  },
  {
    id: "q2",
    label: "Q2 · Not Urgent & Important",
    tag: "DEEP WORK",
    icon: Target,
    accentText: "text-cyan-400",
  },
  {
    id: "q3",
    label: "Q3 · Urgent & Not Important",
    tag: "DELEGATE / QUICK",
    icon: Clock,
    accentText: "text-amber-400",
  },
  {
    id: "q4",
    label: "Q4 · Not Urgent & Not Important",
    tag: "BACKLOG",
    icon: Layers,
    accentText: "text-indigo-400",
  },
];

function formatShortDeadline(dueAt?: string): { text: string; overdue: boolean } {
  if (!dueAt) return { text: "", overdue: false };
  try {
    const d = new Date(dueAt);
    if (isNaN(d.getTime())) return { text: dueAt, overdue: false };
    const diffHours = Math.round((d.getTime() - Date.now()) / (1000 * 60 * 60));
    if (diffHours < 0) {
      const pastH = Math.abs(diffHours);
      return { text: pastH < 24 ? `-${pastH}h` : `-${Math.round(pastH / 24)}d`, overdue: true };
    }
    if (diffHours <= 1) return { text: "<1h", overdue: false };
    if (diffHours <= 24) return { text: `${diffHours}h`, overdue: false };
    return {
      text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      overdue: false,
    };
  } catch {
    return { text: dueAt, overdue: false };
  }
}

/**
 * Organic position offset for scattering chips naturally (NO ROTATION / TILT).
 */
function getOrganicOffsets(id: string, index: number) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  const marginLeft = ((positive % 6) * 12) + ((index % 2) * 8);
  const marginTop = (positive % 4) * 3;

  return {
    marginLeft: `${marginLeft}px`,
    marginTop: `${marginTop}px`,
  };
}

export default function EisenhowerMatrixPage() {
  const [tasks, setTasks] = useState<CrmUserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [isTableView, setIsTableView] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Quick Add State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [targetQuadrant, setTargetQuadrant] = useState<EisenhowerQuadrant>("q1");
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<UserTaskKind>("personal");
  const [newDueAt, setNewDueAt] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  const loadTasks = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch("/api/crm/tasks?all=1");
      const data = await res.json();
      if (data.ok && Array.isArray(data.tasks)) {
        setTasks(data.tasks);
      }
    } catch (e) {
      console.error("Failed to load tasks", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks(false);
  }, [loadTasks]);

  const toggleComplete = async (task: CrmUserTask) => {
    const nextDone = !task.done;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: nextDone } : t))
    );
    try {
      await fetch("/api/crm/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          title: task.title,
          kind: task.kind,
          done: nextDone,
          quadrant: task.quadrant,
          dueAt: task.dueAt,
        }),
      });
    } catch {
      void loadTasks(true);
    }
  };

  const moveQuadrant = async (
    taskId: string,
    nextQuadrant: EisenhowerQuadrant
  ) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, quadrant: nextQuadrant } : t))
    );
    try {
      const t = tasks.find((x) => x.id === taskId);
      if (!t) return;
      await fetch("/api/crm/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          title: t.title,
          kind: t.kind,
          done: t.done,
          quadrant: nextQuadrant,
          dueAt: t.dueAt,
        }),
      });
    } catch {
      void loadTasks(true);
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await fetch(`/api/crm/tasks?id=${encodeURIComponent(taskId)}`, {
        method: "DELETE",
      });
    } catch {
      void loadTasks(true);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSavingNew(true);
    try {
      const res = await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          kind: newCategory,
          quadrant: targetQuadrant,
          dueAt: newDueAt || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok && data.task) {
        setTasks((prev) => [data.task, ...prev]);
        setNewTitle("");
        setNewDueAt("");
        setAddModalOpen(false);
      }
    } catch (e) {
      console.error("Failed to create task", e);
    } finally {
      setSavingNew(false);
    }
  };

  const setPresetDeadline = (hoursAhead: number) => {
    const d = new Date(Date.now() + hoursAhead * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setNewDueAt(local);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedTaskId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, q: EisenhowerQuadrant) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedTaskId;
    if (id) {
      void moveQuadrant(id, q);
    }
    setDraggedTaskId(null);
  };

  // Active uncompleted tasks for the matrix
  const filteredActiveTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.done) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.notes?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterCategory !== "all") {
        const cat = resolveCategory(t.kind);
        if (cat.key !== filterCategory) return false;
      }
      return true;
    });
  }, [tasks, search, filterCategory]);

  // Completed tasks for the table view
  const completedTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (!t.done) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.notes?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filterCategory !== "all") {
        const cat = resolveCategory(t.kind);
        if (cat.key !== filterCategory) return false;
      }
      return true;
    });
  }, [tasks, search, filterCategory]);

  const tasksByQuadrant = useMemo(() => {
    const map: Record<EisenhowerQuadrant, CrmUserTask[]> = {
      q1: [],
      q2: [],
      q3: [],
      q4: [],
    };
    for (const t of filteredActiveTasks) {
      let q: EisenhowerQuadrant = t.quadrant || "q2";
      if (!t.quadrant) {
        if (t.urgent && t.important) q = "q1";
        else if (!t.urgent && t.important) q = "q2";
        else if (t.urgent && !t.important) q = "q3";
        else q = "q4";
      }
      if (map[q]) {
        map[q].push(t);
      } else {
        map.q2.push(t);
      }
    }
    return map;
  }, [filteredActiveTasks]);

  const categoryCounts = useMemo(() => {
    const counts = { all: 0, personal: 0, college: 0, interview: 0, other: 0 };
    for (const t of tasks.filter((x) => !x.done)) {
      counts.all++;
      const c = resolveCategory(t.kind);
      counts[c.key] = (counts[c.key] || 0) + 1;
    }
    return counts;
  }, [tasks]);

  return (
    <div className="flex h-full w-full flex-col gap-2.5 overflow-hidden select-none">
      {/* ── Compact Controls Toolbar ── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto vexa-scroll-hide py-0.5">
          <button
            type="button"
            onClick={() => setFilterCategory("all")}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
              filterCategory === "all"
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            )}
          >
            <span>All</span>
            <span className="text-[10px] opacity-75">({categoryCounts.all})</span>
          </button>

          {/* Personal (Pink Neon) */}
          <button
            type="button"
            onClick={() => setFilterCategory("personal")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              filterCategory === "personal"
                ? "border-pink-500 bg-pink-500 text-white"
                : "border-pink-500/40 bg-pink-500/10 text-pink-300 hover:border-pink-400"
            )}
          >
            <span className="size-1.5 rounded-full bg-pink-400" />
            <span>Personal</span>
            <span className="text-[10px] opacity-80">{categoryCounts.personal}</span>
          </button>

          {/* College (Green Neon) */}
          <button
            type="button"
            onClick={() => setFilterCategory("college")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              filterCategory === "college"
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400"
            )}
          >
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span>College</span>
            <span className="text-[10px] opacity-80">{categoryCounts.college}</span>
          </button>

          {/* Interview Prep & Projects (Cyan Neon) */}
          <button
            type="button"
            onClick={() => setFilterCategory("interview")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
              filterCategory === "interview"
                ? "border-cyan-500 bg-cyan-500 text-white"
                : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400"
            )}
          >
            <span className="size-1.5 rounded-full bg-cyan-400" />
            <span>Prep / Projects</span>
            <span className="text-[10px] opacity-80">{categoryCounts.interview}</span>
          </button>
        </div>

        {/* Right Tools: Search + Add Task */}
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="relative w-36 sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="h-7 rounded-full pl-7 pr-12 text-xs"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-2.5" />
                </button>
              )}
              <VoiceTranscribeButton
                size="sm"
                currentValue={search}
                onTranscript={(text) => setSearch(text)}
              />
            </div>
          </div>

          <Button
            onClick={() => {
              setTargetQuadrant("q1");
              setAddModalOpen(true);
            }}
            size="sm"
            className="h-7 gap-1 rounded-full bg-primary px-3 text-xs font-semibold shadow-sm hover:opacity-90"
          >
            <Plus className="size-3.5" />
            <span>Add</span>
          </Button>
        </div>
      </div>

      {/* ── Single Box with Morphing View (Matrix ⟷ Completed Table) ── */}
      <div className="relative flex-1 rounded-2xl border border-border/80 bg-card/40 backdrop-blur-xl overflow-hidden shadow-sm">
        
        {/* Toggle Button at the Center (rotates arrow to opposite direction when toggled) */}
        <button
          type="button"
          onClick={() => setIsTableView((prev) => !prev)}
          className={cn(
            "group/center absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2",
            "flex size-7 items-center justify-center rounded-full border border-border/90 bg-background/95 shadow-md backdrop-blur-md",
            "hover:scale-110 hover:border-primary/80 hover:bg-muted/90 transition-all duration-300"
          )}
          title={isTableView ? "Transform back to Eisenhower Matrix" : `Transform to Completed Tasks Table (${completedTasks.length} tasks)`}
        >
          <ChevronDown
            className={cn(
              "size-3.5 text-muted-foreground group-hover/center:text-foreground transition-transform duration-300",
              isTableView ? "rotate-180 -translate-y-0.5" : "group-hover/center:translate-y-0.5"
            )}
          />
          {!isTableView && completedTasks.length > 0 && (
            <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-emerald-500 text-[8px] font-bold text-black">
              {completedTasks.length}
            </span>
          )}
        </button>

        {/* ── VIEW 1: Eisenhower Matrix 2x2 Grid ── */}
        <div
          className={cn(
            "absolute inset-0 h-full w-full transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
            isTableView
              ? "opacity-0 scale-[0.98] pointer-events-none -translate-y-2"
              : "opacity-100 scale-100 translate-y-0"
          )}
        >
          {/* Subtle Cross Hair Grid Dividers */}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 border-t border-border/70 dark:border-white/10" />
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 -translate-x-1/2 border-l border-border/70 dark:border-white/10" />

          {/* 2x2 Quadrant Grid */}
          <div className="grid h-full w-full grid-cols-2 grid-rows-2">
            {QUADRANTS.map((quad) => {
              const quadTasks = tasksByQuadrant[quad.id] || [];
              const Icon = quad.icon;

              return (
                <div
                  key={quad.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, quad.id)}
                  className="relative flex flex-col min-h-0 overflow-hidden p-2 sm:p-3 transition-colors hover:bg-muted/10"
                >
                  {/* Quadrant Mini Header */}
                  <div className="flex shrink-0 items-center justify-between gap-1 pb-1.5 border-b border-border/30">
                    <div className="flex items-center gap-1.5 truncate">
                      <Icon className={cn("size-3.5 shrink-0", quad.accentText)} />
                      <span className="text-xs font-semibold tracking-tight text-foreground truncate">
                        {quad.label}
                      </span>
                      <span className="rounded bg-muted/80 px-1 py-0.2 text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
                        {quad.tag}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted/80 px-1 text-[10px] font-bold text-foreground">
                        {quadTasks.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetQuadrant(quad.id);
                          setAddModalOpen(true);
                        }}
                        className="size-5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                        title={`Add task to ${quad.tag}`}
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Tasks Table for this Quadrant */}
                  <div className="flex-1 min-h-0 overflow-y-auto vexa-scroll-hide">
                    {loading ? (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        <Loader2 className="mr-1.5 size-3.5 animate-spin text-primary" />
                        Loading tasks…
                      </div>
                    ) : quadTasks.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground/60 italic">
                        <span>No tasks in {quad.tag}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetQuadrant(quad.id);
                            setAddModalOpen(true);
                          }}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground not-italic transition-colors"
                        >
                          <Plus className="size-2.5" />
                          <span>Add task</span>
                        </button>
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-background/95 backdrop-blur-sm text-[10px] uppercase font-mono text-muted-foreground/70 border-b border-border/30 z-10 select-none">
                          <tr>
                            <th className="w-6 py-1 px-1.5 text-center font-medium" />
                            <th className="py-1 px-1.5 font-medium">Task</th>
                            <th className="w-24 py-1 px-1.5 font-medium hidden sm:table-cell">Category</th>
                            <th className="w-16 py-1 px-1.5 text-right font-medium">Due</th>
                            <th className="w-16 py-1 px-1.5 text-right font-medium" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {quadTasks.map((task) => {
                            const cat = resolveCategory(task.kind);
                            const deadline = formatShortDeadline(task.dueAt);

                            return (
                              <tr
                                key={task.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                className="group/row hover:bg-muted/30 transition-colors cursor-grab active:cursor-grabbing"
                              >
                                {/* Checkbox */}
                                <td className="py-1.5 px-1.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => void toggleComplete(task)}
                                    className="size-3.5 rounded-full border border-border/80 hover:border-emerald-500/80 flex items-center justify-center text-muted-foreground hover:text-emerald-400 transition-colors m-auto"
                                    title="Mark complete"
                                  >
                                    <span className="size-1 rounded-full bg-transparent group-hover/row:bg-muted-foreground/30" />
                                  </button>
                                </td>

                                {/* Title */}
                                <td className="py-1.5 px-1.5 font-medium text-[11px] text-foreground leading-snug">
                                  <div className="flex items-center gap-1.5">
                                    <span className={cn("size-1.5 shrink-0 rounded-full sm:hidden", cat.dotColor)} />
                                    <span className="line-clamp-1" title={task.title}>
                                      {task.title}
                                    </span>
                                  </div>
                                </td>

                                {/* Category Badge */}
                                <td className="py-1.5 px-1.5 whitespace-nowrap hidden sm:table-cell">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none",
                                      cat.chipBorder,
                                      cat.chipBg,
                                      cat.chipText
                                    )}
                                  >
                                    <span className={cn("size-1 rounded-full", cat.dotColor)} />
                                    <span>{cat.label}</span>
                                  </span>
                                </td>

                                {/* Due Date */}
                                <td className="py-1.5 px-1.5 text-right font-mono text-[10px] whitespace-nowrap">
                                  {deadline.text ? (
                                    <span
                                      className={cn(
                                        "rounded px-1 py-0.2",
                                        deadline.overdue
                                          ? "bg-rose-500/20 text-rose-300 font-bold"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      {deadline.text}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="py-1.5 px-1.5 text-right whitespace-nowrap">
                                  <div className="opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-end gap-1">
                                    {(["q1", "q2", "q3", "q4"] as const).map((targetQ) => {
                                      if (targetQ === quad.id) return null;
                                      return (
                                        <button
                                          key={targetQ}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            void moveQuadrant(task.id, targetQ);
                                          }}
                                          className="size-3.5 rounded text-[8px] font-mono uppercase bg-muted/70 hover:bg-foreground hover:text-background text-muted-foreground flex items-center justify-center transition-colors"
                                          title={`Move to ${targetQ.toUpperCase()}`}
                                        >
                                          {targetQ.toUpperCase()}
                                        </button>
                                      );
                                    })}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void deleteTask(task.id);
                                      }}
                                      className="size-3.5 rounded text-muted-foreground hover:text-destructive flex items-center justify-center hover:bg-destructive/10 transition-colors"
                                      title="Delete task"
                                    >
                                      <Trash2 className="size-2.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── VIEW 2: Transformed Completed Tasks Table ── */}
        <div
          className={cn(
            "absolute inset-0 h-full w-full flex flex-col p-4 sm:p-5 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]",
            isTableView
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-[0.98] pointer-events-none translate-y-2"
          )}
        >
          {/* Table Header Bar */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/50 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="size-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">
                  Completed Tasks History
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {completedTasks.length} task{completedTasks.length === 1 ? "" : "s"} accomplished
                </p>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 min-h-0 overflow-y-auto vexa-scroll-hide mt-3">
            {completedTasks.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="size-8 text-muted-foreground/30 mb-2" />
                <p className="font-medium text-foreground">No completed tasks yet</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Complete tasks in the Eisenhower Matrix to log them here.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTableView(false)}
                  className="mt-3 h-7 rounded-full text-xs"
                >
                  Open Matrix
                </Button>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background/95 backdrop-blur-md text-[10px] uppercase font-mono text-muted-foreground border-b border-border/50 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Title</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold">Quadrant</th>
                    <th className="py-2.5 px-3 font-semibold">Due Date</th>
                    <th className="py-2.5 px-3 font-semibold">Completed Date</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/25">
                  {completedTasks.map((task) => {
                    const cat = resolveCategory(task.kind);
                    const due = task.dueAt
                      ? new Date(task.dueAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—";
                    const completedAt = task.updatedAt
                      ? new Date(task.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—";

                    return (
                      <tr
                        key={task.id}
                        className="hover:bg-muted/30 transition-colors group/row"
                      >
                        <td className="py-2.5 px-3 font-medium text-foreground max-w-[280px] truncate line-through opacity-75">
                          {task.title}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                              cat.chipBorder,
                              cat.chipBg,
                              cat.chipText
                            )}
                          >
                            <span className={cn("size-1 rounded-full", cat.dotColor)} />
                            {cat.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground uppercase whitespace-nowrap">
                          {task.quadrant?.toUpperCase() || "Q2"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {due}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {completedAt}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => void toggleComplete(task)}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mr-3"
                            title="Restore task to matrix"
                          >
                            <RotateCcw className="size-3" />
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTask(task.id)}
                            className="text-[11px] text-muted-foreground hover:text-destructive"
                            title="Permanently delete"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* ── Add Task Modal ── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150">
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-background p-5 shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <h2 className="text-sm font-semibold tracking-tight">Add Task Chip</h2>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="size-6 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-3.5 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Title
                  </label>
                  <VoiceTranscribeButton
                    size="sm"
                    currentValue={newTitle}
                    onTranscript={(text) => setNewTitle(text)}
                  />
                </div>
                <Input
                  required
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Raft assignment, RocksDB perf, Gym…"
                  className="mt-1 h-8 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Category (Neon Chip)
                </label>
                <div className="mt-1 grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewCategory("personal")}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-xl border p-2 text-xs transition-all",
                      newCategory === "personal"
                        ? "border-pink-500 bg-pink-500/20 text-pink-300 font-bold shadow-[0_0_8px_rgba(236,72,153,0.3)]"
                        : "border-border/60 bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-pink-400" />
                    <span>Personal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCategory("college")}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-xl border p-2 text-xs transition-all",
                      newCategory === "college"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        : "border-border/60 bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    <span>College</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCategory("interview")}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-xl border p-2 text-xs transition-all",
                      newCategory === "interview"
                        ? "border-cyan-500 bg-cyan-500/20 text-cyan-300 font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]"
                        : "border-border/60 bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-cyan-400" />
                    <span>Prep / Projects</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Quadrant
                </label>
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  {QUADRANTS.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setTargetQuadrant(q.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border p-2 text-left text-xs transition-all",
                        targetQuadrant === q.id
                          ? "border-primary bg-primary/10 font-bold text-foreground"
                          : "border-border/60 bg-muted/30 text-muted-foreground"
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>{q.label.split(" · ")[0]} ({q.tag})</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Deadline
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPresetDeadline(4)}
                      className="rounded bg-muted px-1.5 py-0.2 text-[9px] text-muted-foreground hover:text-foreground"
                    >
                      +4h
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetDeadline(12)}
                      className="rounded bg-muted px-1.5 py-0.2 text-[9px] text-muted-foreground hover:text-foreground"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetDeadline(24)}
                      className="rounded bg-muted px-1.5 py-0.2 text-[9px] text-muted-foreground hover:text-foreground"
                    >
                      Tomorrow
                    </button>
                  </div>
                </div>
                <Input
                  type="datetime-local"
                  value={newDueAt}
                  onChange={(e) => setNewDueAt(e.target.value)}
                  className="mt-1 h-8 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAddModalOpen(false)}
                  className="h-8 rounded-full text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingNew || !newTitle.trim()}
                  className="h-8 rounded-full px-4 text-xs font-semibold"
                >
                  {savingNew ? "Saving…" : "Add Chip"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
