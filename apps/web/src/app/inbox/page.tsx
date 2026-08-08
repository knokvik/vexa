"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApplicationDraft, JobListing } from "@vexa/shared";
import { classifyApplySurface } from "@vexa/shared";
import { PageHeader } from "@/components/page-header";
import { ScoreBar } from "@/components/score-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type FormAnswer = {
  key: string;
  label: string;
  value: string;
  category: string;
  atsScore: number;
  humanScore: number;
  overall: number;
  notes?: string;
};

type FormEval = {
  avgAts: number;
  avgHuman: number;
  avgOverall: number;
  fieldCount: number;
  readyCount: number;
  reviewCount: number;
  recommendation: string;
};

type Row = ApplicationDraft & {
  job?: JobListing;
  latestOutcome?: string | null;
  formAnswers?: FormAnswer[];
  formEval?: FormEval;
  formSurface?: string;
};

type RecChip = {
  label: string;
  tone: "go" | "review" | "caution" | "skip" | "info";
  hint?: string;
};

const OUTCOME_BTNS: Array<{ event: string; label: string }> = [
  { event: "no_response", label: "No response" },
  { event: "rejected", label: "Rejected" },
  { event: "phone_screen", label: "Phone screen" },
  { event: "onsite", label: "Onsite" },
  { event: "offer", label: "Offer" },
  { event: "withdrawn", label: "Withdrew" },
];

function statusVariant(
  status: string
): "success" | "warning" | "secondary" | "destructive" | "default" {
  if (status === "ready") return "success";
  if (status === "requires_review") return "warning";
  if (status === "submitted") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

/** System recommendation chips from scores + surface */
function systemRecommendation(row: Row): RecChip[] {
  const chips: RecChip[] = [];
  const p = row.shortlistProbability ?? 0;
  const ats = row.matchScore ?? 0;
  const surface = classifyApplySurface(row.job?.externalUrl || "");
  const status = row.status;

  if (status === "submitted") {
    chips.push({
      label: "Submitted",
      tone: "info",
      hint: "Log the outcome when you hear back",
    });
    if (row.latestOutcome) {
      chips.push({
        label: row.latestOutcome.replace(/_/g, " "),
        tone: "info",
      });
    } else {
      chips.push({ label: "Awaiting reply", tone: "info" });
    }
    return chips;
  }

  if (status === "failed") {
    chips.push({
      label: "Fix & retry",
      tone: "skip",
      hint: row.errorMessage || "Package failed",
    });
    return chips;
  }

  // Surface risk
  if (surface === "linkedin" || surface === "indeed") {
    chips.push({
      label: "Draft only · you submit",
      tone: "caution",
      hint: "Never auto-apply on this surface",
    });
  } else if (surface === "direct_ats") {
    chips.push({
      label: "Direct ATS",
      tone: "go",
      hint: "Greenhouse / Lever / company board — best prefill path",
    });
  }

  // Fit recommendation
  if (p >= 0.85 && ats >= 70 && surface === "direct_ats") {
    chips.push({
      label: "Recommend: apply now",
      tone: "go",
      hint: "Strong shortlist + ATS fit",
    });
  } else if (p >= 0.85) {
    chips.push({
      label: "Strong fit",
      tone: "go",
      hint: "High shortlist — review wording then send",
    });
  } else if (p >= 0.72) {
    chips.push({
      label: "Solid · review first",
      tone: "review",
      hint: "Good enough to package after a quick look",
    });
  } else if (p >= 0.55) {
    chips.push({
      label: "Borderline",
      tone: "caution",
      hint: "Consider cold email or tailor more",
    });
  } else {
    chips.push({
      label: "Low priority",
      tone: "skip",
      hint: "Weak match — skip or heavy rewrite",
    });
  }

  if (ats > 0 && ats < 50) {
    chips.push({
      label: "ATS weak",
      tone: "caution",
      hint: `Match score ${ats} — fix keywords before apply`,
    });
  } else if (ats >= 80) {
    chips.push({ label: `ATS ${ats}`, tone: "go" });
  }

  if (status === "requires_review") {
    chips.push({
      label: "Needs your review",
      tone: "review",
    });
  }

  return chips.slice(0, 4);
}

function RecChipView({ chip }: { chip: RecChip }) {
  return (
    <span
      title={chip.hint}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide",
        chip.tone === "go" && "bg-success/15 text-success",
        chip.tone === "review" &&
          "bg-amber-500/15 text-amber-700 dark:text-amber-400",
        chip.tone === "caution" &&
          "bg-orange-500/10 text-orange-700 dark:text-orange-400",
        chip.tone === "skip" && "bg-destructive/10 text-destructive",
        chip.tone === "info" && "bg-muted text-muted-foreground"
      )}
    >
      {chip.label}
    </span>
  );
}

