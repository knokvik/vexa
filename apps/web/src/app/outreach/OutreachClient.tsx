"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Copy,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Check,
  UserSearch,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type Draft = {
  id: string;
  to: string;
  toName?: string;
  toRole?: string;
  company: string;
  jobTitle?: string;
  jobUrl?: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
  error?: string;
};

type SendCap = {
  canSend: boolean;
  provider: string;
  hint: string;
};

export default function OutreachPage() {
  const searchParams = useSearchParams();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [send, setSend] = useState<SendCap | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Draft | null>(null);
  const [emailGuesses, setEmailGuesses] = useState<
    Array<{ email: string; confidence: number; source: string; type?: string }>
  >([]);
  const [findBusy, setFindBusy] = useState(false);
  const [freeStackNote, setFreeStackNote] = useState("");
  const [form, setForm] = useState({
    to: "",
    toName: "",
    toRole: "",
    company: "",
    jobTitle: "",
    jobUrl: "",
    userNote: "",
    projectHook: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/cold-email");
    const data = await res.json();
    setDrafts(data.drafts || []);
    setSend(data.send || null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Prefill from intel "Draft outreach" deep link
  useEffect(() => {
    const keys = [
      "toName",
      "toRole",
      "company",
      "jobTitle",
      "jobUrl",
      "projectHook",
      "userNote",
      "to",
    ] as const;
    let any = false;
    const next = { ...form };
    for (const k of keys) {
      const v = searchParams.get(k);
      if (v) {
        next[k] = v;
        any = true;
      }
    }
    if (any) {
      setForm(next);
      setNote(
        "Prefilled from job intel. Use Find contacts, pick an email, then Draft."
      );
      // Auto-run free contact find when company is present
      if (next.company) {
        void findContacts(next.company, next.toName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount/query
  }, [searchParams]);

  async function findContacts(company?: string, fullName?: string) {
    const co = (company ?? form.company).trim();
    if (!co) {
      setNote("Company required to find contacts.");
      return;
    }
    setFindBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/contacts/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: co,
          fullName: (fullName ?? form.toName) || undefined,
          role: form.toRole || form.jobTitle || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Contact find failed");
      setEmailGuesses(data.emails || []);
      setFreeStackNote(
        data.freeCreditsNote ||
          "Verify before send. Browser free tiers: GetProspect / Apollo / Prospeo."
      );
      setNote(
        data.emails?.length
          ? `Found ${data.emails.length} email candidates (${(data.sourcesUsed || []).join(", ")}). Pick one — never auto-sends.`
          : "No candidates. Try a different company name or paste email manually."
      );
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Find failed");
    } finally {
      setFindBusy(false);
    }
  }

  async function createDraft() {
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/cold-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft", ...form }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Draft failed");
      setSelected(data.draft);
      setSend(data.send || send);
      setNote("Draft ready — review before sending or copy to your mail app.");
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdits() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/cold-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: selected.id,
          subject: selected.subject,
          body: selected.body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSelected(data.draft);
      setNote("Saved edits.");
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function copyOut() {
    if (!selected) return;
    const text = `To: ${selected.to}\nSubject: ${selected.subject}\n\n${selected.body}`;
    await navigator.clipboard.writeText(text);
    await fetch("/api/cold-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copied", id: selected.id }),
    });
    setNote("Copied — paste into Gmail/Outlook and send yourself.");
    await load();
  }

  async function sendOut() {
    if (!selected) return;
    if (
      !confirm(
        `Send this email to ${selected.to} now? Only do this if you reviewed the text.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/cold-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", id: selected.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || data.draft?.error || "Send failed");
      setSelected(data.draft);
      setNote("Sent via " + (data.send?.provider || "provider") + ".");
      await load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cold outreach"
        title="Personalized emails"
        description="Highest leverage vs blasting Easy Apply. Draft from your profile + a real hook, review, then copy or send. Never bulk-spam."
      />

      <Alert>
        <Mail className="size-4" />
        <AlertTitle>Why this exists</AlertTitle>
        <AlertDescription className="text-sm">
          Referrals and human contact beat cold ATS volume. Cap a few notes per
          company. LinkedIn auto-apply is high ban risk — this path is safer and
          often converts better.
        </AlertDescription>
      </Alert>

      {send && (
        <p className="text-xs text-muted-foreground">
          Send capability:{" "}
          <Badge variant={send.canSend ? "success" : "secondary"}>
            {send.provider}
          </Badge>{" "}
          {send.hint}
        </p>
      )}

      {note && (
        <Alert>
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New draft</CardTitle>
            <CardDescription>
              Find free contact candidates, then draft. Hook = project, blog, or
              something real you noticed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(
              [
                ["to", "To email *", "alex@company.com"],
                ["toName", "Name", "Alex Kim"],
                ["toRole", "Their role", "Engineering Manager"],
                ["company", "Company *", "Stripe"],
                ["jobTitle", "Job title", "Senior Frontend Engineer"],
                ["jobUrl", "Job URL", "https://…"],
              ] as const
            ).map(([key, label, ph]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  placeholder={ph}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={findBusy || !form.company.trim()}
              onClick={() => void findContacts()}
            >
              {findBusy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserSearch className="size-4" />
              )}
              Find contacts (free)
            </Button>
            {emailGuesses.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">
                  Candidates — confirm before send (never auto-used)
                </p>
                <div className="flex flex-wrap gap-1">
                  {emailGuesses.map((g) => (
                    <Button
                      key={g.email}
                      type="button"
                      size="sm"
                      variant={form.to === g.email ? "default" : "secondary"}
                      className="h-auto max-w-full flex-col items-start gap-0 px-2 py-1 font-mono text-[10px]"
                      onClick={() => setForm((f) => ({ ...f, to: g.email }))}
                      title={`${g.source} · ${Math.round(g.confidence * 100)}%`}
                    >
                      <span className="truncate">{g.email}</span>
                      <span className="text-[9px] font-sans opacity-70">
                        {g.source}
                        {g.type ? ` · ${g.type}` : ""} ·{" "}
                        {Math.round(g.confidence * 100)}%
                      </span>
                    </Button>
                  ))}
                </div>
                {freeStackNote && (
                  <p className="text-[10px] text-muted-foreground">
                    {freeStackNote}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Specific hook (project / work)</Label>
              <Textarea
                placeholder="e.g. their open-source design tokens CLI cut lag 30%…"
                value={form.projectHook}
                onChange={(e) =>
                  setForm((f) => ({ ...f, projectHook: e.target.value }))
                }
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Your extra note</Label>
              <Textarea
                placeholder="Anything else to weave in (optional)"
                value={form.userNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, userNote: e.target.value }))
                }
                rows={2}
              />
            </div>
            <Button
              className="w-full"
              disabled={busy || !form.to || !form.company}
              onClick={() => void createDraft()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Draft email
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review & send</CardTitle>
            <CardDescription>
              Edit freely. Prefer Copy → your inbox unless Resend is configured.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground">
                Create a draft or pick one from history.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{selected.status}</Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {selected.to}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Subject</Label>
                  <Input
                    value={selected.subject}
                    onChange={(e) =>
                      setSelected({ ...selected, subject: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Body</Label>
                  <Textarea
                    value={selected.body}
                    onChange={(e) =>
                      setSelected({ ...selected, body: e.target.value })
                    }
                    rows={12}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void saveEdits()}
                  >
                    <Check className="size-3.5" /> Save
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void copyOut()}
                  >
                    <Copy className="size-3.5" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || !send?.canSend}
                    onClick={() => void sendOut()}
                    title={send?.hint}
                  >
                    <Send className="size-3.5" /> Send
                  </Button>
                </div>
                {selected.error && (
                  <p className="text-xs text-destructive">{selected.error}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-56">
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted"
                    onClick={() => setSelected(d)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {d.company} → {d.to}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {d.status}
                      </Badge>
                    </div>
                    <p className="truncate text-muted-foreground">{d.subject}</p>
                  </button>
                </li>
              ))}
              {drafts.length === 0 && (
                <li className="text-sm text-muted-foreground">No drafts yet.</li>
              )}
            </ul>
          </ScrollArea>
          <Separator className="my-3" />
          <p className="text-[10px] text-muted-foreground">
            Optional send: set{" "}
            <code className="rounded bg-muted px-1">RESEND_API_KEY</code> +{" "}
            <code className="rounded bg-muted px-1">COLD_EMAIL_FROM</code> in
            .env.local. Default path = copy to your own mail client.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
