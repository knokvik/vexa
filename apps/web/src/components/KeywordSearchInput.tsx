"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Merge free-form keywords into a processable search query */
export function buildKeywordQuery(primary: string, keywords: string): string {
  const p = primary.trim();
  const k = keywords
    .split(/[,|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!p && !k.length) return "";
  if (!k.length) return p;
  if (!p) return k.join(" ");
  // Avoid duplicating tokens already in primary
  const lower = p.toLowerCase();
  const extra = k.filter((t) => !lower.includes(t.toLowerCase()));
  return extra.length ? `${p} ${extra.join(" ")}` : p;
}

const DEFAULT_CHIPS = [
  "software engineer",
  "backend",
  "frontend",
  "intern",
  "quant",
  "data engineer",
  "new grad",
  "remote",
];

type Props = {
  /** Main search / role text */
  value: string;
  onChange: (v: string) => void;
  /** Optional extra keywords (comma-separated) */
  keywords?: string;
  onKeywordsChange?: (v: string) => void;
  onSubmit?: (combinedQuery: string) => void;
  placeholder?: string;
  keywordsPlaceholder?: string;
  disabled?: boolean;
  submitLabel?: string;
  showSubmit?: boolean;
  showChips?: boolean;
  chips?: string[];
  className?: string;
  /** Compact single-line mode (jobs bar) */
  compact?: boolean;
  autoFocus?: boolean;
};

/**
 * Keyword search field used on every search surface.
 * Free text + optional keywords + browser voice-to-text (Web Speech API).
 */
export function KeywordSearchInput({
  value,
  onChange,
  keywords = "",
  onKeywordsChange,
  onSubmit,
  placeholder = "Role or search phrase…",
  keywordsPlaceholder = "Extra keywords: C++, remote, intern…",
  disabled,
  submitLabel = "Search",
  showSubmit = true,
  showChips = true,
  chips = DEFAULT_CHIPS,
  className,
  compact,
  autoFocus,
}: Props) {
  const [listening, setListening] = useState(false);
  const [voiceTarget, setVoiceTarget] = useState<"main" | "keywords">("main");
  const [voiceError, setVoiceError] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const baseRef = useRef({ main: "", keywords: "" });

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognition()));
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stopVoice = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const startVoice = useCallback(
    (target: "main" | "keywords") => {
      const Ctor = getSpeechRecognition();
      if (!Ctor) {
        setVoiceError("Voice not supported in this browser. Use Chrome or Edge.");
        return;
      }
      setVoiceError("");
      setVoiceTarget(target);
      baseRef.current = { main: value, keywords };

      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }

      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (ev) => {
        let finalChunk = "";
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0]?.transcript || "";
          if (ev.results[i].isFinal) finalChunk += t;
          else interim += t;
        }
        const spoken = (finalChunk || interim).trim();
        if (!spoken) return;
        if (target === "main") {
          const base = baseRef.current.main;
          const next = finalChunk
            ? `${base}${base && !base.endsWith(" ") ? " " : ""}${finalChunk.trim()}`
            : `${base}${base && !base.endsWith(" ") ? " " : ""}${interim}`.trimStart();
          onChange(next);
          if (finalChunk) {
            baseRef.current.main = next.trim() + " ";
          }
        } else if (onKeywordsChange) {
          const base = baseRef.current.keywords;
          const next = finalChunk
            ? `${base}${base && !base.endsWith(" ") && !base.endsWith(",") ? ", " : ""}${finalChunk.trim()}`
            : `${base}${base ? " " : ""}${interim}`.trimStart();
          onKeywordsChange(next);
          if (finalChunk) {
            baseRef.current.keywords = next.trim() + ", ";
          }
        }
      };
      rec.onerror = (ev) => {
        setListening(false);
        if (ev.error === "not-allowed") {
          setVoiceError("Microphone blocked — allow mic access in browser settings.");
        } else if (ev.error !== "aborted" && ev.error !== "no-speech") {
          setVoiceError(`Voice error: ${ev.error || "unknown"}`);
        }
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
      try {
        rec.start();
        setListening(true);
      } catch {
        setVoiceError("Could not start microphone.");
        setListening(false);
      }
    },
    [keywords, onChange, onKeywordsChange, value]
  );

  function toggleVoice(target: "main" | "keywords") {
    if (listening && voiceTarget === target) {
      stopVoice();
      return;
    }
    if (listening) stopVoice();
    startVoice(target);
  }

  function submit() {
    const combined = buildKeywordQuery(value, keywords);
    onSubmit?.(combined);
  }

  function addChip(chip: string) {
    if (onKeywordsChange) {
      const parts = keywords
        .split(/[,|]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.some((p) => p.toLowerCase() === chip.toLowerCase())) return;
      onKeywordsChange(parts.length ? `${parts.join(", ")}, ${chip}` : chip);
    } else {
      // No separate keywords field — set main query
      onChange(chip);
    }
  }

  if (compact) {
    return (
      <div className={cn("space-y-1.5", className)}>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              disabled={disabled}
              autoFocus={autoFocus}
              className="h-9 pl-8 pr-10 text-[13px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {voiceSupported && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleVoice("main")}
                className={cn(
                  "absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors",
                  listening && voiceTarget === "main"
                    ? "bg-destructive/15 text-destructive"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={listening ? "Stop listening" : "Voice to text"}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
              >
                {listening && voiceTarget === "main" ? (
                  <MicOff className="size-3.5" />
                ) : (
                  <Mic className="size-3.5" />
                )}
              </button>
            )}
          </div>
          {showSubmit && (
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0"
              disabled={disabled || !buildKeywordQuery(value, keywords)}
              onClick={submit}
            >
              {disabled ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Search className="size-3.5" />
              )}
              {submitLabel}
            </Button>
          )}
        </div>
        {onKeywordsChange && (
          <div className="relative">
            <Input
              value={keywords}
              onChange={(e) => onKeywordsChange(e.target.value)}
              placeholder={keywordsPlaceholder}
              disabled={disabled}
              className="h-8 pr-9 text-[12px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {voiceSupported && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleVoice("keywords")}
                className={cn(
                  "absolute right-1 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full",
                  listening && voiceTarget === "keywords"
                    ? "text-destructive"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Dictate keywords"
              >
                {listening && voiceTarget === "keywords" ? (
                  <MicOff className="size-3" />
                ) : (
                  <Mic className="size-3" />
                )}
              </button>
            )}
          </div>
        )}
        {listening && (
          <p className="flex items-center gap-1.5 text-[10px] text-destructive">
            <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
            Listening… speak your {voiceTarget === "keywords" ? "keywords" : "search"}
          </p>
        )}
        {voiceError && (
          <p className="text-[10px] text-destructive">{voiceError}</p>
        )}
        {showChips && (
          <div className="flex flex-wrap gap-1">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={disabled}
                onClick={() => addChip(chip)}
                className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            className="h-9 pl-8 pr-10 text-[13px]"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          {voiceSupported && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => toggleVoice("main")}
              className={cn(
                "absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors",
                listening && voiceTarget === "main"
                  ? "bg-destructive/15 text-destructive"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={listening ? "Stop listening" : "Voice to text"}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
            >
              {listening && voiceTarget === "main" ? (
                <MicOff className="size-3.5" />
              ) : (
                <Mic className="size-3.5" />
              )}
            </button>
          )}
        </div>
        {showSubmit && (
          <Button
            type="button"
            size="sm"
            className="h-9 shrink-0"
            disabled={disabled || !buildKeywordQuery(value, keywords)}
            onClick={submit}
          >
            {disabled ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
            {submitLabel}
          </Button>
        )}
      </div>

      {onKeywordsChange && (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Keywords to process
            </p>
            {keywords.trim() && (
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                onClick={() => onKeywordsChange("")}
              >
                <X className="size-2.5" /> Clear
              </button>
            )}
          </div>
          <div className="relative">
            <Input
              value={keywords}
              onChange={(e) => onKeywordsChange(e.target.value)}
              placeholder={keywordsPlaceholder}
              disabled={disabled}
              className="h-9 pr-10 text-[13px]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            {voiceSupported && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleVoice("keywords")}
                className={cn(
                  "absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors",
                  listening && voiceTarget === "keywords"
                    ? "bg-destructive/15 text-destructive"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title="Dictate keywords"
                aria-label="Dictate keywords"
              >
                {listening && voiceTarget === "keywords" ? (
                  <MicOff className="size-3.5" />
                ) : (
                  <Mic className="size-3.5" />
                )}
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Comma-separated. Combined with the role above before search.
          </p>
        </div>
      )}

      {listening && (
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-destructive">
          <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
          Listening… speak your{" "}
          {voiceTarget === "keywords" ? "keywords" : "search phrase"}
        </p>
      )}
      {voiceError && (
        <p className="text-[11px] text-destructive">{voiceError}</p>
      )}
      {!voiceSupported && (
        <p className="text-[10px] text-muted-foreground">
          Voice input needs Chrome or Edge with microphone permission.
        </p>
      )}

      {showChips && (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={disabled}
              onClick={() => addChip(chip)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
