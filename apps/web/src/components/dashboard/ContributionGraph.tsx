"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Day = { date: string; count: number };

function level(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** High-contrast cells so empty boxes always show (light + dark) */
const LEVEL_CLS = [
  "bg-zinc-200 dark:bg-zinc-800 border border-zinc-300/80 dark:border-zinc-700",
  "bg-emerald-200 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-900",
  "bg-emerald-400 dark:bg-emerald-800 border border-emerald-500 dark:border-emerald-700",
  "bg-emerald-500 dark:bg-emerald-600 border border-emerald-600 dark:border-emerald-500",
  "bg-emerald-600 dark:bg-emerald-400 border border-emerald-700 dark:border-emerald-300",
];

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function localDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Always build a full ~1 year grid client-side so boxes never disappear */
function buildYearDays(counts: Map<string, number>): Day[] {
  const out: Day[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    out.push({ date: key, count: counts.get(key) || 0 });
  }
  return out;
}

/**
 * GitHub-style contribution heatmap — every day is a visible box.
 */
export function ContributionGraph({
  refreshKey = 0,
  className,
}: {
  refreshKey?: number;
  className?: string;
}) {
  const [countMap, setCountMap] = useState<Map<string, number>>(new Map());
  const [selected, setSelected] = useState<Day | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/crm/tables")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const map = new Map<string, number>();
        for (const row of (d.contribution || []) as Day[]) {
          if (row?.date) map.set(row.date.slice(0, 10), Number(row.count) || 0);
        }
        setCountMap(map);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const days = useMemo(() => buildYearDays(countMap), [countMap]);
  const total = useMemo(
    () => days.reduce((s, d) => s + d.count, 0),
    [days]
  );

  const { weeks, monthMarks } = useMemo(() => {
    // Pad so first day aligns to Sunday
    const first = new Date(days[0].date + "T12:00:00");
    const pad = first.getDay();
    const padded: Array<Day | null> = [
      ...Array.from({ length: pad }, () => null),
      ...days,
    ];
    while (padded.length % 7 !== 0) padded.push(null);
    const weekCount = padded.length / 7;

    const marks: { label: string; week: number }[] = [];
    let lastM = -1;
    for (let i = 0; i < padded.length; i++) {
      const cell = padded[i];
      if (!cell) continue;
      const m = new Date(cell.date + "T12:00:00").getMonth();
      if (m !== lastM) {
        marks.push({ label: MONTHS[m], week: Math.floor(i / 7) });
        lastM = m;
      }
    }
    return { weeks: weekCount, monthMarks: marks, padded };
  }, [days]);

  // Column-major weeks: each week is 7 cells Sun→Sat
  const weekColumns = useMemo(() => {
    const first = new Date(days[0].date + "T12:00:00");
    const pad = first.getDay();
    const padded: Array<Day | null> = [
      ...Array.from({ length: pad }, () => null),
      ...days,
    ];
    while (padded.length % 7 !== 0) padded.push(null);
    const cols: Array<Array<Day | null>> = [];
    for (let w = 0; w < padded.length / 7; w++) {
      cols.push(padded.slice(w * 7, w * 7 + 7));
    }
    return cols;
  }, [days]);

  const CELL = 12;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-mono font-medium text-foreground">
            {loaded ? total : "—"}
          </span>{" "}
          contributions · last year
        </p>
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span>Less</span>
          {LEVEL_CLS.map((c, i) => (
            <span
              key={i}
              className={cn("inline-block size-2.5 shrink-0 rounded-[2px]", c)}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div
            className="relative mb-1 ml-5 h-3.5 text-[9px] text-muted-foreground"
            style={{ width: weeks * (CELL + 3) }}
          >
            {monthMarks.map((m) => (
              <span
                key={`${m.label}-${m.week}`}
                className="absolute top-0 whitespace-nowrap"
                style={{ left: m.week * (CELL + 3) }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex items-start gap-1">
            <div
              className="flex w-4 shrink-0 flex-col justify-between text-[8px] leading-none text-muted-foreground"
              style={{ height: 7 * (CELL + 3) - 3 }}
            >
              <span className="invisible">S</span>
              <span>M</span>
              <span className="invisible">T</span>
              <span>W</span>
              <span className="invisible">T</span>
              <span>F</span>
              <span className="invisible">S</span>
            </div>

            {/* Weeks as columns — always renders full boxes */}
            <div className="flex gap-[3px]">
              {weekColumns.map((col, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {col.map((d, di) => {
                    if (!d) {
                      return (
                        <div
                          key={`pad-${wi}-${di}`}
                          className="shrink-0 rounded-[2px] bg-transparent"
                          style={{ width: CELL, height: CELL }}
                        />
                      );
                    }
                    const on = selected?.date === d.date;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        title={`${d.date}: ${d.count} action${d.count === 1 ? "" : "s"}`}
                        onClick={() =>
                          setSelected((s) =>
                            s?.date === d.date ? null : d
                          )
                        }
                        className={cn(
                          "block shrink-0 rounded-[2px] p-0 transition-transform hover:scale-110 hover:ring-1 hover:ring-foreground/40",
                          LEVEL_CLS[level(d.count)],
                          on && "ring-2 ring-foreground ring-offset-1 ring-offset-background"
                        )}
                        style={{ width: CELL, height: CELL, minWidth: CELL, minHeight: CELL }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <p className="mt-2 rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
          <span className="text-foreground">{selected.date}</span>
          {" · "}
          {selected.count} action{selected.count === 1 ? "" : "s"}
          {selected.count === 0
            ? " — quiet day (box still counts as a day)"
            : " — emails, apps, tasks, events"}
        </p>
      )}
    </div>
  );
}