export default function InboxPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/applications");
    const data = await res.json();
    setRows(data.applications ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const order = (r: Row) => {
      if (r.status === "ready") return 0;
      if (r.status === "requires_review") return 1;
      if (r.status === "submitted") return 3;
      return 2;
    };
    return [...rows].sort((a, b) => {
      const d = order(a) - order(b);
      if (d !== 0) return d;
      return (b.shortlistProbability ?? 0) - (a.shortlistProbability ?? 0);
    });
  }, [rows]);

  const recommendCount = useMemo(
    () =>
      sorted.filter((r) => {
        const chips = systemRecommendation(r);
        return chips.some((c) => c.label.includes("apply now") || c.tone === "go");
      }).length,
    [sorted]
  );

  async function oneTap(id: string) {
    setMessage("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/applications/${id}/package`);
      const data = await res.json();
      if (data.error) {
        setMessage(data.error);
        return;
      }
      const pkg = data.package;
      window.open(pkg.jobUrl, "_blank", "noopener,noreferrer");
      localStorage.setItem("vexa:lastApplyPackage", JSON.stringify(pkg));
      const n = pkg.formEval?.fieldCount ?? Object.keys(pkg.filledFormData || {}).length;
      const q = pkg.formEval?.avgOverall;
      setMessage(
        `Opened ${pkg.company} — ${pkg.jobTitle}. Form package: ${n} fields` +
          (q != null ? ` · quality ${q}` : "") +
          (pkg.formSurface ? ` · ${pkg.formSurface}` : "") +
          `. Extension prefills; you click Submit.`
      );
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function rebuildForm(id: string) {
    setBusyId(`form_${id}`);
    setMessage("");
    try {
      const res = await fetch(`/api/applications/${id}/form`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rebuild failed");
      setMessage(
        `Form rebuilt · ${data.eval?.fieldCount ?? 0} fields · quality ${data.eval?.avgOverall ?? "—"} · ${data.surface || "ats"}`
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function markSubmitted(id: string) {
    await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted" }),
    });
    await fetch("/api/outcomes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        applicationId: id,
        event: "viewed",
        note: "marked submitted",
      }),
    }).catch(() => null);
    await load();
  }

  async function logOutcome(applicationId: string, event: string) {
    setBusyId(applicationId + event);
    setMessage("");
    try {
      const res = await fetch("/api/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, event }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMessage(`Logged outcome: ${event.replace(/_/g, " ")}`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full space-y-5">
      <PageHeader
        eyebrow="Legacy packages"
        title="Old draft packages"
        description="Auto-apply and resume tailor are removed. Use Pipeline (email CRM) for real tracking. This list is legacy prefill packages only."
        actions={
          <>
            <Button size="sm" asChild>
              <Link href="/pipeline">Open Pipeline CRM</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/applications" download>
                Export CSV
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/insights">
                <BarChart3 className="size-3.5" /> Insights
              </Link>
            </Button>
          </>
        }
      />

      {message && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Summary strip with recommendation count */}
      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-[12px]">
          <Sparkles className="size-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">
            <span className="font-mono font-medium text-foreground">
              {sorted.length}
            </span>{" "}
            packages
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
            {recommendCount} system recommends
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground">
            Tap a row to expand
          </span>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-border/80 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No drafts yet. Search a job and prepare a draft.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Packages
            </p>
            <span className="font-mono text-[11px] text-muted-foreground">
              {sorted.length}
            </span>
          </div>

          <ul>
            {sorted.map((row) => {
              const open = expanded === row.id;
              const pct = Math.round((row.shortlistProbability ?? 0) * 100);
              const tone =
                pct >= 85
                  ? "success"
                  : pct >= 72
                    ? "primary"
                    : ("warning" as const);
              const chips = systemRecommendation(row);
              const primaryRec = chips[0];
              const company = row.job?.company ?? "Company";
              const title = row.job?.title ?? "Role";

              return (
                <li
                  key={row.id}
                  className="border-b border-border/40 last:border-0"
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
                    onClick={() => setExpanded(open ? null : row.id)}
                    aria-expanded={open}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13px] font-semibold tracking-tight">
                          {company}
                        </p>
                        <Badge
                          variant={statusVariant(row.status)}
                          className="text-[9px] capitalize"
                        >
                          {row.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {title}
                        <span className="font-mono">
                          {" "}
                          · ATS {row.matchScore ?? "—"} · {pct}%
                        </span>
                      </p>
                      {/* System recommendation chips (always visible) */}
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {chips.map((c) => (
                          <RecChipView key={c.label} chip={c} />
                        ))}
                        {row.formSurface && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                            form: {row.formSurface}
                          </span>
                        )}
                        {row.formEval && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              row.formEval.avgOverall >= 75
                                ? "bg-success/15 text-success"
                                : row.formEval.avgOverall >= 60
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : "bg-destructive/10 text-destructive"
                            )}
                          >
                            form {row.formEval.avgOverall}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn(
                        "mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
                        open && "rotate-180"
                      )}
                    />
                  </button>

                  {/* Smooth expand */}
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-3 border-t border-border/30 bg-muted/15 px-3 pb-3 pt-2.5">
                        {/* Primary system tip */}
                        {primaryRec?.hint && (
                          <p className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                            <Sparkles className="mt-0.5 size-3 shrink-0 text-foreground/70" />
                            <span>
                              <span className="font-medium text-foreground/90">
                                System:{" "}
                              </span>
                              {primaryRec.hint}
                            </span>
                          </p>
                        )}

                        {row.errorMessage && (
                          <p className="text-[12px] text-destructive">
                            {row.errorMessage}
                          </p>
                        )}

                        <div className="grid gap-2 sm:grid-cols-2">
                          <ScoreBar
                            label="Match / ATS"
                            value={row.matchScore ?? 0}
                            tone="primary"
                          />
                          <ScoreBar
                            label="Shortlist"
                            value={pct}
                            tone={tone}
                          />
                        </div>

                        {row.shortlistFactors &&
                          row.shortlistFactors.length > 0 && (
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {row.shortlistFactors.slice(0, 4).map((f) => (
                                <div
                                  key={f.factor}
                                  className="rounded-lg border bg-background/60 px-2.5 py-1.5 text-[11px]"
                                >
                                  <div className="flex justify-between font-medium">
                                    <span className="truncate">
                                      {f.factor.replace(/_/g, " ")}
                                    </span>
                                    <span className="font-mono">
                                      {Math.round(f.score * 100)}%
                                    </span>
                                  </div>
                                  {f.note && (
                                    <p className="mt-0.5 line-clamp-2 text-muted-foreground">
                                      {f.note}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                        {/* Form-fill answers eval */}
                        {(row.formEval || row.formAnswers?.length) && (
                          <div className="rounded-lg border bg-background/70 p-2.5">
                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Form answers
                                {row.formSurface
                                  ? ` · ${row.formSurface}`
                                  : ""}
                              </p>
                              {row.formEval && (
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  ATS {row.formEval.avgAts} · human{" "}
                                  {row.formEval.avgHuman} · overall{" "}
                                  {row.formEval.avgOverall}
                                </span>
                              )}
                            </div>
                            {row.formEval?.recommendation && (
                              <p className="mb-2 text-[11px] text-muted-foreground">
                                {row.formEval.recommendation}
                              </p>
                            )}
                            <ul className="max-h-36 space-y-1 overflow-y-auto">
                              {(row.formAnswers || [])
                                .filter((a) => a.value?.trim())
                                .slice(0, 12)
                                .map((a) => (
                                  <li
                                    key={a.key}
                                    className="flex items-start justify-between gap-2 border-b border-border/30 py-1 text-[11px] last:border-0"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-medium">{a.label}</p>
                                      <p className="line-clamp-2 text-muted-foreground">
                                        {a.value}
                                      </p>
                                    </div>
                                    <span
                                      className={cn(
                                        "shrink-0 font-mono text-[10px]",
                                        a.overall >= 75
                                          ? "text-success"
                                          : a.overall >= 60
                                            ? "text-amber-600"
                                            : "text-destructive"
                                      )}
                                    >
                                      {a.overall}
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          {(row.status === "ready" ||
                            row.status === "requires_review") && (
                            <Button
                              size="sm"
                              className="h-8 text-[12px]"
                              disabled={busyId === row.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                void oneTap(row.id);
                              }}
                            >
                              {busyId === row.id && (
                                <Loader2 className="size-3.5 animate-spin" />
                              )}
                              Apply now (prefill)
                              <ExternalLink className="size-3 opacity-70" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[12px]"
                            disabled={busyId === `form_${row.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void rebuildForm(row.id);
                            }}
                          >
                            {busyId === `form_${row.id}` && (
                              <Loader2 className="size-3.5 animate-spin" />
                            )}
                            Rebuild form
                          </Button>
                          {row.status !== "submitted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-[12px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                void markSubmitted(row.id);
                              }}
                            >
                              Mark submitted
                            </Button>
                          )}
                          {row.job?.externalUrl && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-[12px]"
                              asChild
                            >
                              <a
                                href={row.job.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Job page
                              </a>
                            </Button>
                          )}
                        </div>

                        <div>
                          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Outcome
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {OUTCOME_BTNS.map((b) => (
                              <Button
                                key={b.event}
                                size="sm"
                                variant={
                                  row.latestOutcome === b.event
                                    ? "default"
                                    : "outline"
                                }
                                className="h-7 text-[10px]"
                                disabled={busyId === row.id + b.event}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void logOutcome(row.id, b.event);
                                }}
                              >
                                {b.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
