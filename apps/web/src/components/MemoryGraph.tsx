"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildMemoryGraph,
  GROUP_COLORS,
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
};

type SimLink = {
  source: SimNode;
  target: SimNode;
};

/**
 * Force-directed graph canvas — Obsidian graph view vibe.
 */
export function MemoryGraph({
  tasks,
  onSelectTask,
  className,
}: {
  tasks: TaskLike[];
  onSelectTask?: (taskId: string) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const simRef = useRef<{
    nodes: SimNode[];
    links: SimLink[];
    groups: GraphPayload["groups"];
  } | null>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    const graph = buildMemoryGraph(tasks);
    const w = wrapRef.current?.clientWidth || 640;
    const h = wrapRef.current?.clientHeight || 420;

    const nodes: SimNode[] = graph.nodes.map((n, i) => {
      const angle = (i / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
      const r = 40 + Math.random() * Math.min(w, h) * 0.28;
      return {
        ...n,
        x: w / 2 + Math.cos(angle) * r + (Math.random() - 0.5) * 40,
        y: h / 2 + Math.sin(angle) * r + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
      };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = graph.links
      .map((l: GraphLink) => {
        const s = byId.get(l.source);
        const t = byId.get(l.target);
        if (!s || !t) return null;
        return { source: s, target: t };
      })
      .filter(Boolean) as SimLink[];

    simRef.current = { nodes, links, groups: graph.groups };
  }, [tasks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = () => {
      const sim = simRef.current;
      if (!sim) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const { nodes, links } = sim;

      // Forces
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy) || 0.01;
          const minD = (a.size + b.size) * 2.2;
          if (dist < minD * 3) {
            const force = ((minD - dist) / dist) * 0.08;
            dx *= force;
            dy *= force;
            a.vx -= dx;
            a.vy -= dy;
            b.vx += dx;
            b.vy += dy;
          }
        }
      }

      for (const l of links) {
        const dx = l.target.x - l.source.x;
        const dy = l.target.y - l.source.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const ideal = 70;
        const force = ((dist - ideal) / dist) * 0.015;
        const fx = dx * force;
        const fy = dy * force;
        l.source.vx += fx;
        l.source.vy += fy;
        l.target.vx -= fx;
        l.target.vy -= fy;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (w / 2 - n.x) * 0.0015;
        n.vy += (h / 2 - n.y) * 0.0015;
        n.vx *= 0.86;
        n.vy *= 0.86;
        if (dragRef.current?.id === n.id) continue;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(12, Math.min(w - 12, n.x));
        n.y = Math.max(12, Math.min(h - 12, n.y));
      }

      // Draw
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0c0c0e";
      ctx.fillRect(0, 0, w, h);

      // links
      ctx.strokeStyle = "rgba(148, 163, 184, 0.22)";
      ctx.lineWidth = 0.8;
      for (const l of links) {
        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();
      }

      // nodes
      for (const n of nodes) {
        const color = GROUP_COLORS[n.group] || "#94a3b8";
        const r = n.size * (hover === n.id ? 1.35 : 1);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = hover && hover !== n.id ? 0.45 : 0.92;
        ctx.fill();
        ctx.globalAlpha = 1;

        // soft glow for task hubs
        if (n.group === "type" || n.group === "task") {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.12;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        if (hover === n.id || n.group === "type" || n.size > 11) {
          ctx.font = `${n.group === "type" ? 11 : 9}px ui-sans-serif, system-ui`;
          ctx.fillStyle = "rgba(248,250,252,0.9)";
          ctx.textAlign = "center";
          ctx.fillText(n.label.slice(0, 22), n.x, n.y + r + 11);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const hit = (mx: number, my: number) => {
      const sim = simRef.current;
      if (!sim) return null;
      let best: SimNode | null = null;
      let bestD = 14;
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
        }
        return;
      }
      const n = hit(mx, my);
      setHover(n?.id ?? null);
      canvas.style.cursor = n ? "pointer" : "default";
    };

    const onDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const n = hit(mx, my);
      if (n) {
        dragRef.current = { id: n.id, dx: mx - n.x, dy: my - n.y };
      }
    };

    const onUp = () => {
      const id = dragRef.current?.id;
      dragRef.current = null;
      if (id?.startsWith("task:") && onSelectTask) {
        onSelectTask(id.replace(/^task:/, ""));
      }
    };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
    };
  }, [tasks, onSelectTask, hover]);

  const groups = [
    { id: "type", label: "TASK TYPES" },
    { id: "task", label: "TASKS" },
    { id: "step", label: "STEPS" },
    { id: "status", label: "STATUS" },
    { id: "model", label: "MODELS" },
    { id: "meta", label: "META" },
    { id: "note", label: "NOTES" },
  ];

  return (
    <div ref={wrapRef} className={`relative h-full min-h-[320px] w-full ${className || ""}`}>
      {/* Legend — Obsidian-style left panel */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 backdrop-blur-md">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
          Tags
        </p>
        <ul className="space-y-1.5">
          {groups.map((g) => (
            <li key={g.id} className="flex items-center gap-2 text-[11px] text-white/80">
              <span
                className="size-2.5 rounded-full"
                style={{ background: GROUP_COLORS[g.id] }}
              />
              {g.label}
            </li>
          ))}
        </ul>
        {hover && (
          <p className="mt-2 max-w-[160px] truncate border-t border-white/10 pt-2 font-mono text-[10px] text-white/60">
            {hover}
          </p>
        )}
      </div>
      <canvas ref={canvasRef} className="h-full w-full rounded-lg" />
      {tasks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Run a search or draft to grow the graph
        </div>
      )}
    </div>
  );
}
