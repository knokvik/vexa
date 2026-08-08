"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  Loader2,
  MessageSquarePlus,
  Mic,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { appendLog, reportActivity } from "@/lib/activity-bus";
import {
  appendMessage,
  createSession,
  getSession,
  titleFromPrompt,
  upsertSession,
  type ChatMsg,
  type ChatSession,
} from "@/lib/chat-sessions";
import { pushHistory } from "@/lib/command-history";

type ChatApiResult = {
  ok?: boolean;
  reply?: string;
  working?: string[];
  steps?: Array<{ intent: string; reply: string; ok: boolean }>;
  result?: Record<string, unknown>;
  suggestions?: string[];
  error?: string;
  navigate?: string;
};

function ChatPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const sessionIdParam = search.get("id") || "";
  const seedParam = search.get("q") || "";

  const [session, setSession] = useState<ChatSession | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [micArmed, setMicArmed] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [showWorking, setShowWorking] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const seedSent = useRef(false);
  const recRef = useRef<{
    stop: () => void;
    start: () => void;
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
    onerror: ((ev: { error: string }) => void) | null;
    onend: (() => void) | null;
  } | null>(null);
  const baseTextRef = useRef("");
  const holdingRef = useRef(false);

  type SpeechRecognitionEventLike = {
    resultIndex: number;
    results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
  };

  // Boot session from ?id= or create new
  useEffect(() => {
    let s: ChatSession | null = null;
    if (sessionIdParam) {
      s = getSession(sessionIdParam);
    }
    if (!s) {
      s = createSession(seedParam ? titleFromPrompt(seedParam) : "New chat");
      router.replace(`/chat?id=${s.id}${seedParam ? `&q=${encodeURIComponent(seedParam)}` : ""}`, {
        scroll: false,
      });
    }
    setSession(s);
  }, [sessionIdParam, seedParam, router]);

  // Auto-send seed query once
  useEffect(() => {
    if (!session || !seedParam || seedSent.current) return;
    if (session.messages.length > 0) {
      seedSent.current = true;
      return;
    }
    seedSent.current = true;
    void sendMessage(seedParam, session.id);
    // clear q from URL after seed
    router.replace(`/chat?id=${session.id}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, seedParam]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length, busy]);

  const messages = session?.messages || [];

  const historyPayload = useMemo(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    [messages]
  );

  async function sendMessage(raw: string, sid?: string) {
    const payload = raw.trim();
    const id = sid || session?.id;
    if (!payload || !id || busy) return;

    setBusy(true);
    setText("");
    setInterim("");
    reportActivity({
      tool: "chat",
      action: payload.slice(0, 56),
      status: "running",
    });

    // Optimistic user message
    let s = appendMessage(id, { role: "user", content: payload });
    if (!s) {
      s = createSession(titleFromPrompt(payload));
      s = appendMessage(s.id, { role: "user", content: payload });
      if (s) router.replace(`/chat?id=${s.id}`, { scroll: false });
    }
    if (s) setSession({ ...s });

    try {
      const res = await fetch("/api/crm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: payload,
          history: historyPayload,
        }),
      });
      const data = (await res.json()) as ChatApiResult;
      const reply =
        data.reply || data.error || "I couldn't complete that.";
      const intents = (data.steps || []).map((x) => x.intent);
      const next = appendMessage(id, {
        role: "assistant",
        content: reply,
        working: data.working,
        intents: intents.length ? intents : undefined,
        ok: data.ok !== false && !data.error,
        result: data.result,
      });
      if (next) {
        // refresh title
        const titled = {
          ...next,
          title: titleFromPrompt(
            next.messages.find((m) => m.role === "user")?.content || next.title
          ),
        };
        setSession(upsertSession(titled));
      }
      // One prompt card on home (iOS stack) — not full session list
      pushHistory({
        prompt: payload.slice(0, 400),
        summary: reply.slice(0, 200),
        intent: intents[0] || "chat",
        ok: data.ok !== false && !data.error,
        working: data.working,
        result: data.result,
      });
      if (data.suggestions) setSuggestions(data.suggestions);
      reportActivity({
        tool: "chat",
        action: reply.slice(0, 64),
        status: data.error ? "error" : "done",
      });
      appendLog({
        kind: intents[0] || "chat",
        message: reply.slice(0, 120),
        status: data.error ? "error" : "done",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      const next = appendMessage(id, {
        role: "assistant",
        content: msg,
        ok: false,
      });
      if (next) setSession(next);
      pushHistory({
        prompt: payload.slice(0, 400),
        summary: msg,
        ok: false,
      });
      reportActivity({ tool: "chat", action: msg, status: "error" });
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !listening) {
      e.preventDefault();
      void sendMessage(text);
    }
  }

  function newChat() {
    const s = createSession("New chat");
    seedSent.current = true;
    setSession(s);
    setText("");
    setSuggestions([]);
    router.push(`/chat?id=${s.id}`);
  }

  // Mic (same pattern as home — compact)
  function getRecognition() {
    if (typeof window === "undefined") return null;
    const W = window as unknown as {
      SpeechRecognition?: new () => NonNullable<typeof recRef.current>;
      webkitSpeechRecognition?: new () => NonNullable<typeof recRef.current>;
    };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    return Ctor ? new Ctor() : null;
  }

  async function startListen() {
    if (!micArmed || listening) return;
    holdingRef.current = true;
    const rec = getRecognition();
    if (!rec) return;
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
      } else setInterim(interimChunk);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* ignore */
    }
  }

  function stopListen() {
    holdingRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
    setInterim("");
  }

  const displayValue = listening
    ? `${text}${text && interim ? " " : ""}${interim}`
    : text;

  if (!session) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Opening chat…
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.5rem)] w-full max-w-3xl flex-col sm:h-[calc(100dvh-6rem)]">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b px-1 pb-3">
        <Link
          href="/"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Home"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{session.title}</p>
          <p className="text-[11px] text-muted-foreground">
            Multi-step CRM chat · tables, tasks, jobs
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 rounded-full text-xs"
          onClick={newChat}
        >
          <MessageSquarePlus className="size-3.5" />
          New
        </Button>
      </div>

      {/* Messages */}
      <div className="vexa-scroll-hide min-h-0 flex-1 space-y-3 overflow-y-auto px-1 py-4">
        {messages.length === 0 && !busy && (
          <div className="rounded-2xl border border-dashed bg-muted/20 px-4 py-8 text-center">
            <Sparkles className="mx-auto mb-2 size-5 text-muted-foreground" />
            <p className="text-sm font-medium">Chat with Vexa</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask about your tables, add tasks, find jobs — multiple actions in
              one message.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {[
                "What's in my tables?",
                "List my tasks",
                "Find remote software engineer jobs",
                "Add task: follow up Stripe then list tasks",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  className="rounded-full border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => void sendMessage(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            expanded={showWorking === m.id}
            onToggleWorking={() =>
              setShowWorking((id) => (id === m.id ? null : m.id))
            }
          />
        ))}

        {busy && (
          <div className="flex items-center gap-2 rounded-2xl border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Working — may run multiple tools…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-1.5 px-1 pb-2">
          {suggestions.slice(0, 4).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              className="rounded-full border border-dashed px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-solid hover:bg-muted"
              onClick={() => void sendMessage(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div
        className={cn(
          "vexa-glow-border shrink-0 rounded-3xl bg-card shadow-lg ring-1 ring-black/5 dark:ring-white/10",
          listening && "is-listening is-active"
        )}
        onPointerDown={(e) => {
          if (!micArmed) return;
          const t = e.target as HTMLElement;
          if (t.closest("button")) return;
          e.preventDefault();
          void startListen();
        }}
        onPointerUp={() => micArmed && stopListen()}
        onPointerLeave={() => micArmed && listening && stopListen()}
      >
        <div className="flex items-end gap-1.5 px-3 py-3 sm:px-4">
          <textarea
            ref={taRef}
            value={displayValue}
            onChange={(e) => !listening && setText(e.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.min(5, Math.max(1, displayValue.split("\n").length))}
            placeholder="Ask about tables, add tasks, find jobs…"
            className="min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-muted-foreground/70"
            disabled={busy}
            readOnly={listening}
          />
          <button
            type="button"
            className={cn(
              "mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2",
              micArmed
                ? "border-red-500 bg-red-500/10 text-red-600"
                : "border-border text-muted-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              setMicArmed((a) => !a);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Mic className="size-4" />
          </button>
          <Button
            size="icon"
            className="mb-0.5 h-9 w-9 shrink-0 rounded-full"
            disabled={busy || !text.trim()}
            onClick={(e) => {
              e.stopPropagation();
              void sendMessage(text);
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
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  expanded,
  onToggleWorking,
}: {
  msg: ChatMsg;
  expanded: boolean;
  onToggleWorking: () => void;
}) {
  const isUser = msg.role === "user";
  const jobs = (msg.result?.jobs as Array<{
    id: string;
    title: string;
    company: string;
    url?: string;
  }>) || [];

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[85%]",
          isUser
            ? "bg-foreground text-background"
            : "border bg-card text-foreground",
          msg.ok === false && !isUser && "border-destructive/40"
        )}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>

        {!isUser && msg.intents && msg.intents.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {msg.intents.map((intent, i) => (
              <Badge
                key={`${intent}-${i}`}
                variant="secondary"
                className="h-4 px-1.5 text-[9px]"
              >
                {intent}
              </Badge>
            ))}
          </div>
        )}

        {!isUser && jobs.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-border/50 pt-2">
            {jobs.slice(0, 5).map((j) => (
              <li key={j.id} className="text-xs">
                <strong>{j.title}</strong>
                <span className="text-muted-foreground"> · {j.company}</span>
                {j.url && (
                  <a
                    href={j.url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 underline"
                  >
                    Open
                  </a>
                )}
              </li>
            ))}
            <li>
              <Link href="/jobs" className="text-xs font-medium underline">
                All jobs →
              </Link>
            </li>
          </ul>
        )}

        {!isUser && msg.working && msg.working.length > 0 && (
          <button
            type="button"
            onClick={onToggleWorking}
            className="mt-2 text-[10px] font-medium text-muted-foreground underline"
          >
            {expanded ? "Hide steps" : "Show steps"}
          </button>
        )}
        {expanded && msg.working && (
          <ul className="mt-1.5 space-y-0.5 border-t border-border/40 pt-1.5 font-mono text-[10px] text-muted-foreground">
            {msg.working.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Loading chat…
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
