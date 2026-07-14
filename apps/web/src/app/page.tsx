"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Hand,
  Loader2,
  Mail,
  Radar,
  Search,
  Shield,
  Briefcase,
} from "lucide-react";
import { classifyApplySurface } from "@vexa/shared";
import { Button } from "@/components/ui/button";
import { LiveLogsWidget } from "@/components/LiveLogsWidget";
import { useSearchDialog } from "@/components/SearchProvider";
import { cn } from "@/lib/utils";

/* ───────────────────────── types ───────────────────────── */

type JobLite = {
  id?: string;
  company?: string;
  title?: string;
  externalUrl?: string;
};

type JobRow = {
  id: string;
  company?: string;
  title?: string;
  externalUrl?: string;
  source?: string;
  scrapedAt?: string;
  postedAt?: string;
  location?: { raw?: string; remote?: boolean };
};

type AppRow = {
  id: string;
  status: string;
  shortlistProbability?: number;
  matchScore?: number;
  coverLetter?: string;
  createdAt?: string;
  submittedAt?: string;
  latestOutcome?: string | null;
  job?: JobLite;
  shortlistFactors?: Array<{
    factor: string;
    score: number;
    impact?: number;
    note?: string;
  }>;
};

type WeeklyStats = {
  totalApplications: number;
  submitted: number;
  ready: number;
  needsReview: number;
  jobsTracked: number;
  coldEmails: {
    followUpsDue: number;
    followUpsPending: number;
    total: number;
  };
  replies: number;
  responseRateOverall: number;
  updatedAt: string;
};

type LlmStatus = {
  displayState?: string;
  displayModel?: string;
  primary?: string;
  configured?: boolean;
  circuit?: { open?: boolean };
};

type ColdEmail = {
  id: string;
  to: string;
  toName?: string;
  toRole?: string;
  company: string;
  jobTitle?: string;
  jobUrl?: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
};

type DecisionKind = "high" | "review" | "flagged";

type Decision = {
  id: string;
  kind: DecisionKind;
  tier: 1 | 2 | 3;
  company: string;
  title: string;
  reason: string;
  cta: string;
  href: string;
};

/* ───────────────────────── helpers ───────────────────────── */

function shortModel(m?: string) {
  if (!m) return "—";
  return (m.split("/").pop() || m).replace(/:free$/i, "").slice(0, 28);
}

function tierFor(url: string | undefined, p: number): 1 | 2 | 3 {
  const s = classifyApplySurface(url || "");
  if (s === "linkedin" || s === "indeed") return 3;
  if (p >= 0.85) return 1;
  return 2;
}

function bestNote(a: AppRow): string {
  const withNote = a.shortlistFactors?.find((f) => f.note)?.note;
  if (withNote) return withNote;
  if (a.coverLetter) {
    const clip = a.coverLetter.replace(/\s+/g, " ").trim().slice(0, 90);
    return clip + (a.coverLetter.length > 90 ? "…" : "");
  }
  return "";
}

function buildDecisions(apps: AppRow[]): Decision[] {
  const out: Decision[] = [];
  for (const a of apps) {
    if (a.status === "submitted" || a.status === "failed") continue;
    const p = a.shortlistProbability ?? 0;
    const company = a.job?.company || "Company";
    const title = a.job?.title || "Role";
    const tier = tierFor(a.job?.externalUrl, p);
    const factorNote = bestNote(a);

    if (a.status === "requires_review" && (a.matchScore ?? 100) < 50) {
      out.push({
        id: a.id,
        kind: "flagged",
        tier,
        company,
        title,
        reason:
          factorNote ||
          `Match ${a.matchScore ?? "—"} — fix before send.`,
        cta: "Fix & review",
        href: "/inbox",
      });
      continue;
    }

    if (a.status === "ready" && p >= 0.85 && tier === 1) {
      out.push({
        id: a.id,
        kind: "high",
        tier: 1,
        company,
        title,
        reason: factorNote || "Strong fit on direct ATS — confirm prefill.",
        cta: "Confirm send",
        href: "/inbox",
      });
      continue;
    }

    if (
      a.status === "requires_review" ||
      a.status === "ready" ||
      tier === 3
    ) {
      out.push({
        id: a.id,
        kind: "review",
        tier,
        company,
        title,
        reason:
          factorNote ||
          (tier === 3
            ? "LinkedIn / social — draft only."
            : "Review draft before package."),
        cta: "Review draft",
        href: "/inbox",
      });
    }
  }
  const order = { flagged: 0, high: 1, review: 2 };
  return out.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 10);
}

