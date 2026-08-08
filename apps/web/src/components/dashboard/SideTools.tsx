"use client";

import { useCallback, useEffect, useState } from "react";
import { Award, Calendar, Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Item = { id: string; title: string; due?: string; done?: boolean; kind?: string };

/**
 * Right rail — conferences, scholarships, other (personal tooling).
 */
export function SideTools({
  refreshKey = 0,
  className,
}: {
  refreshKey?: number;
  className?: string;
}) {
  const [conferences, setConferences] = useState<Item[]>([]);
  const [scholarships, setScholarships] = useState<Item[]>([]);
  const [other, setOther] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [bucket, setBucket] = useState<"conference" | "scholarship" | "personal">(
    "conference"
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/tables");
      const data = await res.json();
      setConferences(data.side?.conferences || []);
      setScholarships(data.side?.scholarships || []);
      setOther(data.side?.other || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function add() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const kind =
        bucket === "scholarship"
          ? "personal"
          : bucket === "conference"
            ? "conference"
            : "personal";
      const title =
        bucket === "scholarship" && !/scholar/i.test(draft)
          ? `Scholarship: ${draft}`
          : draft;
      await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, kind }),
      });
      setDraft("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  function Block({
    title,
    icon: Icon,
    items,
    accent,
  }: {
    title: string;
    icon: typeof Calendar;
    items: Item[];
    accent: string;
  }) {
    return (
      <div className="rounded-xl border bg-card shadow-sm">
        <div
          className={cn(
            "flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold",
            accent
          )}
        >
          <Icon className="size-3.5" />
          {title}
          <span className="ml-auto font-mono text-[10px] opacity-70">
            {items.length}
          </span>
        </div>
        <ul className="max-h-36 space-y-1 overflow-y-auto p-2">
          {items.length === 0 && (
            <li className="px-1 py-2 text-[11px] text-muted-foreground">
              Empty — add below
            </li>
          )}
          {items.map((it) => (
            <li
              key={it.id}
              className={cn(
                "rounded-md border px-2 py-1.5 text-[11px]",
                it.done && "opacity-50 line-through"
              )}
            >
              <p className="font-medium leading-snug">{it.title}</p>
              {it.due && (
                <p className="text-[10px] text-muted-foreground">{it.due}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <aside className={cn("flex flex-col gap-3", className)}>
      <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Your toolkit
      </p>
      {loading ? (
        <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Block
            title="Conferences"
            icon={Calendar}
            items={conferences}
            accent="text-violet-700 dark:text-violet-300"
          />
          <Block
            title="Scholarships"
            icon={Award}
            items={scholarships}
            accent="text-amber-700 dark:text-amber-300"
          />
          <Block
            title="Other"
            icon={Sparkles}
            items={other}
            accent="text-sky-700 dark:text-sky-300"
          />
        </>
      )}

      <div className="space-y-1.5 rounded-xl border p-2">
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["conference", "Conf"],
              ["scholarship", "Scholar"],
              ["personal", "Other"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setBucket(k)}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px]",
                bucket === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            className="h-8 text-xs"
            placeholder="Add item…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void add()}
          />
          <Button
            size="icon"
            className="h-8 w-8"
            disabled={busy || !draft.trim()}
            onClick={() => void add()}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </aside>
  );
}
