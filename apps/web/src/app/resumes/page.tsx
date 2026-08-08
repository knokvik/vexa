"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "@vexa/shared";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Official Ivy / peer career-center resume templates.
 * Cards open the school source — no AI generation.
 */
const IVY_TEMPLATES = [
  {
    id: "harvard",
    name: "Harvard",
    short: "Bullet-point resume",
    description:
      "MCS bullet-point resume template — single column, ATS-friendly.",
    source: "Harvard FAS · Mignone Center for Career Success",
    url: "https://careerservices.fas.harvard.edu/resources/bullet-point-resume-template/",
    accent: "bg-red-700",
  },
  {
    id: "princeton",
    name: "Princeton",
    short: "Resumes & letters",
    description:
      "Career Development resume and cover letter guides & samples.",
    source: "Princeton Center for Career Development",
    url: "https://careerdevelopment.princeton.edu/guides/resumes-cover-letters-and-more",
    accent: "bg-orange-700",
  },
  {
    id: "yale",
    name: "Yale",
    short: "Resumes & CVs",
    description:
      "Office of Career Strategy resume, CV, and cover letter resources.",
    source: "Yale OCS",
    url: "https://ocs.yale.edu/channels/resumes-cvs-cover-letters/",
    accent: "bg-blue-900",
  },
  {
    id: "mit",
    name: "MIT",
    short: "STEM resume",
    description: "CAPD resume guide for technical / STEM roles.",
    source: "MIT CAPD",
    url: "https://capd.mit.edu/resources/resume/",
    accent: "bg-zinc-800",
  },
  {
    id: "penn",
    name: "Penn",
    short: "Career services",
    description: "Penn Career Services resume and application materials.",
    source: "University of Pennsylvania Career Services",
    url: "https://careerservices.upenn.edu/resumes/",
    accent: "bg-blue-800",
  },
  {
    id: "stanford",
    name: "Stanford",
    short: "Resume toolkit",
    description: "BEAM resume and cover letter resources.",
    source: "Stanford BEAM",
    url: "https://beam.stanford.edu/jobs-internships/resumes-cover-letters",
    accent: "bg-red-800",
  },
] as const;

type UploadMeta = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Combined Profile + Resume page.
 * Profile fields for automation · upload resume as-is · official Ivy templates.
 */
