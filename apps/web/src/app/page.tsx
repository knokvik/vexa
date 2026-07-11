import Link from "next/link";
import { CheckCircle2, Link2 } from "lucide-react";
import { VOLUME_CAPS } from "@vexa/shared";
import { store } from "@/lib/store";
import { ScoreBar } from "@/components/score-bar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const profile = store.getProfile();
  const jobs = store.listJobs();
  const drafts = store.listDrafts();
  const ready = drafts.filter((d) => d.status === "ready").length;
  const review = drafts.filter((d) => d.status === "requires_review").length;
  const used = store.draftsTodayCount();
  const sync = store.getSyncStatus();

  const stats = [
    { label: "Jobs matched", value: jobs.length, hint: "Active listings" },
    { label: "Ready drafts", value: ready, hint: "One-tap apply" },
    { label: "Needs review", value: review, hint: "Below threshold" },
    {
      label: "Platforms linked",
      value: sync.connectedCount,
      hint:
        sync.staleCount > 0
          ? `${sync.staleCount} need daily sync`
          : "Daily sync ready",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${profile.fullName.split(" ")[0]}`}
        description="Quality-first automation: humanized resumes, ATS + shortlist scores, one-tap apply from your browser. We never auto-submit for you."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/connections">Connections</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/onboarding">Edit profile</Link>
            </Button>
            <Button asChild>
              <Link href="/search">Live search</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="font-mono text-3xl tabular-nums">
                {s.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Today&apos;s quality cap</CardTitle>
              <CardDescription>
                Caps protect accounts and response rates.
              </CardDescription>
            </div>
            <Badge variant="secondary">
              {used}/{VOLUME_CAPS.maxDraftsPerDay} drafts
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScoreBar
              label="Volume used"
              value={(used / VOLUME_CAPS.maxDraftsPerDay) * 100}
              tone={used >= VOLUME_CAPS.maxDraftsPerDay ? "warning" : "primary"}
            />
            <p className="text-sm text-muted-foreground">
              Competitors spray 1,500 generic apps — we aim for ~10 tailored
              ones.
            </p>
            <Button variant="outline" asChild>
              <Link href="/inbox">Open Draft Inbox →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Safety model</CardTitle>
            <CardDescription>Built-in guardrails</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {[
                "Draft + one-tap only",
                "Submit from your browser",
                "No server-side auto-apply",
                "Errors notify you",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-semibold">Connected data sources</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {sync.connectedCount === 0
                ? "No platforms connected yet. Link LinkedIn, X, GitHub so resumes use fresh profile data."
                : `${sync.connectedCount} connected · ${sync.syncEnabledCount} daily sync on · pre-apply sync ${sync.syncBeforeApply ? "enabled" : "off"}.`}
            </p>
            {sync.lastSyncReport && (
              <p className="font-mono text-xs text-muted-foreground">
                Last sync: {sync.lastSyncReport.triggeredBy} ·{" "}
                {new Date(sync.lastSyncReport.ranAt).toLocaleString()}
              </p>
            )}
          </div>
          <Button asChild className="shrink-0">
            <Link href="/connections">Manage connections</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
