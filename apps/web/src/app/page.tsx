import Link from "next/link";
import { VOLUME_CAPS } from "@vexa/shared";
import { store } from "@/lib/store";
import { ScoreBar } from "@/components/ScoreBar";

export default function DashboardPage() {
  const profile = store.getProfile();
  const jobs = store.listJobs();
  const drafts = store.listDrafts();
  const ready = drafts.filter((d) => d.status === "ready").length;
  const review = drafts.filter((d) => d.status === "requires_review").length;
  const submitted = drafts.filter((d) => d.status === "submitted").length;
  const used = store.draftsTodayCount();

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-accent">Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Welcome back, {profile.fullName.split(" ")[0]}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Quality-first automation: humanized resumes, ATS + shortlist scores,
            one-tap apply from your browser. We never auto-submit for you.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/onboarding" className="btn-ghost">
            Edit profile
          </Link>
          <Link href="/jobs" className="btn-primary">
            Start pipeline
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Jobs matched", value: jobs.length, hint: "Active listings" },
          { label: "Ready drafts", value: ready, hint: "One-tap apply" },
          { label: "Needs review", value: review, hint: "Below threshold" },
          { label: "Submitted", value: submitted, hint: "You clicked submit" },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {s.label}
            </div>
            <div className="mt-2 font-mono text-3xl font-semibold">{s.value}</div>
            <div className="mt-1 text-xs text-zinc-500">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-4 p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Today&apos;s quality cap</h2>
            <span className="badge bg-accent/15 text-accent">
              {used}/{VOLUME_CAPS.maxDraftsPerDay} drafts
            </span>
          </div>
          <ScoreBar
            label="Volume used"
            value={(used / VOLUME_CAPS.maxDraftsPerDay) * 100}
            tone={used >= VOLUME_CAPS.maxDraftsPerDay ? "warn" : "accent"}
          />
          <p className="text-sm text-zinc-400">
            Cap protects your accounts and response rates. Competitors spray
            1,500 generic apps — we aim for ~10 tailored ones.
          </p>
          <Link href="/inbox" className="btn-ghost">
            Open Draft Inbox →
          </Link>
        </div>

        <div className="card space-y-3 p-6">
          <h2 className="text-lg font-medium">Safety model</h2>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li className="flex gap-2">
              <span className="text-mint">✓</span> Draft + one-tap only
            </li>
            <li className="flex gap-2">
              <span className="text-mint">✓</span> Submit from your browser
            </li>
            <li className="flex gap-2">
              <span className="text-mint">✓</span> No server-side auto-apply
            </li>
            <li className="flex gap-2">
              <span className="text-mint">✓</span> Errors notify you
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
