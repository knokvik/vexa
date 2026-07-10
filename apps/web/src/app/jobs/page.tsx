"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { JobListing } from "@vexa/shared";
import { ExternalLink, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
      <PageHeader
        eyebrow="Job discovery"
        title="Matched roles"
        description="MVP uses demo + ingest adapters. Production: Firecrawl → Exa → Bright Data for public listings only."
        actions={
          <Button disabled={running} onClick={startAutomation}>
            {running && <Loader2 className="animate-spin" />}
            {running ? "Running…" : "Start automation"}
          </Button>
        }
      />

      {note && (
        <Alert>
          <AlertDescription>
            {note}{" "}
            <Link href="/inbox" className="font-medium text-primary underline">
              Open inbox
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-lg">{job.title}</CardTitle>
                  <Badge variant="secondary">{job.source}</Badge>
                  {job.location.remote && (
                    <Badge variant="success">Remote</Badge>
                  )}
                </div>
                <CardDescription>
                  {job.company}
                  {job.location.city ? ` · ${job.location.city}` : ""}
                  {job.salary?.min
                    ? ` · $${(job.salary.min / 1000).toFixed(0)}k–${(
                        (job.salary.max ?? job.salary.min) / 1000
                      ).toFixed(0)}k`
                    : ""}
                </CardDescription>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={job.externalUrl} target="_blank" rel="noreferrer">
                    View <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  size="sm"
                  disabled={busyId === job.id}
                  onClick={() => prepare(job.id)}
                >
                  {busyId === job.id && <Loader2 className="animate-spin" />}
                  {busyId === job.id ? "Preparing…" : "Prepare draft"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {job.description}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {job.skillsRequired.slice(0, 6).map((s) => (
                  <Badge key={s} variant="outline">
                    {s}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
