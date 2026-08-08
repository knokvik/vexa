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

const LEVEL_CLS = [
  "bg-muted",
  "bg-emerald-900/70",
  "bg-emerald-700",
  "bg-emerald-500",
  "bg-emerald-400",
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

/**
 * GitHub-style year heatmap — padded weeks, scroll months, clickable days.
 */
export function ContributionGraph({
  refreshKey = 0,
  className,
}: {
  refreshKey?: number;
  className?: string;
}) {
  const [days, setDays] = useState<Day[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Day | null>(null);

  useEffect(() => {
    void fetch("/api/crm/tables")
      .then((r) => r.json())
      .then((d) => {
        const c = (d.contribution || []) as Day[];
        setDays(c);
        setTotal(c.reduce((s, x) => s + x.count, 0));
      })
      .catch(() => null);
  }, [refreshKey]);

  const { cells, weeks, monthMarks } = useMemo(() => {
    if (!days.length) {
      return { cells: [] as Array<Day | null>, weeks: 53, monthMarks: [] as { label: string; week: number }[] };
    }
    // Align first day to Sunday (GitHub layout)
    const first = new Date(days[0].date + "T12:00:00");
    const pad = first.getDay(); // 0=Sun
    const padded: Array<Day | null> = [
      ...Array.from({ length: pad }, () => null),
      ...days,
    ];
    // Pad end to complete last week
    while (padded.length % 7 !== 0) padded.push(null);
    const w = padded.length / 7;

    // Month labels at first week of each month
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
    return { cells: padded, weeks: w, monthMarks: marks };
  }, [days]);

  const CELL = 11;
  const GAP = 2;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-mono font-medium text-foreground">{total}</span>{" "}
          contributions in the last year
        </p>
        <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
          <span className="mr-0.5">Less</span>
          {LEVEL_CLS.map((c, i) => (
            <span key={i} className={cn("size-2.5 rounded-[1px]", c)} />
          ))}
          <span className="ml-0.5">More</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="relative"
          style={{
            width: weeks * (CELL + GAP),
            minWidth: "100%",
          }}
        >
          {/* Month labels */}
          <div
            className="relative mb-1 h-3 text-[9px] text-muted-foreground"
            style={{ width: weeks * (CELL + GAP) }}
          >
            {monthMarks.map((m) => (
              <span
                key={`${m.label}-${m.week}`}
                className="absolute top-0"
                style={{ left: m.week * (CELL + GAP) }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {/* Weekday labels */}
            <div
              className="flex flex-col justify-between py-[1px] pr-1 text-[8px] text-muted-foreground"
              style={{ height: 7 * (CELL + GAP) - GAP }}
            >
              <span />
              <span>M</span>
              <span />
              <span>W</span>
              <span />
              <span>F</span>
              <span />
            </div>

            <div
              className="grid"
              style={{
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gridTemplateColumns: `repeat(${weeks}, ${CELL}px)`,
                gap: GAP,
                gridAutoFlow: "column",
              }}
            >
              {cells.map((d, i) => {
                if (!d) {
                  return (
                    <div
                      key={`pad-${i}`}
                      className="rounded-[2px] bg-transparent"
                      style={{ width: CELL, height: CELL }}
                    />
                  );
                }
                const on = selected?.date === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    title={`${d.date}: ${d.count} actions`}
                    onClick={() =>
                      setSelected((s) =>
                        s?.date === d.date ? null : d
                      )
                    }
                    className={cn(
                      "rounded-[2px] transition-transform hover:scale-110 hover:ring-1 hover:ring-foreground/30",
                      LEVEL_CLS[level(d.count)],
                      on && "ring-2 ring-foreground"
                    )}
                    style={{ width: CELL, height: CELL }}
                  />
                );
              })}
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
            ? " — quiet day"
            : " — emails, apps, tasks, events"}
        </p>
      )}
    </div>
  );
}
