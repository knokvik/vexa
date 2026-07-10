"use client";

import { useEffect, useState } from "react";
import type { ApplicationDraft, JobListing } from "@vexa/shared";
import { PageHeader } from "@/components/page-header";
import { ScoreBar } from "@/components/score-bar";
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
import { CheckCircle2 } from "lucide-react";

type Row = ApplicationDraft & { job?: JobListing };

function statusVariant(
  status: string
): "success" | "warning" | "secondary" | "destructive" | "default" {
  if (status === "ready") return "success";
  if (status === "requires_review") return "warning";
  if (status === "submitted") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

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
    window.open(pkg.jobUrl, "_blank", "noopener,noreferrer");
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
      <PageHeader
        eyebrow="Draft Inbox"
        title="Ready to apply"
        description="Each card is a tailored, humanized package. One tap opens the job with prefill data — submission is always your click."
      />

      {message && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No drafts yet. Go to Jobs and hit Start automation or Prepare draft.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {rows.map((row) => {
          const pct = Math.round((row.shortlistProbability ?? 0) * 100);
          const tone =
            pct >= 85 ? "success" : pct >= 72 ? "primary" : ("warning" as const);
          return (
            <Card key={row.id}>
              <CardHeader className="flex flex-col gap-4 space-y-0 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl">
                      {row.job?.company ?? "Company"} —{" "}
                      {row.job?.title ?? "Role"}
                    </CardTitle>
                    <Badge variant={statusVariant(row.status)}>
                      {row.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    Template pipeline · match {row.matchScore ?? "—"} ·
                    shortlist {pct}%
                  </CardDescription>
                  {row.errorMessage && (
                    <p className="text-sm text-destructive">{row.errorMessage}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {(row.status === "ready" ||
                    row.status === "requires_review") && (
                    <Button onClick={() => oneTap(row.id)}>Apply now</Button>
                  )}
                  {row.status !== "submitted" && (
                    <Button
                      variant="outline"
                      onClick={() => markSubmitted(row.id)}
                    >
                      Mark submitted
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <ScoreBar
                    label="Match / ATS"
                    value={row.matchScore ?? 0}
                    tone="primary"
                  />
                  <ScoreBar
                    label="Shortlist probability"
                    value={pct}
                    tone={tone}
                  />
                </div>
                {row.shortlistFactors && row.shortlistFactors.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {row.shortlistFactors.map((f) => (
                      <div
                        key={f.factor}
                        className="rounded-lg border bg-muted/40 px-3 py-2 text-xs"
                      >
                        <div className="flex justify-between font-medium">
                          <span>{f.factor.replace(/_/g, " ")}</span>
                          <span className="font-mono">
                            {Math.round(f.score * 100)}%
                          </span>
                        </div>
                        {f.note && (
                          <p className="mt-1 text-muted-foreground">{f.note}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
