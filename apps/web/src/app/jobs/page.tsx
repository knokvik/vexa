"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobListing } from "@vexa/shared";
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchDialog } from "@/components/SearchProvider";
import { appendLog } from "@/lib/activity-bus";
import { cn } from "@/lib/utils";

export default function JobsPage() {
  const { openSearch } = useSearchDialog();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState("software engineer");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    setJobs(data.jobs ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function prepare(jobId: string) {
    setBusyId(jobId);
    setNote("");
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    const data = await res.json();
    setBusyId(null);
    if (data.error) {
      setNote(data.error);
      return;
    }
    appendLog({
      kind: "draft",
      message: `Draft prepared for ${data.draft?.job?.company || jobId}`,
      status: "done",
    });
    setNote(
      `Draft ready for ${data.draft?.id ?? "application"} — check Draft Inbox.`
    );
  }

  async function startAutomation() {
    setRunning(true);
    setNote("");
    const res = await fetch("/api/automation/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "drafts", maxDrafts: 5 }),
    });
    const data = await res.json();
    setRunning(false);
    setNote(
      `Automation prepared ${data.prepared ?? 0} draft(s). Open Draft Inbox.`
    );
    appendLog({
      kind: "automation",
      message: `Batch drafts: ${data.prepared ?? 0} prepared`,
      status: "done",
    });
    void load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        eyebrow="Jobs"
        title="Pipeline"
        description="Compact list of roles you found. Expand a row for actions."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={running}
            onClick={() => void startAutomation()}
          >
            {running && <Loader2 className="size-3.5 animate-spin" />}
            Prepare drafts
          </Button>
        }
      />

      {/* Open search dialog */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          openSearch(q.trim() || undefined);
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find roles…"
          className="h-9 flex-1"
        />
        <Button type="submit" size="sm" className="h-9 shrink-0">
          <Search className="size-3.5" />
          Search
        </Button>
      </form>

      {note && (
        <Alert>
          <AlertDescription>
            {note}{" "}
            <Link href="/inbox" className="font-medium underline">
              Open inbox
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Listings
          </p>
          <span className="font-mono text-[11px] text-muted-foreground">
            {jobs.length}
          </span>
        </div>

        {jobs.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No jobs yet.{" "}
            <button
              type="button"
              className="font-medium underline"
              onClick={() => openSearch()}
            >
              Run a search
            </button>
          </p>
        ) : (
          <ul>
            {jobs.map((job) => {
              const open = expanded === job.id;
              return (
                <li
                  key={job.id}
                  className="border-b border-border/40 last:border-0"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/30"
                    onClick={() => setExpanded(open ? null : job.id)}
                    aria-expanded={open}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold tracking-tight">
                        {job.title}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {job.company}
                        {job.location?.city ? ` · ${job.location.city}` : ""}
                        {job.location?.remote ? " · Remote" : ""}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="shrink-0 text-[9px]"
                    >
                      {job.source}
                    </Badge>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-out",
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
                      <div className="space-y-2.5 border-t border-border/30 bg-muted/15 px-3 pb-3 pt-2">
                        <p className="line-clamp-4 text-[12px] leading-relaxed text-muted-foreground">
                          {job.description || "No description available."}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            className="h-8 text-[12px]"
                            disabled={busyId === job.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void prepare(job.id);
                            }}
                          >
                            {busyId === job.id && (
                              <Loader2 className="size-3.5 animate-spin" />
                            )}
                            {busyId === job.id
                              ? "Preparing…"
                              : "Prepare draft"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-[12px]"
                            asChild
                          >
                            <a
                              href={job.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View listing
                              <ExternalLink className="size-3" />
                            </a>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-[12px]"
                            asChild
                          >
                            <Link href="/inbox">Inbox</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
