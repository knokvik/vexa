"use client";

import { useEffect, useState } from "react";
import type { ResumeVersion } from "@vexa/shared";
import { PageHeader } from "@/components/page-header";
import { ScoreBar } from "@/components/score-bar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);

  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((d) => setResumes(d.resumes ?? []));
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Resume versions"
        title="Generated packages"
        description="Each application gets its own humanized, ATS-scored version."
      />

      {resumes.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No resumes yet. Prepare a draft from Jobs.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {resumes.map((r) => (
          <Card key={r.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-lg">{r.content.fullName}</CardTitle>
                <CardDescription>
                  {r.content.headline} · template {r.templateId}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono">
                {r.id}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <ScoreBar
                  label="Humanized score"
                  value={r.humanizedScore ?? 0}
                  tone="success"
                />
                <ScoreBar
                  label="ATS score"
                  value={r.atsScore ?? 0}
                  tone="primary"
                />
              </div>
              <ScrollArea className="h-48 rounded-lg border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                  {r.plainText}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
