"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Table2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { appendLog } from "@/lib/activity-bus";

type AppRow = {
  id: string;
  company: string;
  role: string;
  stage: string;
  source: string;
  status: string;
  last_touch: string;
};

type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
};

type SideItem = { id: string; title: string; due?: string; done?: boolean };

/**
 * Notion-style workspace tables — jobs detailed left, small life tables right.
 */
export default function WorkspacePage() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [companies, setCompanies] = useState<
    Array<{ name: string; domain: string; applied: string; apps: number }>
  >([]);
  const [conferences, setConferences] = useState<SideItem[]>([]);
  const [scholarships, setScholarships] = useState<SideItem[]>([]);
  const [hackathons, setHackathons] = useState<SideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"applications" | "jobs" | "companies">(
    "applications"
  );
  const [draft, setDraft] = useState("");
  const [bucket, setBucket] = useState<
    "conference" | "scholarship" | "hackathon"
  >("conference");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/tables");
      const data = await res.json();
      setApps(data.tables?.applications?.rows || []);
      setJobs(data.tables?.jobs?.rows || []);
      setCompanies(data.tables?.companies?.rows || []);
      setConferences(data.side?.conferences || []);
      setScholarships(data.side?.scholarships || []);
      setHackathons(data.side?.hackathons || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = filter.trim().toLowerCase();
  const filteredApps = useMemo(
    () =>
      apps.filter(
        (a) =>
          !q ||
          a.company.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.stage.includes(q)
      ),
    [apps, q]
  );
  const filteredJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          !q ||
          j.title.toLowerCase().includes(q) ||
          j.company.toLowerCase().includes(q)
      ),
    [jobs, q]
  );

  async function addSide() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      let title = draft.trim();
      let kind: string = "personal";
      if (bucket === "conference") kind = "conference";
      if (bucket === "hackathon") {
        kind = "personal";
        if (!/hack/i.test(title)) title = `Hackathon: ${title}`;
      }
      if (bucket === "scholarship") {
        kind = "personal";
        if (!/scholar/i.test(title)) title = `Scholarship: ${title}`;
      }
      await fetch("/api/crm/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, kind }),
      });
      setDraft("");
      appendLog({
        kind: "workspace",
        message: `Added ${bucket}: ${title}`,
        status: "done",
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function moveStage(id: string, stage: string) {
    await fetch("/api/crm/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, stage, force: true }),
    });
    appendLog({
      kind: "pipeline",
      message: `Stage → ${stage}`,
      status: "done",
    });
    await load();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Tables"
        description="Notion-style boards for jobs and life tracking. Dashboard stays clean — this is the data home."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Command home</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Left — detailed job tables */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["applications", "Applications"],
                ["jobs", "Job posts"],
                ["companies", "Companies"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  tab === id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Table2 className="size-3.5" />
                {label}
              </button>
            ))}
            <Input
              placeholder="Filter…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="ml-auto h-8 max-w-[200px] text-xs"
            />
          </div>

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : tab === "applications" ? (
              <NotionTable
                columns={[
                  "Company",
                  "Role",
                  "Stage",
                  "Source",
                  "Touch",
                  "",
                ]}
                empty="No applications — drop emails from Home"
              >
                {filteredApps.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-border/50 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2.5 text-sm font-medium">
                      {a.company}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">
                      {a.role}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] uppercase"
                      >
                        {a.stage}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {a.source}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {a.last_touch}
                    </td>
                    <td className="px-2 py-2.5">
                      <select
                        className="h-7 rounded border bg-background px-1 text-[10px]"
                        value={a.stage}
                        onChange={(e) =>
                          void moveStage(a.id, e.target.value)
                        }
                      >
                        {[
                          "wishlist",
                          "applied",
                          "screen",
                          "technical",
                          "onsite",
                          "offer",
                          "rejected",
                          "ghosted",
                        ].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </NotionTable>
            ) : tab === "jobs" ? (
              <NotionTable
                columns={["Title", "Company", "Location", "Salary", ""]}
                empty="No job posts yet — search from Home"
              >
                {filteredJobs.map((j) => (
                  <tr
                    key={j.id}
                    className="border-t border-border/50 hover:bg-muted/40"
                  >
                    <td className="px-3 py-2.5 text-sm font-medium">
                      {j.title}
                    </td>
                    <td className="px-3 py-2.5 text-sm">{j.company}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {j.location}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {j.salary}
                    </td>
                    <td className="px-2 py-2.5">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                        <Link href={`/jobs?focus=${j.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </NotionTable>
            ) : (
              <NotionTable
                columns={["Company", "Domain", "Applied", "Apps"]}
                empty="No companies tracked yet"
              >
                {companies
                  .filter(
                    (c) =>
                      !q ||
                      c.name.toLowerCase().includes(q) ||
                      c.domain.toLowerCase().includes(q)
                  )
                  .map((c, i) => (
                    <tr
                      key={i}
                      className="border-t border-border/50 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2.5 text-sm font-medium">
                        {c.name}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                        {c.domain}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge
                          variant={
                            c.applied === "yes" ? "default" : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {c.applied}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {c.apps}
                      </td>
                    </tr>
                  ))}
              </NotionTable>
            )}
          </div>
        </div>

        {/* Right — same table style as main (no color accents) */}
        <div className="space-y-3">
          <SideTable title="Conferences" items={conferences} />
          <SideTable title="Scholarships" items={scholarships} />
          <SideTable title="Hackathons" items={hackathons} />

          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Add row
            </div>
            <div className="space-y-2 p-3">
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["conference", "Conference"],
                    ["scholarship", "Scholarship"],
                    ["hackathon", "Hackathon"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBucket(k)}
                    className={cn(
                      "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                      bucket === k
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <Input
                  className="h-8 text-xs"
                  placeholder="Title…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void addSide()}
                />
                <Button
                  size="icon"
                  className="h-8 w-8"
                  disabled={busy || !draft.trim()}
                  onClick={() => void addSide()}
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotionTable({
  columns,
  children,
  empty,
}: {
  columns: string[];
  children: React.ReactNode;
  empty: string;
}) {
  const rows = Array.isArray(children) ? children : [children];
  const hasRows = rows.some(Boolean) && rows.flat().filter(Boolean).length > 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => (
              <th key={c || "x"} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasRows ? (
            children
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-12 text-center text-sm text-muted-foreground"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Same visual language as main job tables (no accent colors) */
function SideTable({ title, items }: { title: string; items: SideItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {items.length}
        </span>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-border/50 text-[10px] font-medium text-muted-foreground">
            <th className="px-3 py-1.5">Title</th>
            <th className="px-3 py-1.5 text-right">Due</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={2}
                className="px-3 py-6 text-center text-[11px] text-muted-foreground"
              >
                Empty
              </td>
            </tr>
          ) : (
            items.map((it) => (
              <tr
                key={it.id}
                className={cn(
                  "border-t border-border/50 text-[12px] hover:bg-muted/40",
                  it.done && "opacity-50"
                )}
              >
                <td
                  className={cn(
                    "px-3 py-2 font-medium",
                    it.done && "line-through"
                  )}
                >
                  {it.title}
                </td>
                <td className="px-3 py-2 text-right font-mono text-[10px] text-muted-foreground">
                  {it.due || "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
