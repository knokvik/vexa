"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Briefcase,
  Loader2,
  Mail,
  Mic,
  Network,
  Sparkles,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContributionGraph } from "@/components/dashboard/ContributionGraph";
import { HistorySheet } from "@/components/HistorySheet";
import { cn } from "@/lib/utils";
import { useSearchDialog } from "@/components/SearchProvider";
import { appendLog, reportActivity } from "@/lib/activity-bus";
import {
  loadHistory,
  pushHistory,
  type HistoryEntry,
} from "@/lib/command-history";

type CommandResult = {
  ok?: boolean;
  intent?: string;
  working?: string[];
  result?: Record<string, unknown>;
  suggestions?: string[];
  error?: string;
};

const QUICK = [
  {
    label: "Drop email",
    hint: "From: recruiter@company.com\nSubject: Application update\n\nWe received your application…",
    icon: Mail,
  },
  { label: "Find jobs", hint: "software engineer remote", icon: Briefcase },
  { label: "Scrapers", hint: "Service status", icon: Network },
  { label: "Briefing", hint: "Morning briefing", icon: Sparkles },
];

function oneLineSummary(data: CommandResult, prompt: string): string {
  if (data.error) return data.error.slice(0, 100);
  const w = data.working || [];
  if (data.intent === "email_ingest")
    return w[w.length - 1] || "Email ingested";
  if (data.intent === "job_search" || data.intent === "start_scrape") {
    const n = (data.result as { count?: number })?.count;
    return n != null
      ? `Found ${n} roles · scrapers ran for “${prompt.slice(0, 28)}”`
      : "Search complete";
  }
  if (data.intent === "services_status")
    return (
      (data.result as { summary?: string })?.summary || "Service status loaded"
    );
  if (data.intent === "network_query") {
    const n = ((data.result as { contacts?: unknown[] })?.contacts || [])
      .length;
    return `${n} contact(s) at ${(data.result as { company?: string })?.company || "company"}`;
  }
  if (data.intent === "briefing")
    return String(
      (data.result as { summary?: string })?.summary || "Briefing ready"
    ).slice(0, 120);
  if (data.intent === "add_task") return "Task added";
  if (data.intent === "complete_task")
    return w.find((x) => x.startsWith("Completed")) || "Task completed";
  if (data.intent === "remove_task")
    return w.find((x) => x.startsWith("Removed")) || "Task removed";
  if (data.intent === "list_tasks")
    return w.find((x) => x.includes("open")) || "Tasks listed";
  return w[w.length - 1] || data.intent || "Done";
}

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

