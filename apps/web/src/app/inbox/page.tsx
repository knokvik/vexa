"use client";

import { useEffect, useState } from "react";
import type { ApplicationDraft, JobListing } from "@vexa/shared";
import { ScoreBar } from "@/components/ScoreBar";

type Row = ApplicationDraft & { job?: JobListing };

export default function InboxPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/applications");
    const data = await res.json();
    setRows(data.applications ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function oneTap(id: string) {
    setMessage("");
    const res = await fetch(`/api/applications/${id}/package`);
    const data = await res.json();
    if (data.error) {
      setMessage(data.error);
      return;
    }
    const pkg = data.package;
    // Open job URL — extension will prefill when installed.
    window.open(pkg.jobUrl, "_blank", "noopener,noreferrer");
    // Store package for extension bridge via localStorage
    localStorage.setItem("vexa:lastApplyPackage", JSON.stringify(pkg));
    setMessage(
      `Opened ${pkg.company} — ${pkg.jobTitle}. Extension prefills; you click Submit.`
    );
  }

  async function markSubmitted(id: string) {
    await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "submitted" }),
    });
    await load();
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-accent">Draft Inbox</p>
        <h1 className="mt-1 text-3xl font-semibold">Ready to apply</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Each card is a tailored, humanized package. One tap opens the job with
          prefill data — submission is always your click.
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-mint/20 bg-mint/10 px-4 py-3 text-sm text-mint">
          {message}
        </div>
      )}

      {rows.length === 0 && (
        <div className="card p-10 text-center text-sm text-zinc-500">
          No drafts yet. Go to Jobs and hit Start automation or Prepare draft.
        </div>
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const pct = Math.round((row.shortlistProbability ?? 0) * 100);
          const tone =
            pct >= 85 ? "mint" : pct >= 72 ? "accent" : ("warn" as const);
          return (
            <div key={row.id} className="card p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-medium">
                      {row.job?.company ?? "Company"} — {row.job?.title ?? "Role"}
                    </h2>
                    <span
                      className={`badge ${
                        row.status === "ready"
                          ? "bg-mint/15 text-mint"
                          : row.status === "requires_review"
                            ? "bg-warn/15 text-warn"
                            : row.status === "submitted"
                              ? "bg-accent/15 text-accent"
                              : row.status === "failed"
                                ? "bg-danger/15 text-danger"
                                : "bg-white/5 text-zinc-400"
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Template pipeline · match {row.matchScore ?? "—"} · shortlist{" "}
                    {pct}%
                  </p>
                  {row.errorMessage && (
                    <p className="text-sm text-danger">{row.errorMessage}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {(row.status === "ready" ||
                    row.status === "requires_review") && (
                    <button
                      className="btn-primary"
                      onClick={() => oneTap(row.id)}
                    >
                      Apply now
                    </button>
                  )}
                  {row.status !== "submitted" && (
                    <button
                      className="btn-ghost"
                      onClick={() => markSubmitted(row.id)}
                    >
                      Mark submitted
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <ScoreBar
                  label="Match / ATS"
                  value={row.matchScore ?? 0}
                  tone="accent"
                />
                <ScoreBar label="Shortlist probability" value={pct} tone={tone} />
              </div>

              {row.shortlistFactors && row.shortlistFactors.length > 0 && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {row.shortlistFactors.map((f) => (
                    <div
                      key={f.factor}
                      className="rounded-xl border border-white/5 bg-ink-800/40 px-3 py-2 text-xs"
                    >
                      <div className="flex justify-between text-zinc-300">
                        <span className="font-medium">
                          {f.factor.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono">
                          {Math.round(f.score * 100)}%
                        </span>
                      </div>
                      {f.note && (
                        <p className="mt-1 text-zinc-500">{f.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
