"use client";

import { useEffect, useState } from "react";
import type { ResumeVersion } from "@vexa/shared";
import { ScoreBar } from "@/components/ScoreBar";

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);

  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((d) => setResumes(d.resumes ?? []));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-accent">Resume versions</p>
        <h1 className="mt-1 text-3xl font-semibold">Generated packages</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Each application gets its own humanized, ATS-scored version.
        </p>
      </div>

      {resumes.length === 0 && (
        <div className="card p-10 text-center text-sm text-zinc-500">
          No resumes yet. Prepare a draft from Jobs.
        </div>
      )}

      <div className="space-y-4">
        {resumes.map((r) => (
          <div key={r.id} className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium">{r.content.fullName}</h2>
                <p className="text-sm text-zinc-500">
                  {r.content.headline} · template {r.templateId}
                </p>
              </div>
              <span className="badge bg-white/5 font-mono text-zinc-400">
                {r.id}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <ScoreBar
                label="Humanized score"
                value={r.humanizedScore ?? 0}
                tone="mint"
              />
              <ScoreBar label="ATS score" value={r.atsScore ?? 0} tone="accent" />
            </div>
            <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-ink-950/80 p-4 font-mono text-xs text-zinc-400">
              {r.plainText}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
