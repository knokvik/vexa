"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";

type TableData = {
  name: string;
  columns: string[];
  rows: Array<Record<string, string | number | boolean | undefined>>;
};

const HEADER_COLORS: Record<string, string> = {
  emails: "bg-emerald-500 text-emerald-950",
  companies: "bg-teal-400 text-teal-950",
  applications: "bg-cyan-400 text-cyan-950",
  jobs: "bg-sky-400 text-sky-950",
  contacts: "bg-lime-400 text-lime-950",
};

const DEFAULT_POS: Record<string, { x: number; y: number }> = {
  emails: { x: 24, y: 24 },
  companies: { x: 340, y: 24 },
  applications: { x: 656, y: 24 },
  jobs: { x: 24, y: 320 },
  contacts: { x: 340, y: 320 },
};

/**
 * Supabase Schema Visualizer–style table cards on a dark grid.
 * Draggable cards · no per-row wires.
 */
export function SchemaTables({
  refreshKey = 0,
  onSelectRow,
  className,
}: {
  refreshKey?: number;
  onSelectRow?: (table: string, row: Record<string, unknown>) => void;
  className?: string;
}) {
  const [tables, setTables] = useState<Record<string, TableData>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState(DEFAULT_POS);
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{
    id: string;
    ox: number;
    oy: number;
    nx: number;
    ny: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/tables");
      const data = await res.json();
      setTables(data.tables || {});
      setCounts(data.counts || {});
      try {
        const saved = localStorage.getItem("vexa_schema_pos");
        if (saved) setPos({ ...DEFAULT_POS, ...JSON.parse(saved) });
      } catch {
        /* ignore */
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function onPointerDown(e: React.PointerEvent, id: string) {
    e.preventDefault();
    const p = pos[id] || DEFAULT_POS[id] || { x: 0, y: 0 };
    drag.current = {
      id,
      ox: e.clientX,
      oy: e.clientY,
      nx: p.x,
      ny: p.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const d = drag.current;
    const dx = e.clientX - d.ox;
    const dy = e.clientY - d.oy;
    setPos((prev) => ({
      ...prev,
      [d.id]: {
        x: Math.max(0, d.nx + dx),
        y: Math.max(0, d.ny + dy),
      },
    }));
  }

  function onPointerUp() {
    if (!drag.current) return;
    drag.current = null;
    setPos((prev) => {
      try {
        localStorage.setItem("vexa_schema_pos", JSON.stringify(prev));
      } catch {
        /* ignore */
      }
      return prev;
    });
  }

  const order = ["emails", "companies", "applications", "jobs", "contacts"];
  const width = Math.max(
    980,
    ...order.map((k) => (pos[k]?.x || 0) + 300),
    400
  );
  const height = Math.max(
    620,
    ...order.map((k) => (pos[k]?.y || 0) + 280),
    400
  );

  if (loading) {
    return (
      <div
        className={cn(
          "flex h-80 items-center justify-center rounded-xl border border-border/40 bg-zinc-950",
          className
        )}
      >
        <Loader2 className="size-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative max-h-[min(72vh,640px)] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 shadow-inner",
        className
      )}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Grid like Supabase */}
      <div
        className="relative"
        style={{
          width,
          height,
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {order.map((key) => {
          const t = tables[key];
          if (!t) return null;
          const p = pos[key] || DEFAULT_POS[key];
          const header = HEADER_COLORS[key] || "bg-emerald-400 text-emerald-950";
          const cols = (t.columns || []).filter((c) => c !== "id").slice(0, 6);
          const rows = (t.rows || []).slice(0, 8);
          const isSel = selected === key;

          return (
            <div
              key={key}
              className={cn(
                "absolute w-[280px] select-none overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-900 shadow-xl",
                isSel && "ring-2 ring-emerald-400/80"
              )}
              style={{ left: p.x, top: p.y }}
            >
              {/* Header bar — drag handle */}
              <div
                className={cn(
                  "flex cursor-grab items-center justify-between px-3 py-2 active:cursor-grabbing",
                  header
                )}
                onPointerDown={(e) => onPointerDown(e, key)}
                onClick={() => setSelected(key)}
              >
                <span className="text-sm font-semibold tracking-tight">
                  {t.name}
                </span>
                <span className="font-mono text-[10px] opacity-80">
                  {counts[key] ?? rows.length}
                </span>
              </div>

              {/* Column schema strip */}
              <div className="border-b border-zinc-800 bg-zinc-900/90 px-2 py-1.5">
                <div className="space-y-0.5">
                  {cols.map((col) => (
                    <div
                      key={col}
                      className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300"
                    >
                      {col === "id" || col.endsWith("_id") ? (
                        <KeyRound className="size-3 text-amber-400/90" />
                      ) : (
                        <Diamond className="size-2.5 text-zinc-500" />
                      )}
                      <span className="truncate">{col}</span>
                      <span className="ml-auto text-[10px] text-zinc-500">
                        text
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data rows */}
              <div className="max-h-40 overflow-y-auto">
                {rows.length === 0 ? (
                  <p className="px-3 py-4 text-center text-[11px] text-zinc-500">
                    No rows yet
                  </p>
                ) : (
                  <table className="w-full text-left font-mono text-[10px]">
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={String(row.id || i)}
                          className="cursor-pointer border-t border-zinc-800/80 hover:bg-zinc-800/60"
                          onClick={() => {
                            setSelected(key);
                            onSelectRow?.(key, row as Record<string, unknown>);
                          }}
                        >
                          <td className="truncate px-2 py-1.5 text-zinc-200">
                            {String(
                              row.name ||
                                row.subject ||
                                row.title ||
                                row.role ||
                                row.company ||
                                row.id ||
                                "—"
                            ).slice(0, 28)}
                          </td>
                          <td className="truncate px-2 py-1.5 text-right text-zinc-500">
                            {String(
                              row.stage ||
                                row.classification ||
                                row.applied ||
                                row.role ||
                                row.domain ||
                                ""
                            ).slice(0, 14)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