/** Roles found by day (scraper intake) */
function buildRolesSeries(jobs: JobRow[]) {
  const days: Array<{ key: string; label: string; count: number }> = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString([], { weekday: "short" }),
      count: 0,
    });
  }
  const map = new Map(days.map((d) => [d.key, d]));
  for (const j of jobs) {
    const raw = j.scrapedAt || j.postedAt;
    if (!raw) {
      // undated → count on latest day so graph isn’t empty
      days[days.length - 1].count += 1;
      continue;
    }
    const k = raw.slice(0, 10);
    const row = map.get(k);
    if (row) row.count += 1;
    else days[days.length - 1].count += 1;
  }
  return days;
}

/** Top companies by scraped role count */
function topCompanies(jobs: JobRow[], n = 6) {
  const c = new Map<string, number>();
  for (const j of jobs) {
    const name = (j.company || "Unknown").replace(/\s+hiring.*$/i, "").trim();
    c.set(name, (c.get(name) || 0) + 1);
  }
  return [...c.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }));
}

function applyPieSlices(apps: AppRow[]) {
  const submitted = apps.filter((a) => a.status === "submitted").length;
  const ready = apps.filter((a) => a.status === "ready").length;
  const review = apps.filter((a) => a.status === "requires_review").length;
  const failed = apps.filter((a) => a.status === "failed").length;
  const other = Math.max(
    0,
    apps.length - submitted - ready - review - failed
  );
  return [
    { key: "sent", label: "Sent", value: submitted, color: "hsl(142 60% 36%)" },
    { key: "ready", label: "Ready", value: ready, color: "hsl(0 0% 20%)" },
    {
      key: "review",
      label: "In review",
      value: review,
      color: "hsl(32 95% 44%)",
    },
    {
      key: "failed",
      label: "Failed",
      value: failed,
      color: "hsl(0 72% 51%)",
    },
    {
      key: "other",
      label: "Other",
      value: other,
      color: "hsl(0 0% 70%)",
    },
  ].filter((s) => s.value > 0);
}

function surfacePieSlices(apps: AppRow[]) {
  const counts = { direct_ats: 0, linkedin: 0, indeed: 0, other: 0 };
  for (const a of apps) {
    const s = classifyApplySurface(a.job?.externalUrl || "");
    if (s === "direct_ats") counts.direct_ats += 1;
    else if (s === "linkedin") counts.linkedin += 1;
    else if (s === "indeed") counts.indeed += 1;
    else counts.other += 1;
  }
  return [
    {
      key: "ats",
      label: "Direct ATS",
      value: counts.direct_ats,
      color: "hsl(142 50% 40%)",
    },
    {
      key: "li",
      label: "LinkedIn",
      value: counts.linkedin,
      color: "hsl(210 90% 45%)",
    },
    {
      key: "ind",
      label: "Indeed",
      value: counts.indeed,
      color: "hsl(220 80% 55%)",
    },
    {
      key: "oth",
      label: "Other",
      value: counts.other,
      color: "hsl(0 0% 55%)",
    },
  ].filter((s) => s.value > 0);
}

function sourceLabel(s?: string) {
  if (!s) return "web";
  if (s === "firecrawl") return "scrape";
  if (s === "exa") return "semantic";
  if (s === "greenhouse" || s === "lever") return "board";
  return s;
}

