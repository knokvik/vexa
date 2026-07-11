"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JobListing } from "@vexa/shared";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState("senior frontend engineer remote");

  async function load() {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    setJobs(data.jobs ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  function goLiveSearch() {
    const query = q.trim();
    if (!query) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

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
        eyebrow="Jobs"
        title="Find roles"
        description="Live search streams company sites first, then job portals, then LinkedIn — cards appear one by one."
        actions={
          <Button variant="outline" disabled={running} onClick={startAutomation}>
            {running && <Loader2 className="animate-spin" />}
            Prepare drafts (saved list)
          </Button>
        }
      />

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live search</CardTitle>
          <CardDescription>
            Opens a live results page with loaders and priority sources.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              goLiveSearch();
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Role, skills, remote…"
              className="flex-1"
            />
            <Button type="submit">
              <Search />
              Search live
            </Button>
          </form>
        </CardContent>
      </Card>

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

      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Saved / recent listings ({jobs.length})
        </h2>
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="flex flex-col gap-3 space-y-0 md:flex-row md:items-start md:justify-between">
                <div>
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
              <CardContent>
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {job.description}
                </p>
              </CardContent>
            </Card>
          ))}
          {jobs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No saved jobs yet. Run a live search above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
