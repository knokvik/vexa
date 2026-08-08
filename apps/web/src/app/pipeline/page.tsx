"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  Network,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type App = {
  id: string;
  companyName: string;
  jobTitle: string;
  stage: string;
  lastTouchAt: string;
  source: string;
  status: string;
};

type PipelineData = {
  columns: Record<string, App[]>;
  funnel: Array<{ stage: string; label: string; count: number }>;
  needsAttention: Array<{ app: App; reason: string | null }>;
  labels: Record<string, string>;
  openActions: Array<{
    id: string;
    title: string;
    priority: string;
    kind: string;
  }>;
  upcomingEvents: Array<{ id: string; title: string; datetime?: string }>;
};

const ACTIVE_STAGES = [
  "wishlist",
  "applied",
  "screen",
  "technical",
  "onsite",
  "offer",
];

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/crm/pipeline");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function dropEmail() {
    if (!raw.trim()) return;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/crm/emails/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          raw.includes("From:") || raw.length > 400
            ? { batch: true, raw }
            : { raw }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Ingest failed");
      if (json.count != null) {
        setNote(
          `Ingested ${json.count} email(s). Stages updated from classification.`
        );
      } else {
        setNote(
          `${json.classification} → ${json.stage || "linked"} · ${json.extracted?.companyName || "company?"} / ${json.extracted?.jobTitle || "role?"}`
        );
      }
      setRaw("");
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function moveStage(id: string, stage: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/crm/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage, force: true }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Move failed");
      }
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function doneAction(id: string) {
    await fetch("/api/crm/briefing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionId: id }),
    });
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading pipeline…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Email-native CRM"
        title="Pipeline"
        description="Drop recruiter emails. We classify, link company/contact/job, and advance stages. You still apply and reply — no auto-apply."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/network">
                <Network className="size-3.5" /> Network
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/timeline">
                <Inbox className="size-3.5" /> Timeline
              </Link>
            </Button>
          </>
        }
      />

      <Alert>
        <Mail className="size-4" />
        <AlertTitle>Email is the signal</AlertTitle>
        <AlertDescription className="text-sm">
          Forward confirmation, screen, rejection, or offer emails here (paste
          headers + body). No resume tailor. No auto-submit. Graph + pipeline
          only.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Drop email</CardTitle>
          <CardDescription>
            Paste full message (From/Subject/body) or multiple forwards.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={`From: Jane Recruiter <jane@stripe.com>\nSubject: Application for Senior Engineer\n\nHi — we received your application...`}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !raw.trim()}
              onClick={() => void dropEmail()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Classify & link
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setRaw(`From: Alex Chen <alex@linear.app>
Subject: Quick chat about a role at Linear?

Hi — I saw your profile and wanted to share an opportunity on our eng team. Are you open to a 15-min conversation this week?
https://calendly.com/alex-linear/15min`)
              }
            >
              Sample outreach
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setRaw(`From: Talent Team <careers@stripe.com>
Subject: Thanks for applying — Backend Engineer

We received your application for Backend Engineer at Stripe. Our team will review and be in touch.`)
              }
            >
              Sample applied
            </Button>
          </div>
          {note && (
            <p className="text-sm text-muted-foreground">
              <CheckCircle2 className="mr-1 inline size-3.5 text-success" />
              {note}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Needs attention */}
      {(data?.needsAttention?.length || 0) > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-600" />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data!.needsAttention.map(({ app, reason }) => (
              <div
                key={app.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span>
                  <strong>{app.jobTitle}</strong> @ {app.companyName}
                </span>
                <Badge variant="secondary">{reason}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Funnel */}
      <div className="flex flex-wrap gap-2">
        {data?.funnel
          ?.filter((f) =>
            ["wishlist", "applied", "screen", "technical", "onsite", "offer", "rejected"].includes(
              f.stage
            )
          )
          .map((f) => (
            <div
              key={f.stage}
              className="rounded-full border px-3 py-1 text-xs"
            >
              <span className="text-muted-foreground">{f.label}</span>{" "}
              <span className="font-mono font-semibold">{f.count}</span>
            </div>
          ))}
      </div>

      {/* Kanban */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {ACTIVE_STAGES.map((stage) => {
          const apps = data?.columns?.[stage] || [];
          return (
            <div
              key={stage}
              className="w-64 shrink-0 rounded-xl border bg-muted/20"
            >
              <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {data?.labels?.[stage] || stage}
                </span>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {apps.length}
                </Badge>
              </div>
              <ul className="max-h-[28rem] space-y-2 overflow-y-auto p-2">
                {apps.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border bg-background p-2.5 shadow-sm"
                  >
                    <p className="text-[13px] font-semibold leading-snug">
                      {a.jobTitle}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.companyName}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {a.source} · {a.lastTouchAt?.slice(0, 10)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ACTIVE_STAGES.filter((s) => s !== stage)
                        .slice(0, 3)
                        .map((s) => (
                          <button
                            key={s}
                            type="button"
                            disabled={busy}
                            className={cn(
                              "rounded border px-1.5 py-0.5 text-[9px] text-muted-foreground hover:bg-muted"
                            )}
                            onClick={() => void moveStage(a.id, s)}
                          >
                            → {data?.labels?.[s] || s}
                          </button>
                        ))}
                    </div>
                  </li>
                ))}
                {apps.length === 0 && (
                  <li className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                    Empty
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {(data?.openActions?.length || 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Open actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data!.openActions.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {a.kind} · {a.priority}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void doneAction(a.id)}
                >
                  Done
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
