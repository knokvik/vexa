"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { ContributionGraph } from "@/components/dashboard/ContributionGraph";
import { TypewriterTitle } from "@/components/TypewriterTitle";
import { PromptStack } from "@/components/PromptStack";
import { HistorySheet } from "@/components/HistorySheet";
import { cn } from "@/lib/utils";
import { useSearchDialog } from "@/components/SearchProvider";
import {
  loadHistory,
  type HistoryEntry,
} from "@/lib/command-history";
import {
  createSession,
  titleFromPrompt,
} from "@/lib/chat-sessions";

const QUICK = [
  {
    label: "Drop email",
    hint: "From: recruiter@company.com\nSubject: Application update\n\nWe received your application…",
    icon: Mail,
  },
  { label: "Find jobs", hint: "software engineer remote", icon: Briefcase },
  { label: "Tables", hint: "What's in my tables?", icon: Table2 },
  { label: "Scrapers", hint: "Service status", icon: Network },
  { label: "Briefing", hint: "Morning briefing", icon: Sparkles },
];

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
  const router = useRouter();
  const { openSearch } = useSearchDialog();
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sheetEntry, setSheetEntry] = useState<HistoryEntry | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micArmed, setMicArmed] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const baseTextRef = useRef("");
  const holdingRef = useRef(false);

  useEffect(() => {
    setHistory(loadHistory());
    void fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setName(d.profile?.fullName?.split(" ")[0] || "Niraj"))
      .catch(() => setName("Niraj"));

    // Refresh prompt list when returning from chat
    const onFocus = () => {
      setHistory(loadHistory());
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  /** New message → open chat; each reply is also saved as a prompt card */
  function openChat(prompt?: string) {
    const q = (prompt ?? text).trim();
    if (!q) return;
    setBusy(true);
    const session = createSession(titleFromPrompt(q));
    router.push(`/chat?id=${session.id}&q=${encodeURIComponent(q)}`);
  }

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
      const n = e instanceof DOMException ? e.name : "";
      if (n === "NotAllowedError" || n === "PermissionDeniedError") {
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

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !listening) {
      e.preventDefault();
      if (text.trim()) openChat();
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
        <TypewriterTitle name={name || "Niraj"} />
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {micArmed
            ? "Mic on — hold the input to speak, release when done"
            : "Type to chat · prompts stack below · tap for details"}
        </p>

        <div className="mt-8 w-full max-w-2xl space-y-3">
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
                      if (!listening) setText(e.target.value);
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
                        : "Ask about tables · add tasks · find jobs…"
                    }
                    className={cn(
                      "min-h-[52px] w-full resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground/70",
                      micArmed && "cursor-pointer select-none",
                      listening && "text-red-700 dark:text-red-300"
                    )}
                    disabled={busy}
                    readOnly={listening}
                  />
                </div>

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
                  title={micArmed ? "Mic on" : "Arm mic"}
                  onClick={(e) => {
                    e.stopPropagation();
                    armMic();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Mic
                    className={cn("size-4", micArmed && "vexa-mic-icon-spin")}
                  />
                </button>

                <Button
                  size="icon"
                  className="mb-0.5 h-9 w-9 shrink-0 rounded-full"
                  disabled={busy || !text.trim()}
                  onClick={(e) => {
                    e.stopPropagation();
                    openChat();
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
                  if (q.label === "Tables") {
                    openChat(q.hint);
                    return;
                  }
                  setText(q.hint);
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
              Workspace
            </Link>
          </div>
        </div>

        <div className="mt-5 w-full max-w-2xl rounded-2xl border bg-card/60 px-3 py-3">
          <ContributionGraph refreshKey={refreshKey} />
        </div>

        {/* iPhone-style stacked prompt list */}
        <div className="mt-6 w-full max-w-xl">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Prompts
          </p>
          <div
            data-prompt-scroll
            className="vexa-scroll-hide max-h-[min(58vh,560px)] overflow-y-auto overflow-x-hidden px-1 pb-6"
          >
            <PromptStack
              items={history}
              onSelect={(h) => {
                setSheetEntry(h);
                setSheetOpen(true);
              }}
            />
          </div>
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
