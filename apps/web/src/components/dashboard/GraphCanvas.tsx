"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CanvasNode = {
  id: string;
  kind: "email" | "job" | "company" | "contact" | "application";
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  meta: Record<string, unknown>;
};

export type CanvasEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

const KIND_STYLE: Record<
  CanvasNode["kind"],
  { bg: string; ring: string; chip: string }
> = {
  email: {
    bg: "bg-sky-500/10 border-sky-500/40",
    ring: "ring-sky-500",
    chip: "text-sky-700 dark:text-sky-300",
  },
  job: {
    bg: "bg-violet-500/10 border-violet-500/40",
    ring: "ring-violet-500",
    chip: "text-violet-700 dark:text-violet-300",
  },
  company: {
    bg: "bg-emerald-500/10 border-emerald-500/40",
    ring: "ring-emerald-500",
    chip: "text-emerald-700 dark:text-emerald-300",
  },
  contact: {
    bg: "bg-amber-500/10 border-amber-500/40",
    ring: "ring-amber-500",
    chip: "text-amber-700 dark:text-amber-300",
  },
  application: {
    bg: "bg-rose-500/10 border-rose-500/40",
    ring: "ring-rose-500",
    chip: "text-rose-700 dark:text-rose-300",
  },
};

const NODE_W = 168;
const NODE_H = 64;

