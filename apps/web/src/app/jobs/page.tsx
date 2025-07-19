"use client";

import { useEffect, useState } from "react";
import type { JobListing } from "@vexa/shared";
import Link from "next/link";

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);

  async function load() {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    setJobs(data.jobs ?? []);
  }

  useEffect(() => {
    load();
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
    setNote(
      `Draft ready for ${data.draft?.id ?? "application"} — check Draft Inbox.`
    );
  }

  async function startAutomation() {
    setRunning(true);
    setNote("");
    const res = await fetch("/api/automation/start", { method: "POST" });
    const data = await res.json();
    setRunning(false);
    setNote(
      `Automation prepared ${data.prepared ?? 0} draft(s). Open Draft Inbox.`
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-accent">Job discovery</p>
          <h1 className="mt-1 text-3xl font-semibold">Matched roles</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            MVP uses demo + ingest adapters. Production: Firecrawl → Exa →
            Bright Data for public listings only.
          </p>
        </div>
        <button
          className="btn-primary"
          disabled={running}
          onClick={startAutomation}
        >
          {running ? "Running…" : "Start automation"}
        </button>
      </div>

      {note && (
        <div className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent">
          {note}{" "}
          <Link href="/inbox" className="underline">
            Open inbox
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="card flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-medium">{job.title}</h2>
                <span className="badge bg-white/5 text-zinc-400">
                  {job.source}
                </span>
                {job.location.remote && (
                  <span className="badge bg-mint/15 text-mint">Remote</span>
                )}
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                {job.company}
                {job.location.city ? ` · ${job.location.city}` : ""}
                {job.salary?.min
                  ? ` · $${(job.salary.min / 1000).toFixed(0)}k–${(
                      (job.salary.max ?? job.salary.min) / 1000
                    ).toFixed(0)}k`
                  : ""}
              </p>
              <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                {job.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {job.skillsRequired.slice(0, 6).map((s) => (
                  <span key={s} className="badge bg-ink-800 text-zinc-300">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <a
                href={job.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost"
              >
                View
              </a>
              <button
                className="btn-primary"
                disabled={busyId === job.id}
                onClick={() => prepare(job.id)}
              >
                {busyId === job.id ? "Preparing…" : "Prepare draft"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
