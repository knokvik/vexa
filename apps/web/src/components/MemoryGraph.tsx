"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMemoryGraph,
  GROUP_COLORS_LIGHT,
  type GraphLink,
  type GraphNode,
  type GraphPayload,
} from "@/lib/memory-graph";

type TaskLike = {
  id: string;
  type: string;
  status: string;
  steps: Array<{ name: string; status: string; modelUsed?: string }>;
  memoryNotes: string[];
  meta?: Record<string, unknown>;
};

type SimNode = GraphNode & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fixed?: boolean;
};

type SimLink = {
  source: SimNode;
  target: SimNode;
};

/** Stable hash → 0..1 for deterministic layout (no random jitter). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Stable, readable memory graph — light theme.
 * Physics cools and freezes so nodes stop bouncing.
 */
export function MemoryGraph({
  tasks,
  extra,
  onSelectTask,
  className,
}: {
  tasks: TaskLike[];
  extra?: { nodes?: GraphNode[]; links?: GraphLink[] };
  onSelectTask?: (taskId: string) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const hoverRef = useRef<string | null>(null);
  const simRef = useRef<{
    nodes: SimNode[];
    links: SimLink[];
    groups: GraphPayload["groups"];
    alpha: number;
    frozen: boolean;
  } | null>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const onSelectRef = useRef(onSelectTask);
  onSelectRef.current = onSelectTask;

  // Stable fingerprint so parent re-renders don't rebuild the graph
  const extraKey = useMemo(() => {
    if (!extra?.nodes?.length) return "";
    return `${extra.nodes.length}:${extra.links?.length ?? 0}:${extra.nodes
      .slice(0, 20)
      .map((n) => n.id)
      .join(",")}`;
  }, [extra]);

  const taskKey = useMemo(
    () => tasks.map((t) => `${t.id}:${t.status}:${t.steps?.length ?? 0}`).join("|"),
    [tasks]
  );

  // Build / rebuild simulation only when data actually changes
  useEffect(() => {
    const graph = buildMemoryGraph(tasks, extra);
    const w = wrapRef.current?.clientWidth || 640;
    const h = wrapRef.current?.clientHeight || 420;
    const cx = w / 2;
    const cy = h / 2;
    const n = Math.max(graph.nodes.length, 1);

    const nodes: SimNode[] = graph.nodes.map((node, i) => {
      // Deterministic ring + slight radial spread by group
      const a = (i / n) * Math.PI * 2 + hash01(node.id) * 0.35;
      const ring =
        node.group === "type" || node.group === "company"
          ? 0.18
          : node.group === "task"
            ? 0.32
            : 0.42;
      const r =
        Math.min(w, h) * (0.12 + ring + hash01(node.id + ":r") * 0.08);
      return {
        ...node,
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        vx: 0,
        vy: 0,
        fixed: false,
      };
    });

    const byId = new Map(nodes.map((node) => [node.id, node]));
    const links: SimLink[] = graph.links
      .map((l: GraphLink) => {
        const s = byId.get(l.source);
        const t = byId.get(l.target);
        if (!s || !t) return null;
        return { source: s, target: t };
      })
      .filter(Boolean) as SimLink[];

    simRef.current = {
      nodes,
      links,
      groups: graph.groups,
      alpha: 1,
      frozen: false,
    };
    // kick a short settle pass
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extraKey/taskKey stand in for data
  }, [taskKey, extraKey]);

  // Animation loop — does NOT depend on hover (that was restarting physics constantly)
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // redraw once after resize without unfreezing
      draw();
    };

    const stepPhysics = () => {
      const sim = simRef.current;
      if (!sim || sim.frozen) return;

      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const { nodes, links } = sim;
      const alpha = sim.alpha;

      // Soft repulsion (local only)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy) || 0.01;
          const minD = (a.size + b.size) * 2.8 + 18;
          if (dist < minD) {
            const force = ((minD - dist) / dist) * 0.04 * alpha;
            dx *= force;
            dy *= force;
            if (!a.fixed) {
              a.vx -= dx;
              a.vy -= dy;
            }
            if (!b.fixed) {
              b.vx += dx;
              b.vy += dy;
            }
          }
        }
      }

      // Springs
      for (const l of links) {
        const dx = l.target.x - l.source.x;
        const dy = l.target.y - l.source.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const ideal = 78;
        const force = ((dist - ideal) / dist) * 0.012 * alpha;
        const fx = dx * force;
        const fy = dy * force;
        if (!l.source.fixed) {
          l.source.vx += fx;
          l.source.vy += fy;
        }
        if (!l.target.fixed) {
          l.target.vx -= fx;
          l.target.vy -= fy;
        }
      }

      // Gentle center pull + strong damping
      let energy = 0;
      for (const n of nodes) {
        if (n.fixed || dragRef.current?.id === n.id) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx += (w / 2 - n.x) * 0.0008 * alpha;
        n.vy += (h / 2 - n.y) * 0.0008 * alpha;
        n.vx *= 0.78;
        n.vy *= 0.78;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(20, Math.min(w - 20, n.x));
        n.y = Math.max(20, Math.min(h - 20, n.y));
        energy += n.vx * n.vx + n.vy * n.vy;
      }

      // Cool and freeze when calm
      sim.alpha = Math.max(0, sim.alpha - 0.012);
      if (sim.alpha < 0.02 || energy < 0.02) {
        sim.alpha = 0;
        sim.frozen = true;
        for (const n of nodes) {
          n.vx = 0;
          n.vy = 0;
        }
      }
    };

    const draw = () => {
      const sim = simRef.current;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (!sim) return;

      // Light paper background
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, w, h);

      // subtle grid
      ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
      ctx.lineWidth = 1;
      const grid = 32;
      for (let x = 0; x < w; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const { nodes, links } = sim;
      const hover = hoverRef.current;

      // links
      ctx.strokeStyle = "rgba(100, 116, 139, 0.28)";
      ctx.lineWidth = 1;
      for (const l of links) {
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();
      }

      // nodes
      for (const n of nodes) {
        const color = GROUP_COLORS_LIGHT[n.group] || "#64748b";
        const active = hover === n.id;
        const r = n.size * (active ? 1.25 : 1);

        // soft ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = hover && !active ? 0.55 : 1;
        ctx.fill();
        ctx.globalAlpha = 1;

        // border for contrast on light bg
        ctx.strokeStyle = "rgba(15, 23, 42, 0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Labels: always show hubs + hover; more labels when frozen (readable)
        const showLabel =
          active ||
          n.group === "type" ||
          n.group === "company" ||
          n.size > 11 ||
          (sim.frozen && (n.group === "task" || n.group === "status"));

        if (showLabel) {
          const label = n.label.slice(0, 22);
          ctx.font = `${n.group === "type" || n.group === "company" ? 11 : 10}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          // white halo then dark text for readability
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(248, 250, 252, 0.95)";
          ctx.strokeText(label, n.x, n.y + r + 4);
          ctx.fillStyle = "#0f172a";
          ctx.fillText(label, n.x, n.y + r + 4);
        }
      }
    };

    const tick = () => {
      const sim = simRef.current;
      if (sim && !sim.frozen) {
        // a few physics substeps per frame for faster settle
        stepPhysics();
        stepPhysics();
        draw();
        rafRef.current = requestAnimationFrame(tick);
      } else {
        draw();
        // idle: only redraw on demand via events; keep a cheap idle loop stopped
        rafRef.current = 0;
      }
    };

    const startLoop = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(tick);
    };

    resize();
    startLoop();
    window.addEventListener("resize", resize);

    const hit = (mx: number, my: number) => {
      const sim = simRef.current;
      if (!sim) return null;
      let best: SimNode | null = null;
      let bestD = 16;
      for (const n of sim.nodes) {
        const d = Math.hypot(n.x - mx, n.y - my);
        if (d < bestD + n.size) {
          bestD = d;
          best = n;
        }
      }
      return best;
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (dragRef.current) {
        const sim = simRef.current;
        const n = sim?.nodes.find((x) => x.id === dragRef.current!.id);
        if (n) {
          n.x = mx - dragRef.current.dx;
          n.y = my - dragRef.current.dy;
          n.vx = 0;
          n.vy = 0;
          n.fixed = true;
          draw();
        }
        return;
      }

      const n = hit(mx, my);
      const next = n?.id ?? null;
      if (next !== hoverRef.current) {
        hoverRef.current = next;
        setHoverLabel(next);
        canvas.style.cursor = n ? "pointer" : "default";
        draw();
      }
    };

    const onDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const n = hit(mx, my);
      if (n) {
        dragRef.current = { id: n.id, dx: mx - n.x, dy: my - n.y };
        n.fixed = true;
        n.vx = 0;
        n.vy = 0;
      }
    };

    const onUp = () => {
      const id = dragRef.current?.id;
      dragRef.current = null;
      // Keep node where user dropped it (fixed) — no bounce-back
      if (id?.startsWith("task:") && onSelectRef.current) {
        onSelectRef.current(id.replace(/^task:/, ""));
      }
      draw();
    };

    const onLeave = () => {
      if (hoverRef.current) {
        hoverRef.current = null;
        setHoverLabel(null);
        draw();
      }
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseleave", onLeave);
    window.addEventListener("mouseup", onUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("mouseup", onUp);
    };
  }, [taskKey, extraKey]);

  const groups = [
    { id: "type", label: "TASK TYPES" },
    { id: "task", label: "TASKS" },
    { id: "step", label: "STEPS" },
    { id: "status", label: "STATUS" },
    { id: "model", label: "MODELS" },
    { id: "meta", label: "META" },
    { id: "note", label: "NOTES" },
    { id: "company", label: "COMPANIES" },
  ];

  const hasNodes =
    tasks.length > 0 || (extra?.nodes && extra.nodes.length > 0);

  return (
    <div
      ref={wrapRef}
      className={`relative h-full min-h-[320px] w-full ${className || ""}`}
    >
      {/* Light legend panel */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-md">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Tags
        </p>
        <ul className="space-y-1.5">
          {groups.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-2 text-[11px] text-slate-700"
            >
              <span
                className="size-2.5 rounded-full ring-1 ring-black/10"
                style={{ background: GROUP_COLORS_LIGHT[g.id] }}
              />
              {g.label}
            </li>
          ))}
        </ul>
        {hoverLabel && (
          <p className="mt-2 max-w-[180px] truncate border-t border-slate-200 pt-2 font-mono text-[10px] text-slate-600">
            {hoverLabel}
          </p>
        )}
        <p className="mt-2 text-[9px] text-slate-400">
          Settles then freezes · drag to rearrange
        </p>
      </div>
      <canvas ref={canvasRef} className="h-full w-full rounded-lg" />
      {!hasNodes && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
          Search, apply later, or draft — companies land here
        </div>
      )}
    </div>
  );
}
