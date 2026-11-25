"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, Plus, Sparkles, Table2, TrendingUp } from "lucide-react";
import { PIPELINE_STAGES } from "@vexa/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { appendLog } from "@/lib/activity-bus";
import { QUANT_FIRMS, QUANT_GROUPS, type QuantFirm } from "@/lib/quant-firms";

type AppRow = {
  id: string;
  company: string;
  role: string;
  stage: string;
  source: string;
  status: string;
  last_touch: string;
  updated_at?: string;
};

type JobRow = {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  updated_at?: string;
};

type SideItem = { id: string; title: string; due?: string; done?: boolean };

const STAGE_LABELS: Record<string, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  screen: "Screen",
  technical: "Technical",
  onsite: "Onsite",
  offer: "Offer",
  accepted: "Accepted",
  ghosted: "Ghosted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function formatRelative(iso?: string) {
  if (!iso) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Notion-style workspace tables — jobs detailed left, small life tables right.
 */
export default function WorkspacePage() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [companies, setCompanies] = useState<
    Array<{ id: string; name: string; domain: string; applied: string; apps: number; updated_at?: string }>
  >([]);
  const [conferences, setConferences] = useState<SideItem[]>([]);
  const [scholarships, setScholarships] = useState<SideItem[]>([]);
  const [hackathons, setHackathons] = useState<SideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"applications" | "jobs" | "companies" | "quant">(
    "applications"
  );
  const [quantGroup, setQuantGroup] = useState<string>("all");
  const [trackingFirmId, setTrackingFirmId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [bucket, setBucket] = useState<
    "conference" | "scholarship" | "hackathon"
  >("conference");
  const [busy, setBusy] = useState(false);
  const [draggedRow, setDraggedRow] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/crm/tables");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.tables) {
        throw new Error(data.error || "Workspace data could not be loaded");
      }
      setApps(data.tables?.applications?.rows || []);
      setJobs(data.tables?.jobs?.rows || []);
      setCompanies(data.tables?.companies?.rows || []);
      setConferences(data.side?.conferences || []);
      setScholarships(data.side?.scholarships || []);
      setHackathons(data.side?.hackathons || []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Workspace data could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function reorder(table: "applications" | "jobs" | "companies", targetId: string) {
    if (!draggedRow || draggedRow === targetId) return;
    const source = table === "applications" ? apps : table === "jobs" ? jobs : companies;
    const from = source.findIndex((row) => row.id === draggedRow);
    const to = source.findIndex((row) => row.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...source];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    if (table === "applications") setApps(next as AppRow[]);
    if (table === "jobs") setJobs(next as JobRow[]);
    if (table === "companies") setCompanies(next as typeof companies);
    setDraggedRow(null);
    try {
      await fetch("/api/crm/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, orderedIds: next.map((row) => row.id) }),
      });
    } catch {
      await load();
    }
  }

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

  const filteredQuantFirms = useMemo(() => {
    let list = QUANT_FIRMS;
    if (quantGroup !== "all") {
      list = list.filter((f) => f.group === quantGroup);
    }
    if (!q) return list;
    return list.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.strategies.toLowerCase().includes(q) ||
        f.techSkills.toLowerCase().includes(q) ||
        f.location.toLowerCase().includes(q) ||
        f.domain.toLowerCase().includes(q) ||
        f.groupTitle.toLowerCase().includes(q)
    );
  }, [quantGroup, q]);

  const trackedWishlistNames = useMemo(() => {
    const s = new Set<string>();
    for (const a of apps) {
      s.add(a.company.toLowerCase().trim());
    }
    return s;
  }, [apps]);

  const trackedCompanyNames = useMemo(() => {
    const s = new Set<string>();
    for (const c of companies) {
      s.add(c.name.toLowerCase().trim());
      if (c.domain) s.add(c.domain.toLowerCase().trim());
    }
    return s;
  }, [companies]);

  async function addQuantToWishlist(firm: QuantFirm) {
    setTrackingFirmId(`${firm.id}-wish`);
    try {
      const res = await fetch("/api/crm/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "applications",
          data: {
            company: firm.name,
            role: "Quant Researcher / Software Engineer",
            stage: "wishlist",
            source: "100 Quant Directory 2026",
            notes: `${firm.groupTitle} | Strategies: ${firm.strategies} | Skills: ${firm.techSkills} | HQ: ${firm.location}`,
          },
        }),
      });
      if (res.ok) {
        appendLog({
          kind: "workspace",
          message: `Added ${firm.name} to Wishlist`,
          status: "done",
        });
        await load(true);
      }
    } finally {
      setTrackingFirmId(null);
    }
  }

  async function addQuantToCompanies(firm: QuantFirm) {
    setTrackingFirmId(`${firm.id}-co`);
    try {
      const res = await fetch("/api/crm/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "companies",
          data: {
            name: firm.name,
            domain: firm.domain,
            industry: `Quant Finance (${firm.groupTitle})`,
            careerPageUrl: `https://${firm.domain}`,
            notes: `Strategies: ${firm.strategies} | Skills: ${firm.techSkills} | Location: ${firm.location}`,
          },
        }),
      });
      if (res.ok) {
        appendLog({
          kind: "workspace",
          message: `Added ${firm.name} to Companies`,
          status: "done",
        });
        await load(true);
      }
    } finally {
      setTrackingFirmId(null);
    }
  }

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
    <div className="space-y-4 pt-1 sm:pt-2">
      {loadError && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>{apps.length || jobs.length || companies.length ? `Refresh paused: ${loadError}` : loadError}</span>
          <button type="button" className="font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        {/* Left — detailed job tables */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["applications", "Applications"],
                ["jobs", "Job posts"],
                ["companies", "Companies"],
                ["quant", "100 Quant Firms 2026"],
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
                {id === "quant" ? <TrendingUp className="size-3.5 text-amber-400" /> : <Table2 className="size-3.5" />}
                {label}
                {id === "quant" && (
                  <span className="ml-0.5 rounded bg-amber-500/20 px-1.5 py-0.2 font-mono text-[10px] text-amber-500 font-semibold">
                    100
                  </span>
                )}
              </button>
            ))}
            <Input
              placeholder={tab === "quant" ? "Filter quants, C++, Python, HFT, NYC…" : "Filter…"}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="ml-auto h-8 max-w-[240px] text-xs"
            />
          </div>

          {tab === "quant" && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/20 p-1.5">
                {Object.entries(QUANT_GROUPS).map(([k, group]) => {
                  const count =
                    k === "all"
                      ? QUANT_FIRMS.length
                      : QUANT_FIRMS.filter((f) => f.group === k).length;
                  const isActive = quantGroup === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setQuantGroup(k)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition",
                        isActive
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span>{group.label}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                          isActive
                            ? "bg-background/20 text-background"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-amber-400 shrink-0" />
                  <span>
                    <strong className="text-foreground">
                      {QUANT_GROUPS[quantGroup]?.label || "Quant"}:
                    </strong>{" "}
                    {QUANT_GROUPS[quantGroup]?.desc || "Quantitative finance firms directory"}
                  </span>
                </div>
                <span className="font-mono text-[11px] shrink-0 text-muted-foreground">
                  Showing {filteredQuantFirms.length} of {QUANT_FIRMS.length}
                </span>
              </div>
            </div>
          )}

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
                    draggable
                    onDragStart={() => setDraggedRow(a.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => void reorder("applications", a.id)}
                    className="cursor-grab border-t border-border/50 hover:bg-muted/40 active:cursor-grabbing"
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
                        {STAGE_LABELS[a.stage] || a.stage}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {a.source}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {formatRelative(a.updated_at || a.last_touch)}
                    </td>
                    <td className="px-2 py-2.5">
                      <select
                        className="h-7 rounded border bg-background px-1 text-[10px]"
                        value={a.stage}
                        onChange={(e) =>
                          void moveStage(a.id, e.target.value)
                        }
                      >
                        {PIPELINE_STAGES.map((s) => (
                          <option key={s} value={s}>
                            {STAGE_LABELS[s] || s}
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
                    draggable
                    onDragStart={() => setDraggedRow(j.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => void reorder("jobs", j.id)}
                    className="cursor-grab border-t border-border/50 hover:bg-muted/40 active:cursor-grabbing"
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
            ) : tab === "companies" ? (
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
                      key={c.id}
                      draggable
                      onDragStart={() => setDraggedRow(c.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => void reorder("companies", c.id)}
                      className="cursor-grab border-t border-border/50 hover:bg-muted/40 active:cursor-grabbing"
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
            ) : (
              <NotionTable
                columns={[
                  "#",
                  "Firm",
                  "Group",
                  "Core Strategies & Edge",
                  "Key Skills & Tech",
                  "HQ / Location",
                  "Actions",
                ]}
                empty="No quantitative trading firms match your search"
              >
                {filteredQuantFirms.map((firm, idx) => {
                  const prevFirm = idx > 0 ? filteredQuantFirms[idx - 1] : null;
                  const isNewGroup = !prevFirm || prevFirm.group !== firm.group;
                  const isWishlisted = trackedWishlistNames.has(firm.name.toLowerCase().trim());
                  const isCompanyTracked =
                    trackedCompanyNames.has(firm.name.toLowerCase().trim()) ||
                    Boolean(firm.domain && trackedCompanyNames.has(firm.domain.toLowerCase().trim()));
                  const isAddingThis = trackingFirmId?.startsWith(firm.id);

                  return (
                    <Fragment key={firm.id}>
                      {quantGroup === "all" && isNewGroup && (
                        <tr className="bg-muted/70 border-t border-b border-border/80">
                          <td colSpan={7} className="px-3 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded border px-2 py-0.5 text-xs font-semibold",
                                    QUANT_GROUPS[firm.group]?.badgeClass
                                  )}
                                >
                                  {firm.groupTitle}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {QUANT_GROUPS[firm.group]?.desc}
                                </span>
                              </div>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {QUANT_FIRMS.filter((f) => f.group === firm.group).length} firms
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className="border-t border-border/50 hover:bg-muted/40 transition">
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          #{firm.rank}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 font-medium text-sm">
                            <span>{firm.name}</span>
                            {firm.domain && (
                              <a
                                href={`https://${firm.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                title={`Visit ${firm.domain}`}
                                className="text-muted-foreground hover:text-foreground inline-flex items-center transition"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {firm.domain}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={cn(
                              "inline-block rounded border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                              QUANT_GROUPS[firm.group]?.badgeClass || "border-border text-foreground"
                            )}
                          >
                            {QUANT_GROUPS[firm.group]?.label || firm.groupTitle}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-foreground/90 min-w-[200px] max-w-[280px]">
                          {firm.strategies}
                        </td>
                        <td className="px-3 py-2.5 min-w-[180px]">
                          <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {firm.techSkills.split(",").map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                className="rounded bg-muted/60 border border-border/50 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80"
                              >
                                {skill.trim()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {firm.location}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {isWishlisted ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10">
                                <Check className="size-3" /> Wishlist
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={Boolean(isAddingThis)}
                                onClick={() => void addQuantToWishlist(firm)}
                                className="h-6 px-2 text-[10px] gap-1 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400"
                              >
                                {isAddingThis && trackingFirmId === `${firm.id}-wish` ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Plus className="size-3" />
                                )}
                                Wishlist
                              </Button>
                            )}

                            {isCompanyTracked ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 font-medium px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10">
                                <Check className="size-3" /> Tracked
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={Boolean(isAddingThis)}
                                onClick={() => void addQuantToCompanies(firm)}
                                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                              >
                                {isAddingThis && trackingFirmId === `${firm.id}-co` ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Plus className="size-3" />
                                )}
                                Co
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
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
