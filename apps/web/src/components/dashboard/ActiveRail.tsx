"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Briefcase,
  Calendar,
  Check,
  Loader2,
  Plus,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  title: string;
  kind: string;
  companyName?: string;
  dueAt?: string;
  done: boolean;
};

type App = {
  id: string;
  jobTitle: string;
  companyName: string;
  stage: string;
};

type Ev = {
  id: string;
  title: string;
  datetime?: string;
  type: string;
};

const KIND_ICON: Record<string, typeof Briefcase> = {
  job: Briefcase,
  conference: Calendar,
  interview: Calendar,
  personal: User,
  company: Briefcase,
};

export function ActiveRail({ className }: { className?: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("personal");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
      setApps(data.applications || []);
      setEvents(data.events || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTask() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), kind }),
      });
      setTitle("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function done(id: string) {
    await fetch("/api/crm/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, done: true, title: "done" }),
    });
    await load();
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col rounded-2xl border bg-card/80 shadow-sm",
        className
      )}
    >
      <div className="border-b px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Active work
        </p>
        <p className="text-xs text-muted-foreground">
          Jobs · events · personal tasks
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {loading ? (
          <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <section>
              <p className="mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                Pipeline
              </p>
              <ul className="space-y-1.5">
                {apps.slice(0, 6).map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border px-2 py-1.5 text-[11px]"
                  >
                    <p className="font-medium leading-snug">{a.jobTitle}</p>
                    <p className="text-muted-foreground">
                      {a.companyName} ·{" "}
                      <span className="uppercase">{a.stage}</span>
                    </p>
                  </li>
                ))}
                {!apps.length && (
                  <li className="text-[11px] text-muted-foreground">
                    No active applications
                  </li>
                )}
              </ul>
            </section>

            <section>
              <p className="mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                Upcoming
              </p>
              <ul className="space-y-1.5">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className="flex gap-2 rounded-lg border px-2 py-1.5 text-[11px]"
                  >
                    <Calendar className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-medium leading-snug">{e.title}</p>
                      <p className="text-muted-foreground">
                        {e.datetime?.slice(0, 16).replace("T", " ") || e.type}
                      </p>
                    </div>
                  </li>
                ))}
                {!events.length && (
                  <li className="text-[11px] text-muted-foreground">
                    No events yet
                  </li>
                )}
              </ul>
            </section>

            <section>
              <p className="mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground">
                Tasks
              </p>
              <ul className="space-y-1.5">
                {tasks.map((t) => {
                  const Icon = KIND_ICON[t.kind] || User;
                  return (
                    <li
                      key={t.id}
                      className="flex items-start gap-2 rounded-lg border px-2 py-1.5 text-[11px]"
                    >
                      <Icon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{t.title}</p>
                        <Badge
                          variant="outline"
                          className="mt-0.5 text-[9px] capitalize"
                        >
                          {t.kind}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted"
                        onClick={() => void done(t.id)}
                        title="Done"
                      >
                        <Check className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
                {!tasks.length && (
                  <li className="text-[11px] text-muted-foreground">
                    Add a task below
                  </li>
                )}
              </ul>
            </section>
          </>
        )}
      </div>

      <div className="space-y-1.5 border-t p-2.5">
        <div className="flex flex-wrap gap-1">
          {(["personal", "job", "conference", "interview"] as const).map(
            (k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] capitalize",
                  kind === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {k}
              </button>
            )
          )}
        </div>
        <div className="flex gap-1">
          <Input
            placeholder="New task…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addTask()}
            className="h-8 text-xs"
          />
          <Button
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={busy || !title.trim()}
            onClick={() => void addTask()}
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