export function GraphCanvas({
  className,
  onFocusChange,
}: {
  className?: string;
  onFocusChange?: (node: CanvasNode | null) => void;
}) {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Set<string>>(new Set());
  const [focusDetail, setFocusDetail] = useState<{
    node: CanvasNode;
    connected: CanvasNode[];
    application?: { stage: string; jobTitle: string; companyName: string };
    company?: { name: string; domain?: string };
    email?: { subject: string; classification: string; bodyText: string };
  } | null>(null);
  const drag = useRef<{
    id: string;
    ox: number;
    oy: number;
    nx: number;
    ny: number;
  } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/graph");
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function persistLayout(next: CanvasNode[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const layout: Record<string, { x: number; y: number }> = {};
      for (const n of next) layout[n.id] = { x: n.x, y: n.y };
      void fetch("/api/crm/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
    }, 400);
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    const n = nodes.find((x) => x.id === id);
    if (!n) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = {
      id,
      ox: e.clientX,
      oy: e.clientY,
      nx: n.x,
      ny: n.y,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = drag.current;
    const dx = e.clientX - d.ox;
    const dy = e.clientY - d.oy;
    setNodes((prev) => {
      const next = prev.map((n) =>
        n.id === d.id
          ? { ...n, x: Math.max(0, d.nx + dx), y: Math.max(0, d.ny + dy) }
          : n
      );
      return next;
    });
  }

  function onPointerUp() {
    if (!drag.current) return;
    const id = drag.current.id;
    drag.current = null;
    setNodes((prev) => {
      persistLayout(prev);
      return prev;
    });
    void selectNode(id);
  }

  async function selectNode(id: string) {
    setSelected(id);
    const node = nodes.find((n) => n.id === id) || null;
    onFocusChange?.(node);
    try {
      const res = await fetch(
        `/api/crm/graph?focus=${encodeURIComponent(id)}`
      );
      const data = await res.json();
      if (data.focus) {
        const ids = new Set<string>(
          (data.focus.connected || []).map((c: CanvasNode) => c.id)
        );
        ids.add(id);
        setHighlight(ids);
        setFocusDetail({
          node: data.focus.node,
          connected: data.focus.connected || [],
          application: data.focus.application,
          company: data.focus.company,
          email: data.focus.email
            ? {
                subject: data.focus.email.subject,
                classification: data.focus.email.classification,
                bodyText: (data.focus.email.bodyText || "").slice(0, 400),
              }
            : undefined,
        });
      }
    } catch {
      /* ignore */
    }
  }

  function clearFocus() {
    setSelected(null);
    setHighlight(new Set());
    setFocusDetail(null);
    onFocusChange?.(null);
  }

  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const width = Math.max(
    900,
    ...nodes.map((n) => n.x + NODE_W + 40),
    400
  );
  const height = Math.max(
    480,
    ...nodes.map((n) => n.y + NODE_H + 40),
    320
  );

  if (loading) {
    return (
      <div
        className={cn(
          "flex h-80 items-center justify-center rounded-2xl border border-dashed",
          className
        )}
      >
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!nodes.length) {
    return (
      <div
        className={cn(
          "flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-6 text-center",
          className
        )}
      >
        <p className="text-sm font-medium">Your graph is empty</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Paste a recruiter email in the command bar. Emails, jobs, companies,
          and stages appear here as connected blocks you can drag.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {(
            [
              "email",
              "job",
              "application",
              "company",
              "contact",
            ] as CanvasNode["kind"][]
          ).map((k) => (
            <span
              key={k}
              className={cn(
                "rounded-full border px-2 py-0.5 capitalize",
                KIND_STYLE[k].bg,
                KIND_STYLE[k].chip
              )}
            >
              {k}
            </span>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => void load()}
        >
          <Maximize2 className="size-3.5" /> Refresh
        </Button>
      </div>

      <div
        ref={wrapRef}
        className="relative max-h-[min(70vh,560px)] overflow-auto rounded-2xl border bg-muted/20 shadow-inner"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div style={{ width, height, position: "relative" }}>
          <svg
            className="pointer-events-none absolute inset-0"
            width={width}
            height={height}
          >
            <defs>
              <marker
                id="arrow"
                markerWidth="8"
                markerHeight="8"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L6,3 L0,6 Z" className="fill-muted-foreground/50" />
              </marker>
            </defs>
            {edges.map((e) => {
              const a = byId[e.from];
              const b = byId[e.to];
              if (!a || !b) return null;
              const x1 = a.x + NODE_W / 2;
              const y1 = a.y + NODE_H / 2;
              const x2 = b.x + NODE_W / 2;
              const y2 = b.y + NODE_H / 2;
              const lit =
                highlight.size === 0 ||
                (highlight.has(e.from) && highlight.has(e.to));
              return (
                <g key={e.id}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="currentColor"
                    className={cn(
                      lit
                        ? "text-foreground/50"
                        : "text-foreground/10",
                      "transition-opacity"
                    )}
                    strokeWidth={lit && highlight.size ? 2.2 : 1.2}
                    markerEnd="url(#arrow)"
                  />
                  {e.label && lit && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 4}
                      className="fill-muted-foreground text-[9px]"
                      textAnchor="middle"
                    >
                      {e.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {nodes.map((n) => {
            const st = KIND_STYLE[n.kind];
            const lit = highlight.size === 0 || highlight.has(n.id);
            const isSel = selected === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onPointerDown={(e) => onPointerDown(e, n.id)}
                onClick={() => void selectNode(n.id)}
                className={cn(
                  "absolute cursor-grab touch-none rounded-xl border px-2.5 py-2 text-left shadow-sm backdrop-blur-sm active:cursor-grabbing",
                  st.bg,
                  isSel && `ring-2 ${st.ring}`,
                  !lit && "opacity-25",
                  "transition-opacity select-none"
                )}
                style={{
                  left: n.x,
                  top: n.y,
                  width: NODE_W,
                  minHeight: NODE_H,
                }}
              >
                <p
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-wider",
                    st.chip
                  )}
                >
                  {n.kind}
                </p>
                <p className="line-clamp-2 text-[12px] font-semibold leading-snug">
                  {n.label}
                </p>
                {n.sublabel && (
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                    {n.sublabel}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Focus dialog */}
      {focusDetail && (
        <div className="absolute bottom-3 left-3 right-3 z-10 mx-auto max-w-lg rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Badge variant="outline" className="mb-1 capitalize">
                {focusDetail.node.kind}
              </Badge>
              <h3 className="text-sm font-semibold">
                {focusDetail.node.label}
              </h3>
              <p className="text-xs text-muted-foreground">
                {focusDetail.node.sublabel}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={clearFocus}
            >
              <X className="size-3.5" />
            </Button>
          </div>
          {focusDetail.application && (
            <p className="mt-2 text-xs">
              Stage:{" "}
              <strong className="uppercase">
                {focusDetail.application.stage}
              </strong>{" "}
              · {focusDetail.application.jobTitle} @{" "}
              {focusDetail.application.companyName}
            </p>
          )}
          {focusDetail.email && (
            <p className="mt-2 line-clamp-4 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">
                {focusDetail.email.classification}
              </span>
              : {focusDetail.email.bodyText}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1">
            {focusDetail.connected
              .filter((c) => c.id !== focusDetail.node.id)
              .slice(0, 8)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded-full border px-2 py-0.5 text-[10px] hover:bg-muted"
                  onClick={() => void selectNode(c.id)}
                >
                  {c.kind}: {c.label.slice(0, 24)}
                </button>
              ))}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            {focusDetail.connected.length} connected nodes highlighted · drag
            blocks to rearrange
          </p>
        </div>
      )}
    </div>
  );
}