export default function DashboardPage() {
  const { openSearch } = useSearchDialog();
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sheetEntry, setSheetEntry] = useState<HistoryEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** Mic armed: click mic → blue ring; hold input → listen */
  const [micArmed, setMicArmed] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [inputFocused, setInputFocused] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const baseTextRef = useRef("");
  const holdingRef = useRef(false);

  useEffect(() => {
    setHistory(loadHistory());
    void fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setName(d.profile?.fullName?.split(" ")[0] || ""))
      .catch(() => null);
    void fetch("/api/crm/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggest: "" }),
    })
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions || []))
      .catch(() => null);
  }, []);

  const onType = useCallback((value: string) => {
    setText(value);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => {
      void fetch("/api/crm/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggest: value }),
      })
        .then((r) => r.json())
        .then((d) => setSuggestions(d.suggestions || []))
        .catch(() => null);
    }, 220);
  }, []);

  function getRecognition(): SpeechRec | null {
    if (typeof window === "undefined") return null;
    const W = window as unknown as {
      SpeechRecognition?: new () => SpeechRec;
      webkitSpeechRecognition?: new () => SpeechRec;
    };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) return null;
    return new Ctor();
  }

  async function ensureMicPermission(): Promise<boolean> {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMicError("Mic needs HTTPS and a modern browser");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setMicError("Mic blocked — allow microphone for this site, then retry");
      } else {
        setMicError("Microphone not available");
      }
      return false;
    }
  }

  async function startListenOnInput() {
    if (!micArmed || listening) return;
    setMicError("");
    holdingRef.current = true;

    const ok = await ensureMicPermission();
    if (!ok || !holdingRef.current) return;

    const rec = getRecognition();
    if (!rec) {
      setMicError("Speech not supported — type instead (try Chrome)");
      return;
    }

    baseTextRef.current = text;
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (ev) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalChunk += t;
        else interimChunk += t;
      }
      if (finalChunk) {
        baseTextRef.current = (baseTextRef.current + " " + finalChunk)
          .replace(/\s+/g, " ")
          .trim();
        setText(baseTextRef.current);
        setInterim("");
      } else {
        setInterim(interimChunk);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") {
        setMicError("Mic not allowed — enable in browser site settings");
      } else if (e.error !== "aborted" && e.error !== "no-speech") {
        setMicError(e.error);
      }
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
      reportActivity({
        tool: "voice",
        action: "Listening…",
        status: "running",
      });
    } catch {
      setMicError("Could not start speech");
    }
  }

  function stopListenOnInput() {
    if (!holdingRef.current && !listening) return;
    holdingRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
    setInterim("");
    if (baseTextRef.current) setText(baseTextRef.current);
    reportActivity({
      tool: "voice",
      action: "Voice capture ended",
      status: "done",
    });
  }

  function armMic() {
    if (listening) stopListenOnInput();
    setMicArmed((a) => {
      const next = !a;
      if (!next) setMicError("");
      return next;
    });
    setInterim("");
  }

  async function runCommand(override?: string) {
    const payload = (override ?? text).trim();
    if (!payload) return;
    setBusy(true);
    reportActivity({
      tool: "command",
      action: payload.slice(0, 56),
      status: "running",
    });
    try {
      const res = await fetch("/api/crm/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload }),
      });
      const data = (await res.json()) as CommandResult;
      const summary = oneLineSummary(data, payload);
      const list = pushHistory({
        prompt: payload.slice(0, 400),
        summary,
        intent: data.intent,
        ok: !data.error && data.ok !== false,
        working: data.working,
        result: data.result as Record<string, unknown> | undefined,
      });
      setHistory(list);
      if (list[0]) {
        setSheetEntry(list[0]);
        setSheetOpen(true);
      }
      if (data.suggestions) setSuggestions(data.suggestions);
      reportActivity({
        tool: "command",
        action: summary.slice(0, 64),
        status: data.error ? "error" : "done",
      });
      appendLog({
        kind: data.intent || "command",
        message: summary,
        status: data.error ? "error" : "done",
      });
      if (
        [
          "email_ingest",
          "add_task",
          "job_search",
          "start_scrape",
          "complete_task",
          "remove_task",
        ].includes(data.intent || "")
      ) {
        setRefreshKey((k) => k + 1);
      }
      if (data.ok !== false) setText("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setHistory(pushHistory({ prompt: payload, summary: msg, ok: false }));
      reportActivity({ tool: "command", action: msg, status: "error" });
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !listening) {
      e.preventDefault();
      void runCommand();
    }
  }

  const displayValue = listening
    ? `${text}${text && interim ? " " : ""}${interim}`
    : text;

  return (
    <div className="mx-auto w-full max-w-4xl px-1 pb-4">
      <section className="flex flex-col items-center pb-4 pt-8 sm:pt-12">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Vexa
        </p>
        <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          {name ? `What next, ${name}?` : "What next?"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {micArmed
            ? "Mic on — hold the input to speak, release when done"
            : "Tap mic to arm voice · hold input to dictate"}
        </p>

        <div className="mt-8 w-full max-w-2xl space-y-3">
          {/* Input border only glows while holding (listening) — not when mic merely armed */}
          <div
            className={cn(
              "vexa-glow-border rounded-3xl bg-card shadow-lg ring-1 ring-black/5 dark:ring-white/10",
              listening && "is-listening is-active",
              inputFocused && !micArmed && !listening && "is-active"
            )}
            onPointerDown={(e) => {
              if (!micArmed) return;
              const t = e.target as HTMLElement;
              if (t.closest("button") || t.closest("a")) return;
              e.preventDefault();
              void startListenOnInput();
            }}
            onPointerUp={() => {
              if (micArmed) stopListenOnInput();
            }}
            onPointerLeave={() => {
              if (micArmed && listening) stopListenOnInput();
            }}
            onPointerCancel={() => stopListenOnInput()}
          >
            <div className="rounded-3xl bg-card">
              <div className="flex items-end gap-1.5 px-3 pb-3 pt-3 sm:gap-2 sm:px-4">
                <div className="relative min-h-[52px] flex-1">
                  <textarea
                    ref={taRef}
                    value={displayValue}
                    onChange={(e) => {
                      if (!listening) onType(e.target.value);
                    }}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onKeyDown={onKeyDown}
                    rows={Math.min(
                      6,
                      Math.max(2, displayValue.split("\n").length)
                    )}
                    placeholder={
                      micArmed
                        ? "Hold here and speak…"
                        : "Paste email · start scrape · task: …"
                    }
                    className={cn(
                      "min-h-[52px] w-full resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground/70",
                      micArmed && "cursor-pointer select-none",
                      listening && "text-red-700 dark:text-red-300"
                    )}
                    disabled={busy}
                    readOnly={listening}
                  />
                  {listening && (
                    <div className="pointer-events-none absolute bottom-1 right-1 flex items-end gap-0.5 opacity-70">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className="w-0.5 rounded-full bg-red-500"
                          style={{
                            height: 8 + (i % 3) * 5,
                            animationDelay: `${i * 0.1}s`,
                            display: "block",
                            animation: "vexa-wave 0.9s ease-in-out infinite",
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Mic: red + animated icon when armed; stronger pulse while holding */}
                <button
                  type="button"
                  className={cn(
                    "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    !micArmed &&
                      "border-border bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                    micArmed &&
                      !listening &&
                      "vexa-mic-icon-pulse border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
                    listening &&
                      "vexa-mic-pulse border-red-600 bg-red-600 text-white"
                  )}
                  title={
                    micArmed
                      ? "Mic on — hold input to talk (tap mic to turn off)"
                      : "Turn mic on"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    armMic();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Mic
                    className={cn(
                      "size-4",
                      micArmed && "vexa-mic-icon-spin"
                    )}
                  />
                </button>

                <Button
                  size="icon"
                  className="mb-0.5 h-9 w-9 shrink-0 rounded-full"
                  disabled={busy || !text.trim()}
                  onClick={(e) => {
                    e.stopPropagation();
                    void runCommand();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </Button>
              </div>

              {micArmed && !listening && (
                <p className="px-4 pb-2 text-center text-[11px] text-red-600 dark:text-red-400">
                  Mic on — hold the input bar to dictate
                </p>
              )}
              {listening && (
                <p className="px-4 pb-2 text-center text-[11px] font-medium text-red-600 dark:text-red-400">
                  Listening… release to stop
                  {interim ? ` · “${interim.slice(0, 48)}”` : ""}
                </p>
              )}
              {micError && (
                <p className="px-4 pb-2 text-center text-[11px] text-destructive">
                  {micError}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5 px-1">
            {QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  if (q.label === "Find jobs" && !text) {
                    openSearch();
                    return;
                  }
                  onType(q.hint);
                  taRef.current?.focus();
                }}
              >
                <q.icon className="size-3" />
                {q.label}
              </button>
            ))}
            <Link
              href="/workspace"
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Table2 className="size-3" />
              Tables
            </Link>
          </div>

          {suggestions.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 px-1">
              {suggestions.slice(0, 5).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border border-dashed px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-solid hover:bg-muted"
                  onClick={() => void runCommand(s.replace(/^Find /i, ""))}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-5 w-full max-w-2xl rounded-2xl border bg-card/60 px-3 py-3">
          <ContributionGraph refreshKey={refreshKey} />
        </div>

        {/* Wide history */}
        <div className="mt-6 w-full max-w-4xl">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            History
          </p>
          {history.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Run a command — tap a card for the change sheet.
            </p>
          ) : (
            <ul className="vexa-scroll-hide mx-auto max-h-[min(50vh,480px)] w-full space-y-2 overflow-y-auto sm:max-w-3xl">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSheetEntry(h);
                      setSheetOpen(true);
                    }}
                    className={cn(
                      "w-full rounded-xl border bg-card px-4 py-3.5 text-left shadow-sm transition-all active:scale-[0.995]",
                      "hover:border-foreground/15 hover:shadow-md",
                      !h.ok && "border-destructive/30"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          h.ok ? "bg-emerald-500" : "bg-destructive"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium leading-snug">
                          {h.summary}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                          {h.prompt}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {h.intent && (
                            <Badge
                              variant="secondary"
                              className="h-4 px-1.5 text-[9px]"
                            >
                              {h.intent}
                            </Badge>
                          )}
                          <time className="font-mono text-[9px] text-muted-foreground">
                            {new Date(h.at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                          <span className="text-[9px] text-muted-foreground">
                            Tap for details
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <HistorySheet
        entry={sheetEntry}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