function timeAgo(iso?: string) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m`;
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)}h`;
  return `${Math.floor(ms / 86400_000)}d`;
}

/* ───────────────────────── page ───────────────────────── */

export default function DashboardPage() {
  const { openSearch } = useSearchDialog();
  const [apps, setApps] = useState<AppRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [cold, setCold] = useState<ColdEmail[]>([]);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [llm, setLlm] = useState<LlmStatus | null>(null);
  const [name, setName] = useState("there");
  const [loading, setLoading] = useState(true);
  const [pieMode, setPieMode] = useState<"status" | "surface">("status");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [aRes, jRes, cRes, sRes, pRes, lRes] = await Promise.all([
          fetch("/api/applications"),
          fetch("/api/jobs"),
          fetch("/api/cold-email"),
          fetch("/api/stats/weekly"),
          fetch("/api/profile"),
          fetch("/api/health/llm?status=1"),
        ]);
        const [a, j, c, s, p, l] = await Promise.all([
          aRes.json(),
          jRes.json(),
          cRes.json(),
          sRes.json(),
          pRes.json(),
          lRes.json(),
        ]);
        if (cancelled) return;
        setApps(a.applications || []);
        setJobs(j.jobs || []);
        setCold(c.drafts || []);
        setStats(s.stats || null);
        setLlm(l);
        setName(p.profile?.fullName?.split(" ")[0] || "there");
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const id = setInterval(load, 12000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const decisions = useMemo(() => buildDecisions(apps), [apps]);
  const rolesSeries = useMemo(() => buildRolesSeries(jobs), [jobs]);
  const companies = useMemo(() => topCompanies(jobs, 6), [jobs]);
  const statusPie = useMemo(() => applyPieSlices(apps), [apps]);
  const surfacePie = useMemo(() => surfacePieSlices(apps), [apps]);
  const pie = pieMode === "status" ? statusPie : surfacePie;

  const needYou = decisions.length;
  const modelHealthy =
    llm?.configured &&
    llm.displayState !== "no_key" &&
    !llm.circuit?.open;

  const recentJobs = useMemo(() => {
    return [...jobs]
      .sort((a, b) => {
        const ta = new Date(a.scrapedAt || a.postedAt || 0).getTime();
        const tb = new Date(b.scrapedAt || b.postedAt || 0).getTime();
        return tb - ta;
      })
      .slice(0, 8);
  }, [jobs]);

  const recentMail = useMemo(() => {
    return [...cold]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 8);
  }, [cold]);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Command center
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">
            Hey {name}
          </h1>
        </div>
        <div className="flex w-full items-center gap-1.5 rounded-full bg-muted/60 p-1 sm:w-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 flex-1 rounded-full px-3 sm:flex-none"
            onClick={() => openSearch()}
          >
            <Search className="size-3.5" />
            Find jobs
          </Button>
          <Button
            size="sm"
            className="h-8 flex-1 rounded-full px-3 sm:flex-none"
            asChild
          >
            <Link href="/inbox">Open inbox</Link>
          </Button>
        </div>
      </div>

      {/* Continuous live log stream */}
      <LiveLogsWidget />

      {/* Status strip */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 rounded-xl border border-border/80 bg-card px-3 py-2 font-mono text-[11px] shadow-sm sm:gap-y-2 sm:px-4 sm:py-2.5 sm:text-[12px]">
        <span className="inline-flex items-center gap-2 pr-2 font-sans text-[13px] font-medium">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              modelHealthy
                ? "bg-success shadow-[0_0_0_3px_hsl(var(--success)/0.2)]"
                : "bg-amber-500"
            )}
          />
          <span className="text-muted-foreground">model:</span>
          <span className={modelHealthy ? "text-success" : "text-amber-600"}>
            {modelHealthy ? "healthy" : llm?.displayState || "…"}
          </span>
          {llm?.displayModel && (
            <span className="hidden text-muted-foreground sm:inline">
              · {shortModel(llm.displayModel || llm.primary)}
            </span>
          )}
        </span>
        <span className="mx-1 hidden h-3.5 w-px bg-border sm:block" />
        <span className="px-1.5 text-muted-foreground">
          <span className="font-medium text-foreground">{jobs.length}</span> roles
          found
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="px-1.5 text-muted-foreground">
          <span className="font-medium text-foreground">{apps.length}</span> packages
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="px-1.5 text-muted-foreground">
          <span className="font-medium text-foreground">{needYou}</span> need you
        </span>
        <span className="text-muted-foreground/50">·</span>
        <span className="px-1.5 text-muted-foreground">
          <span className="font-medium text-foreground">{cold.length}</span> recruiter
          mails
        </span>
        {loading && (
          <Loader2 className="ml-auto size-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* ═══ TOP: roles graph | pie | decisions ═══ */}
      <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
        {/* Roles scraped live graph — height = content only */}
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm xl:col-span-4">
          <PanelHead
            title="Roles found"
            hint="scraper · 7d"
            icon={<Radar className="size-3.5" />}
            trailing={
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {jobs.length}
              </span>
            }
          />
          <div className="space-y-2.5 p-3">
            <RolesBarChart series={rolesSeries} />
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Top companies
              </p>
              <ul className="space-y-1">
                {companies.length === 0 && (
                  <li className="text-[12px] text-muted-foreground">
                    No roles yet — run Automate → Find jobs.
                  </li>
                )}
                {companies.slice(0, 5).map((c) => {
                  const max = companies[0]?.count || 1;
                  const pct = Math.round((c.count / max) * 100);
                  return (
                    <li key={c.name} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="truncate font-medium">{c.name}</span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                          {c.count}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/70 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        {/* Applied pie — compact, no forced min height */}
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm xl:col-span-4">
          <PanelHead
            title="Where we applied"
            hint="packages"
            icon={<Briefcase className="size-3.5" />}
            trailing={
              <div className="flex rounded-full bg-muted p-0.5 text-[10px] font-medium">
                <button
                  type="button"
                  onClick={() => setPieMode("status")}
                  className={cn(
                    "rounded-full px-2 py-0.5 transition-colors",
                    pieMode === "status"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  Status
                </button>
                <button
                  type="button"
                  onClick={() => setPieMode("surface")}
                  className={cn(
                    "rounded-full px-2 py-0.5 transition-colors",
                    pieMode === "surface"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  Surface
                </button>
              </div>
            }
          />
          <div className="flex flex-col gap-2.5 p-3">
            <div className="flex items-center gap-3">
              <PieChart
                slices={pie}
                centerLabel={String(apps.length)}
                centerSub="total"
              />
              <ul className="min-w-0 flex-1 space-y-1">
                {pie.map((s) => (
                  <li
                    key={s.key}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: s.color }}
                    />
                    <span className="truncate text-muted-foreground">
                      {s.label}
                    </span>
                    <span className="ml-auto font-mono tabular-nums font-medium">
                      {s.value}
                    </span>
                  </li>
                ))}
                {pie.length === 0 && (
                  <li className="text-[12px] text-muted-foreground">
                    No packages yet
                  </li>
                )}
              </ul>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-2 text-center">
              <MiniMetric
                label="Sent"
                value={String(stats?.submitted ?? 0)}
              />
              <MiniMetric
                label="Reply %"
                value={
                  stats?.responseRateOverall != null
                    ? `${stats.responseRateOverall}%`
                    : "—"
                }
              />
              <MiniMetric
                label="Ready"
                value={String(stats?.ready ?? 0)}
              />
            </div>
          </div>
        </section>

        {/* Needs your decision — list height only, cap scroll */}
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm xl:col-span-4">
          <PanelHead
            title="Needs your decision"
            hint={`${decisions.length}`}
            icon={<Hand className="size-3.5" />}
            trailing={
              decisions.length > 0 ? (
                <Link
                  href="/inbox"
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Open all →
                </Link>
              ) : null
            }
          />
          {decisions.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-medium">Inbox is clear</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Decisions land here after drafts are prepared.
              </p>
            </div>
          ) : (
            <ul className="max-h-[280px] divide-y divide-border/50 overflow-y-auto">
              {decisions.map((d) => (
                <li
                  key={d.id}
                  className={cn(
                    "border-l-[3px] px-3 py-2",
                    d.kind === "high" && "border-l-success",
                    d.kind === "review" && "border-l-amber-500",
                    d.kind === "flagged" && "border-l-destructive"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1">
                    <KindLabel kind={d.kind} />
                    <TierChip tier={d.tier} />
                  </div>
                  <p className="mt-0.5 truncate text-[12px] font-semibold tracking-tight">
                    {d.company}
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      — {d.title}
                    </span>
                  </p>
                  <Button
                    size="sm"
                    variant={d.kind === "high" ? "default" : "outline"}
                    className="mt-1.5 h-7 w-full rounded-full text-[11px]"
                    asChild
                  >
                    <Link href={d.href}>
                      {d.cta}
                      <ArrowRight className="size-3 opacity-70" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ═══ BOTTOM: jobs feed | recruiter mail ═══ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <PanelHead
            title="Jobs found"
            hint="live feed"
            icon={<Briefcase className="size-3.5" />}
            trailing={
              <Link
                href="/jobs"
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                All jobs →
              </Link>
            }
          />
          <ul className="max-h-[320px] divide-y divide-border/40 overflow-y-auto">
            {recentJobs.length === 0 && (
              <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                No roles scraped yet.{" "}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => openSearch()}
                >
                  Run a search
                </button>
              </li>
            )}
            {recentJobs.map((j) => (
              <li
                key={j.id}
                className="flex items-start gap-2.5 px-3 py-2 transition-colors hover:bg-muted/30"
              >
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Briefcase className="size-3 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold tracking-tight">
                    {j.title || "Role"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {j.company || "Company"}
                    {j.location?.remote
                      ? " · Remote"
                      : j.location?.raw
                        ? ` · ${j.location.raw}`
                        : ""}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {sourceLabel(j.source)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {timeAgo(j.scrapedAt || j.postedAt)}
                    </span>
                  </div>
                </div>
                {j.externalUrl && (
                  <a
                    href={j.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Open
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <PanelHead
            title="Recruiter mail"
            hint="outreach"
            icon={<Mail className="size-3.5" />}
            trailing={
              <Link
                href="/outreach"
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Outreach →
              </Link>
            }
          />
          <ul className="max-h-[320px] divide-y divide-border/40 overflow-y-auto">
            {recentMail.length === 0 && (
              <li className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                No recruiter emails yet. Open Outreach to draft.
              </li>
            )}
            {recentMail.map((m) => (
              <li
                key={m.id}
                className="flex items-start gap-2.5 px-3 py-2 transition-colors hover:bg-muted/30"
              >
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Mail className="size-3 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-[12px] font-semibold tracking-tight">
                      {m.company}
                    </p>
                    <MailStatus status={m.status} />
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {m.to}
                    {m.toRole ? ` · ${m.toRole}` : ""}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-foreground/80">
                    {m.subject}
                  </p>
                </div>
                <Link
                  href="/outreach"
                  className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="flex items-start gap-2 px-0.5 text-[12px] text-muted-foreground">
        <Shield className="mt-0.5 size-3.5 shrink-0 opacity-70" />
        Live data from your scraper, packages, and outreach vault. Prefill only
        — you confirm every submit and email send.
      </p>
    </div>
  );
}

/* ───────────────────────── charts ───────────────────────── */

function RolesBarChart({
  series,
}: {
  series: Array<{ key: string; label: string; count: number }>;
}) {
  const W = 320;
  const H = 88;
  const padL = 6;
  const padR = 6;
  const padT = 12;
  const padB = 18;
  const max = Math.max(1, ...series.map((d) => d.count));
  const n = series.length;
  const slot = (W - padL - padR) / n;
  const barW = Math.max(6, slot * 0.5);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-[72px] w-full"
      role="img"
      aria-label="Roles found last 7 days"
    >
      {[0, 0.5, 1].map((t) => {
        const y = padT + (1 - t) * (H - padT - padB);
        return (
          <line
            key={t}
            x1={padL}
            x2={W - padR}
            y1={y}
            y2={y}
            className="stroke-border"
            strokeWidth={1}
            strokeDasharray={t === 0 ? undefined : "3 3"}
          />
        );
      })}
      {series.map((d, i) => {
        const h = Math.max(d.count > 0 ? 3 : 0, ((H - padT - padB) * d.count) / max);
        const x = padL + i * slot + (slot - barW) / 2;
        return (
          <g key={d.key}>
            <rect
              x={x}
              y={H - padB - h}
              width={barW}
              height={h}
              rx={3}
              className="fill-foreground/80"
            />
            <text
              x={padL + i * slot + slot / 2}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 9, fontFamily: "ui-monospace, monospace" }}
            >
              {d.label}
            </text>
            {d.count > 0 && (
              <text
                x={padL + i * slot + slot / 2}
                y={H - padB - h - 4}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 8, fontFamily: "ui-monospace, monospace" }}
              >
                {d.count}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({
  slices,
  centerLabel,
  centerSub,
}: {
  slices: Array<{ key: string; label: string; value: number; color: string }>;
  centerLabel: string;
  centerSub: string;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const R = 36;
  const CX = 48;
  const CY = 48;
  const stroke = 14;
  let offset = 0;
  const C = 2 * Math.PI * R;

  if (slices.length === 0) {
    return (
      <svg viewBox="0 0 96 96" className="size-[88px] shrink-0">
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
        />
        <text
          x={CX}
          y={CY + 1}
          textAnchor="middle"
          className="fill-foreground"
          style={{
            fontSize: 16,
            fontWeight: 600,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          0
        </text>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 96 96"
      className="size-[88px] shrink-0"
      role="img"
      aria-label="Apply breakdown"
    >
      <g transform={`rotate(-90 ${CX} ${CY})`}>
        {slices.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={s.key}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </g>
      <circle
        cx={CX}
        cy={CY}
        r={R - stroke / 2 - 1}
        className="fill-card"
      />
      <text
        x={CX}
        y={CY + 1}
        textAnchor="middle"
        className="fill-foreground"
        style={{
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {centerLabel}
      </text>
      <text
        x={CX}
        y={CY + 14}
        textAnchor="middle"
        className="fill-muted-foreground"
        style={{ fontSize: 8 }}
      >
        {centerSub}
      </text>
    </svg>
  );
}

/* ───────────────────────── ui bits ───────────────────────── */

function PanelHead({
  title,
  hint,
  icon,
  trailing,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h2>
        {hint && (
          <span className="hidden font-mono text-[10px] text-muted-foreground/70 sm:inline">
            · {hint}
          </span>
        )}
      </div>
      {trailing}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MailStatus({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        status === "draft" && "bg-muted text-muted-foreground",
        status === "sent" && "bg-success/15 text-success",
        status === "copied" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        status === "failed" && "bg-destructive/15 text-destructive"
      )}
    >
      {status}
    </span>
  );
}

function KindLabel({ kind }: { kind: DecisionKind }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide",
        kind === "high" && "bg-success/15 text-success",
        kind === "review" &&
          "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        kind === "flagged" && "bg-destructive/15 text-destructive"
      )}
    >
      {kind === "high" && <CheckCircle2 className="size-3" />}
      {kind === "review" && <Hand className="size-3" />}
      {kind === "flagged" && <AlertTriangle className="size-3" />}
      {kind === "high" ? "HIGH" : kind === "review" ? "REVIEW" : "FLAGGED"}
    </span>
  );
}

function TierChip({ tier }: { tier: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Shield className="size-2.5" />
      tier {tier}
    </span>
  );
}