export default function ProfileResumePage() {
  const inputRef = useRef<HTMLInputElement>(null);

  // Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Resume upload
  const [meta, setMeta] = useState<UploadMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const isPdf = useMemo(() => {
    if (!meta) return false;
    return (
      meta.mimeType.includes("pdf") ||
      meta.originalName.toLowerCase().endsWith(".pdf")
    );
  }, [meta]);

  const isText = useMemo(() => {
    if (!meta) return false;
    return (
      meta.mimeType.includes("text") ||
      meta.originalName.toLowerCase().endsWith(".txt")
    );
  }, [meta]);

  const loadResume = useCallback(async () => {
    try {
      const res = await fetch("/api/resumes/upload");
      const data = await res.json();
      if (data.resume) {
        setMeta(data.resume);
        setPreviewUrl(`/api/resumes/upload/file?t=${Date.now()}`);
      } else {
        setMeta(null);
        setPreviewUrl(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/profile")
        .then((r) => r.json())
        .then((d) => setProfile(d.profile)),
      loadResume(),
    ]).finally(() => setLoading(false));
  }, [loadResume]);

  async function saveProfile() {
    if (!profile) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await res.json();
      setProfile(data.profile);
      setMessage("Profile saved — automation can use these details.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/resumes/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMeta(data.resume);
      setPreviewUrl(`/api/resumes/upload/file?t=${Date.now()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removeUpload() {
    setError("");
    await fetch("/api/resumes/upload", { method: "DELETE" });
    setMeta(null);
    setPreviewUrl(null);
  }

  function onPick(files: FileList | null) {
    const f = files?.[0];
    if (f) void uploadFile(f);
  }

  if (loading && !profile) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading profile…
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">
      <PageHeader
        eyebrow="Profile & resume"
        title="You"
        description="Edit profile for applications, upload your resume as-is, and grab official Ivy templates."
      />

      {message && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* ═══ PROFILE ═══ */}
      {profile && (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">Profile</h2>
            <p className="text-[12px] text-muted-foreground">
              Used for form prefill and cold email — not for rewriting your
              uploaded resume.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basics</CardTitle>
              <CardDescription>
                Identity and narrative for applications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={profile.fullName}
                  onChange={(e) =>
                    setProfile({ ...profile, fullName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="headline">Headline</Label>
                <Input
                  id="headline"
                  value={profile.headline ?? ""}
                  onChange={(e) =>
                    setProfile({ ...profile, headline: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  className="min-h-28"
                  value={profile.summary ?? ""}
                  onChange={(e) =>
                    setProfile({ ...profile, summary: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={profile.phone ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={profile.location ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, location: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="years">Years experience</Label>
                  <Input
                    id="years"
                    type="number"
                    value={profile.yearsExperience ?? 0}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        yearsExperience: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn URL</Label>
                  <Input
                    id="linkedin"
                    value={profile.linkedinUrl ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, linkedinUrl: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="github">GitHub URL</Label>
                  <Input
                    id="github"
                    value={profile.githubUrl ?? ""}
                    onChange={(e) =>
                      setProfile({ ...profile, githubUrl: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interests">Interests (comma-separated)</Label>
                <Input
                  id="interests"
                  value={profile.interests.join(", ")}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      interests: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skills">Skills (comma-separated)</Label>
                <Input
                  id="skills"
                  value={profile.skills.map((s) => s.name).join(", ")}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      skills: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((name, i) => ({
                          id: `skill_${i}`,
                          name,
                          proficiency: "advanced" as const,
                        })),
                    })
                  }
                />
              </div>
              <Button disabled={saving} onClick={() => void saveProfile()}>
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ═══ RESUME UPLOAD ═══ */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Your resume (as-is)
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Upload PDF or DOCX. Preview is the file you uploaded — not AI
            generated.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Upload</CardTitle>
              <CardDescription>
                PDF preferred for live preview. DOCX/TXT supported.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => onPick(e.target.files)}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  onPick(e.dataTransfer.files);
                }}
                className={cn(
                  "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition",
                  dragOver
                    ? "border-foreground/40 bg-muted/50"
                    : "border-border bg-muted/20 hover:bg-muted/40",
                  uploading && "opacity-60"
                )}
              >
                {uploading ? (
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="size-8 text-muted-foreground" />
                )}
                <p className="text-sm font-medium">
                  {uploading
                    ? "Uploading…"
                    : "Drop resume here or click to browse"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  PDF · DOCX · DOC · TXT · max 12MB
                </p>
              </button>

              {meta && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {meta.originalName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatBytes(meta.size)} ·{" "}
                        {new Date(meta.uploadedAt).toLocaleString()}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {isPdf ? "PDF" : isText ? "TXT" : "Document"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          As uploaded
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Button size="sm" className="h-8" asChild>
                      <a
                        href={previewUrl || "/api/resumes/upload/file"}
                        download={meta.originalName}
                      >
                        <Download className="size-3.5" />
                        Download
                      </a>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => inputRef.current?.click()}
                    >
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive"
                      onClick={() => void removeUpload()}
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Preview</CardTitle>
              <CardDescription>
                Exact file content — not AI generated.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!meta || !previewUrl ? (
                <div className="flex h-[22rem] flex-col items-center justify-center gap-2 bg-muted/20 px-4 text-center text-sm text-muted-foreground sm:h-[28rem]">
                  <FileText className="size-10 opacity-40" />
                  Upload a resume to preview it here.
                </div>
              ) : isPdf ? (
                <iframe
                  title="Resume preview"
                  src={previewUrl}
                  className="h-[22rem] w-full border-0 bg-muted/30 sm:h-[32rem]"
                />
              ) : isText ? (
                <TextPreview url={previewUrl} />
              ) : (
                <div className="flex h-[22rem] flex-col items-center justify-center gap-3 bg-muted/20 px-6 text-center sm:h-[28rem]">
                  <FileText className="size-10 text-muted-foreground opacity-50" />
                  <div>
                    <p className="text-sm font-medium">{meta.originalName}</p>
                    <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
                      Live embed works best for PDF. Re-upload as PDF for
                      in-browser preview, or download the Word file.
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <a href={previewUrl} download={meta.originalName}>
                      <Download className="size-3.5" />
                      Download file
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══ IVY TEMPLATES ═══ */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Ivy League & peer templates
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Click a card to open the official career-center page and download
            their template.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IVY_TEMPLATES.map((t) => (
            <a
              key={t.id}
              href={t.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "group flex flex-col rounded-xl border border-border/80 bg-card p-4 shadow-sm transition",
                "hover:border-foreground/20 hover:shadow-md"
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg text-sm font-bold text-white",
                    t.accent
                  )}
                >
                  {t.name.slice(0, 1)}
                </div>
                <ExternalLink className="size-3.5 text-muted-foreground opacity-60 transition group-hover:opacity-100" />
              </div>
              <p className="text-[15px] font-semibold tracking-tight">
                {t.name}
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-muted-foreground">
                {t.short}
              </p>
              <p className="mt-2 flex-1 text-[12px] leading-relaxed text-muted-foreground">
                {t.description}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
                <span className="line-clamp-1 text-[10px] text-muted-foreground">
                  {t.source}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
                  <Download className="size-2.5" />
                  Official
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState("Loading…");
  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch(() => {
        if (!cancelled) setText("Could not load text preview.");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return (
    <pre className="h-[22rem] overflow-auto whitespace-pre-wrap bg-white p-5 font-sans text-[12px] leading-relaxed text-zinc-900 sm:h-[32rem] dark:bg-zinc-950 dark:text-zinc-100">
      {text}
    </pre>
  );
}
