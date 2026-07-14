"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ResumeVersion } from "@vexa/shared";
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ScoreBar } from "@/components/score-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  openResumePdfPreview,
  resumePreviewBlobUrl,
} from "@/lib/resume-pdf";

type TemplateCard = {
  id: string;
  name: string;
  category: string;
  atsFriendlyScore: number;
  description?: string;
  styleSource?: string;
  bestFor?: string;
  fontFamily?: string;
};

type ChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  detail?: string;
};

type Preview = {
  templateId: string;
  templateName: string;
  plainText: string;
  atsScore: number;
  formatScore: number;
  humanizedScore?: number;
  checklist: ChecklistItem[];
};

type JobLite = {
  id: string;
  company?: string;
  title?: string;
  externalUrl?: string;
};

type ResumeRow = ResumeVersion & {
  job?: JobLite | null;
  applicationId?: string | null;
  applicationStatus?: string | null;
  shortlistProbability?: number | null;
};

type DraftPackage = {
  applicationId: string;
  status: string;
  shortlistProbability?: number;
  matchScore?: number;
  createdAt?: string;
  job?: JobLite | null;
  resume?: {
    id: string;
    templateId: string;
    plainText: string;
    atsScore?: number;
    humanizedScore?: number;
    content?: ResumeVersion["content"];
    createdAt?: string;
  } | null;
};

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeRow[]>([]);
  const [draftPackages, setDraftPackages] = useState<DraftPackage[]>([]);
  const [templates, setTemplates] = useState<TemplateCard[]>([]);
  const [preferred, setPreferred] = useState("tpl-harvard");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"base" | "jobs">("base");
  const [pdf, setPdf] = useState<{
    title: string;
    subtitle?: string;
    plainText: string;
    fontFamily?: string;
    url: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/resumes");
      const data = await res.json();
      setResumes(data.resumes ?? []);
      setDraftPackages(data.draftPackages ?? []);
      setTemplates(data.templates ?? []);
      setPreferred(data.preferredTemplateId ?? "tpl-harvard");
      setPreview(data.preview ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Revoke blob when closing PDF modal
  useEffect(() => {
    return () => {
      if (pdf?.url) URL.revokeObjectURL(pdf.url);
    };
  }, [pdf?.url]);

  const preferredTpl = useMemo(
    () => templates.find((t) => t.id === preferred),
    [templates, preferred]
  );

  const jobResumes = useMemo(() => {
    // Prefer draft packages with resume text (job-tailored)
    const fromDrafts = draftPackages.filter((d) => d.resume?.plainText);
    if (fromDrafts.length) return fromDrafts;
    // Fallback: resume versions that have a job
    return resumes
      .filter((r) => r.jobListingId || r.job)
      .map((r) => ({
        applicationId: r.applicationId || r.id,
        status: r.applicationStatus || "saved",
        shortlistProbability: r.shortlistProbability ?? undefined,
        matchScore: r.atsScore,
        createdAt: r.createdAt,
        job: r.job,
        resume: {
          id: r.id,
          templateId: r.templateId,
          plainText: r.plainText,
          atsScore: r.atsScore,
          humanizedScore: r.humanizedScore,
          content: r.content,
          createdAt: r.createdAt,
        },
      })) as DraftPackage[];
  }, [draftPackages, resumes]);

  async function selectTemplate(templateId: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setTemplate", templateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPreferred(data.preferredTemplateId);
      setPreview(data.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Template update failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveBaseVersion() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "buildBase",
          templateId: preferred,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function copyPlain(text?: string) {
    const t = text || preview?.plainText;
    if (!t) return;
    void navigator.clipboard.writeText(t).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function downloadTxt(text?: string, label?: string) {
    const t = text || preview?.plainText;
    if (!t) return;
    const name = (label || preview?.templateName || "Resume")
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "");
    const blob = new Blob([t], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Resume_${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function showPdf(opts: {
    plainText: string;
    title: string;
    subtitle?: string;
    fontFamily?: string;
  }) {
    if (pdf?.url) URL.revokeObjectURL(pdf.url);
    const url = resumePreviewBlobUrl(opts);
    setPdf({ ...opts, url });
  }

  function closePdf() {
    if (pdf?.url) URL.revokeObjectURL(pdf.url);
    setPdf(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Resume studio"
        title="Templates & job resumes"
        description="Pick an Ivy ATS template, preview like a PDF, and open every resume generated for a role."
      />

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Tabs */}
      <div className="inline-flex rounded-full bg-muted p-1 text-[13px] font-medium">
        <button
          type="button"
          onClick={() => setTab("base")}
          className={cn(
            "rounded-full px-3.5 py-1.5 transition-colors",
            tab === "base"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          Template & base
        </button>
        <button
          type="button"
          onClick={() => setTab("jobs")}
          className={cn(
            "rounded-full px-3.5 py-1.5 transition-colors",
            tab === "jobs"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          Job resumes
          {jobResumes.length > 0 && (
            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
              {jobResumes.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : tab === "base" ? (
        <>
          {/* Horizontal template carousel */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                Choose template
              </h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                using: {preferredTpl?.name || preferred}
              </Badge>
            </div>
            <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-2 pt-0.5 snap-x snap-mandatory">
              {templates.map((tpl) => {
                const active = preferred === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void selectTemplate(tpl.id)}
                    className={cn(
                      "w-[11.5rem] shrink-0 snap-start rounded-xl border p-3 text-left transition",
                      "hover:bg-accent/40",
                      active && "border-primary ring-2 ring-primary/25 bg-card"
                    )}
                  >
                    {/* Mini paper mock */}
                    <div
                      className={cn(
                        "mb-2 h-28 rounded-md border bg-white p-2 shadow-sm dark:bg-zinc-50",
                        active && "ring-1 ring-primary/20"
                      )}
                    >
                      <div className="mb-1.5 h-1.5 w-10 rounded-full bg-zinc-800" />
                      <div className="mb-2 h-1 w-16 rounded-full bg-zinc-400" />
                      <div className="space-y-1">
                        <div className="h-1 w-full rounded-full bg-zinc-200" />
                        <div className="h-1 w-[90%] rounded-full bg-zinc-200" />
                        <div className="h-1 w-[75%] rounded-full bg-zinc-200" />
                        <div className="h-1 w-full rounded-full bg-zinc-200" />
                        <div className="h-1 w-[60%] rounded-full bg-zinc-200" />
                      </div>
                      <p className="mt-2 text-[8px] font-medium text-zinc-500">
                        {tpl.fontFamily || "Arial"}
                      </p>
                    </div>
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[12px] font-semibold leading-tight">
                        {tpl.name}
                      </p>
                      {active && (
                        <Check className="size-3.5 shrink-0 text-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {tpl.bestFor || tpl.description}
                    </p>
                    <Badge
                      variant="secondary"
                      className="mt-1.5 text-[9px]"
                    >
                      ATS {tpl.atsFriendlyScore}
                    </Badge>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Scroll templates · tap to use. Preferred template is applied on
              every draft package.
            </p>
          </div>

          {/* Base preview + checklist */}
          {preview && (
            <div className="grid gap-4 lg:grid-cols-[1fr_15rem]">
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
                  <div>
                    <CardTitle className="text-base">
                      {preview.templateName}
                    </CardTitle>
                    <CardDescription>
                      Live base resume from your profile
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() =>
                        showPdf({
                          plainText: preview.plainText,
                          title: preview.templateName,
                          subtitle: "Base resume",
                          fontFamily: preferredTpl?.fontFamily,
                        })
                      }
                    >
                      <Eye className="size-3.5" />
                      PDF preview
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() =>
                        openResumePdfPreview({
                          plainText: preview.plainText,
                          title: preview.templateName,
                          subtitle: "Base resume",
                          fontFamily: preferredTpl?.fontFamily,
                        })
                      }
                    >
                      <FileText className="size-3.5" />
                      Open PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => copyPlain()}
                    >
                      {copied ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => downloadTxt()}
                    >
                      <Download className="size-3.5" />
                      .txt
                    </Button>
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => void saveBaseVersion()}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="size-3.5" />
                      )}
                      Save version
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ScoreBar
                      label="ATS score"
                      value={preview.atsScore}
                      tone="primary"
                    />
                    <ScoreBar
                      label="Format"
                      value={preview.formatScore}
                      tone="success"
                    />
                  </div>
                  {/* Letter-style mini preview */}
                  <div className="overflow-hidden rounded-lg border bg-muted/40 p-3 sm:p-4">
                    <div className="mx-auto max-w-[36rem] rounded-sm bg-white px-5 py-6 shadow-md dark:bg-zinc-50">
                      <pre className="max-h-[22rem] overflow-y-auto whitespace-pre-wrap font-sans text-[10px] leading-relaxed text-zinc-900 sm:text-[11px]">
                        {preview.plainText}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="h-fit">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">ATS checklist</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(preview.checklist || []).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start gap-2 text-xs"
                    >
                      {c.ok ? (
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                      ) : (
                        <XCircle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                      )}
                      <div>
                        <p className="leading-snug">{c.label}</p>
                        {c.detail && (
                          <p className="text-[10px] text-muted-foreground">
                            {c.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <p className="text-[10px] text-muted-foreground">
                    Single column · standard fonts · no tables · action-verb
                    bullets
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Saved base versions */}
          {resumes.filter((r) => !r.jobListingId).length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Saved base versions</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {resumes
                  .filter((r) => !r.jobListingId)
                  .map((r) => (
                    <Card key={r.id}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3">
                        <div className="min-w-0">
                          <CardTitle className="truncate text-sm">
                            {r.content?.fullName || "Resume"}
                          </CardTitle>
                          <CardDescription className="text-[11px]">
                            {r.templateId} · ATS {r.atsScore ?? "—"}
                          </CardDescription>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0"
                          onClick={() =>
                            showPdf({
                              plainText: r.plainText,
                              title: r.content?.fullName || "Resume",
                              subtitle: r.templateId,
                            })
                          }
                        >
                          <Eye className="size-3.5" />
                          PDF
                        </Button>
                      </CardHeader>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Job-tailored resumes */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Resumes generated for roles
            </h2>
            <Button size="sm" variant="outline" asChild>
              <Link href="/inbox">Open inbox</Link>
            </Button>
          </div>

          {jobResumes.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No job resumes yet. Run Search → prepare draft, or Automate →
                Find + drafts. Packages land here with PDF preview.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {jobResumes.map((d) => {
                const company = d.job?.company || "Company";
                const title = d.job?.title || "Role";
                const text = d.resume?.plainText || "";
                return (
                  <Card key={d.applicationId}>
                    <CardHeader className="flex flex-col gap-3 space-y-0 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <CardTitle className="text-base leading-snug">
                            {company}
                          </CardTitle>
                          <Badge
                            variant="secondary"
                            className="text-[10px] capitalize"
                          >
                            {d.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <CardDescription className="text-[13px]">
                          {title}
                        </CardDescription>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {d.resume?.templateId || "—"}
                          {d.matchScore != null
                            ? ` · ATS ${d.matchScore}`
                            : ""}
                          {d.shortlistProbability != null
                            ? ` · shortlist ${Math.round(d.shortlistProbability * 100)}%`
                            : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          className="h-8"
                          disabled={!text}
                          onClick={() =>
                            showPdf({
                              plainText: text,
                              title: `${company} — ${title}`,
                              subtitle: d.resume?.templateId,
                            })
                          }
                        >
                          <Eye className="size-3.5" />
                          PDF preview
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={!text}
                          onClick={() =>
                            openResumePdfPreview({
                              plainText: text,
                              title: `${company} — ${title}`,
                              subtitle: d.resume?.templateId,
                            })
                          }
                        >
                          <FileText className="size-3.5" />
                          Open PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={!text}
                          onClick={() =>
                            downloadTxt(text, `${company}_${title}`)
                          }
                        >
                          <Download className="size-3.5" />
                          .txt
                        </Button>
                        {d.job?.externalUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            asChild
                          >
                            <a
                              href={d.job.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Job
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    {text && (
                      <CardContent className="px-4 pb-4 pt-0">
                        <div className="overflow-hidden rounded-lg border bg-muted/30 p-3">
                          <div className="mx-auto max-h-40 max-w-xl overflow-hidden rounded-sm bg-white px-4 py-3 shadow-sm dark:bg-zinc-50">
                            <pre className="whitespace-pre-wrap font-sans text-[9px] leading-relaxed text-zinc-800 line-clamp-[12]">
                              {text.slice(0, 900)}
                              {text.length > 900 ? "…" : ""}
                            </pre>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PDF preview modal */}
      {pdf && (
        <div
          className="fixed inset-0 z-[70] flex flex-col bg-black/70 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="PDF resume preview"
        >
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 rounded-t-xl bg-background px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{pdf.title}</p>
              {pdf.subtitle && (
                <p className="truncate text-[11px] text-muted-foreground">
                  {pdf.subtitle}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button
                size="sm"
                className="h-8"
                onClick={() =>
                  openResumePdfPreview({
                    plainText: pdf.plainText,
                    title: pdf.title,
                    subtitle: pdf.subtitle,
                    fontFamily: pdf.fontFamily,
                  })
                }
              >
                Print / Save PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={closePdf}
              >
                <X className="size-3.5" />
                Close
              </Button>
            </div>
          </div>
          <iframe
            title="Resume PDF preview"
            src={pdf.url}
            className="mx-auto h-full w-full max-w-4xl flex-1 rounded-b-xl border-0 bg-muted"
          />
        </div>
      )}
    </div>
  );
}
