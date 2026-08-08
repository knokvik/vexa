"use client";

import { useEffect, useState } from "react";
import type { JobListing } from "@vexa/shared";
import type { JobIntel } from "@/lib/job-intel";
import {
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderGit2,
  Loader2,
  Mail,
  Radar,
  Users,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ScanStep = {
  id: string;
  label: string;
  status: "pending" | "loading" | "done";
};

const STEP_DEFS: Omit<ScanStep, "status">[] = [
  { id: "mentions", label: "Scanning job mentions" },
  { id: "people", label: "Finding people at the company" },
  { id: "projects", label: "Researching projects & experience" },
  { id: "gaps", label: "Matching against your profile" },
];

export function JobIntelSheet({
  open,
  onOpenChange,
  job,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobListing | null;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<ScanStep[]>([]);
  const [intel, setIntel] = useState<JobIntel | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(false);

  function draftOutreach(person: {
    name: string;
    role?: string;
    snippet: string;
  }) {
    if (!job) return;
    const params = new URLSearchParams({
      toName: person.name,
      toRole: person.role || "",
      company: job.company,
      jobTitle: job.title,
      jobUrl: job.externalUrl,
      projectHook: person.snippet.slice(0, 240),
      userNote: `From intel scan — ${person.name}`,
    });
    onOpenChange(false);
    router.push(`/outreach?${params.toString()}`);
  }

  useEffect(() => {
    if (!open || !job) return;

    let cancelled = false;
    setIntel(null);
    setError("");
    setQueued(false);
    setLoading(true);
    setSteps(STEP_DEFS.map((s) => ({ ...s, status: "pending" })));

    // Progressive step animation while API runs
    const timers: ReturnType<typeof setTimeout>[] = [];
    STEP_DEFS.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setSteps((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? { ...s, status: "loading" }
                : idx < i
                  ? { ...s, status: "done" }
                  : s
            )
          );
        }, i * 700)
      );
    });

    (async () => {
      try {
        const res = await fetch("/api/jobs/intel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: job.id, job }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setSteps((prev) => prev.map((s) => ({ ...s, status: "done" })));
        setIntel(data.intel as JobIntel);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Scan failed");
          setSteps((prev) =>
            prev.map((s) =>
              s.status === "loading" ? { ...s, status: "done" } : s
            )
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [open, job]);

  const progress =
    (steps.filter((s) => s.status === "done").length / Math.max(steps.length, 1)) *
    100;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
      >
        <SheetHeader className="space-y-1 border-b p-4 text-left">
          <div className="flex items-center gap-2 text-primary">
            <Radar className="size-4" />
            <span className="text-xs font-medium">Apply · research scan</span>
          </div>
          <SheetTitle className="text-base leading-snug">
            {job?.title || "Role"}
          </SheetTitle>
          <SheetDescription>
            {job?.company}
            {job?.externalUrl && (
              <>
                {" · "}
                <a
                  href={job.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  open job
                </a>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="border-b px-4 py-3">
          <div className="mb-2 flex justify-between text-[11px] text-muted-foreground">
            <span>{loading ? "Scanning…" : "Scan complete"}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={loading ? Math.min(progress, 90) : 100} className="h-1.5" />
          <ul className="mt-3 space-y-1.5">
            {steps.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                {s.status === "loading" ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                ) : s.status === "done" ? (
                  <CheckCircle2 className="size-3.5 text-success" />
                ) : (
                  <span className="size-3.5 rounded-full border" />
                )}
                {s.label}
              </li>
            ))}
          </ul>
        </div>

        <ScrollArea className="flex-1 px-4 py-3">
          {error && (
            <p className="mb-3 text-sm text-destructive">{error}</p>
          )}

          {!intel && loading && (
            <p className="text-xs text-muted-foreground">
              Pulling role keywords, people, and projects via Exa + Firecrawl…
            </p>
          )}

          {intel && (
            <div className="space-y-5 pb-6">
              {/* Readiness */}
              <div
                className={cn(
                  "rounded-lg border p-3",
                  intel.readiness === "ready"
                    ? "border-success/40 bg-success/5"
                    : "border-warning/40 bg-warning/5"
                )}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {intel.readiness === "ready" ? (
                    <CheckCircle2 className="size-4 text-success" />
                  ) : (
                    <Clock className="size-4 text-warning" />
                  )}
                  {intel.readiness === "ready"
                    ? "Ready to prepare later"
                    : "Waiting — fill gaps first"}
                </div>
                {intel.waitingReasons.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {intel.waitingReasons.map((r) => (
                      <li key={r} className="flex gap-1.5">
                        <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warning" />
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Mentions */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Briefcase className="size-3.5" /> Job mentions
                </h3>
                {intel.mentions.seniority && (
                  <Badge variant="secondary" className="text-[10px]">
                    Level: {intel.mentions.seniority}
                  </Badge>
                )}
                <div className="flex flex-wrap gap-1">
                  {intel.mentions.skills.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                  {intel.mentions.skills.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      No clear skill keywords extracted
                    </span>
                  )}
                </div>
                {intel.mentions.requirements.length > 0 && (
                  <ul className="list-inside list-disc space-y-1 text-[11px] text-muted-foreground">
                    {intel.mentions.requirements.slice(0, 5).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator />

              {/* People */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="size-3.5" /> People / experience signals
                </h3>
                {intel.people.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No public people profiles found this pass.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {intel.people.map((p) => (
                      <li
                        key={p.name + (p.url || "")}
                        className="rounded-md border bg-card p-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">
                              {p.snippet}
                            </p>
                          </div>
                          {p.url && (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                        {p.signals.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {p.signals.map((s) => (
                              <Badge
                                key={s}
                                variant="secondary"
                                className="text-[9px]"
                              >
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 gap-1 text-[10px]"
                          onClick={() =>
                            draftOutreach({
                              name: p.name,
                              role: p.role,
                              snippet: p.snippet,
                            })
                          }
                        >
                          <Mail className="size-3" />
                          Draft outreach
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator />

              {/* Projects */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <FolderGit2 className="size-3.5" /> Projects & write-ups
                </h3>
                {intel.projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No public projects surfaced this pass.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {intel.projects.map((p) => (
                      <li
                        key={p.title + (p.url || "")}
                        className="rounded-md border p-2.5"
                      >
                        <div className="flex justify-between gap-2">
                          <p className="text-xs font-medium line-clamp-1">
                            {p.title}
                          </p>
                          {p.url && (
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-primary"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-3">
                          {p.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <Separator />

              {/* Gaps */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  You vs role
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {intel.gaps.map((g) => (
                    <Badge
                      key={g.skill}
                      variant={g.have ? "success" : "outline"}
                      className={cn(
                        "text-[10px]",
                        !g.have && "border-warning/50 text-warning"
                      )}
                    >
                      {g.have ? "✓" : "·"} {g.skill}
                    </Badge>
                  ))}
                </div>
              </section>

              <p className="text-[10px] text-muted-foreground">
                Sources: {intel.sourcesUsed.join(", ") || "local parse"} ·{" "}
                {(intel.durationMs / 1000).toFixed(1)}s
              </p>
            </div>
          )}
        </ScrollArea>

        <div className="mt-auto space-y-2 border-t p-4">
          {queued ? (
            <p className="text-center text-xs text-success">
              Saved for apply later. Draft/ATS pipeline not run yet.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              className="flex-1"
              disabled={!intel || loading}
              variant={
                intel?.readiness === "waiting" ? "secondary" : "default"
              }
              onClick={() => {
                setQueued(true);
                // Apply later — local flag + durable app memory (companies applied vault)
                try {
                  const key = "vexa:applyLater";
                  const prev = JSON.parse(
                    localStorage.getItem(key) || "[]"
                  ) as string[];
                  if (job?.id && !prev.includes(job.id)) {
                    localStorage.setItem(
                      key,
                      JSON.stringify([job.id, ...prev].slice(0, 50))
                    );
                  }
                } catch {
                  /* ignore */
                }
                if (job) {
                  void fetch("/api/tasks", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      type: "apply_later",
                      company: job.company,
                      title: job.title,
                      jobId: job.id,
                      url: job.externalUrl,
                      status: "apply_later",
                      note: "queued from intel sheet",
                    }),
                  }).catch(() => {
                    /* offline / ignore */
                  });
                }
              }}
            >
              {intel?.readiness === "waiting"
                ? "Queue anyway (later)"
                : "Apply later"}
            </Button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground">
            Actual ATS draft + one-tap apply comes next. This step is research
            only.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
