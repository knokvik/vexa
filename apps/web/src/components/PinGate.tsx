"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VexaLogo } from "@/components/VexaLogo";
import { cn } from "@/lib/utils";

const PIN = "2580";
const STORAGE_KEY = "vexa_pin_ok_v1";

/**
 * Host unlock screen:
 * - Animated Vexa logo
 * - On-screen numpad removed
 * - Auto-opens native numeric keypad on phone load/reload via autoFocused inputMode="numeric"
 */
export function PinGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") {
        setUnlocked(true);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const unlock = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setUnlocked(true);
  }, []);

  const tryPin = useCallback(
    (next: string) => {
      setError(false);
      const clean = next.replace(/\D/g, "").slice(0, 4);
      setDigits(clean);

      if (clean.length < 4) return;

      if (clean === PIN) {
        unlock();
      } else {
        setError(true);
        window.setTimeout(() => {
          setDigits("");
          setError(false);
          inputRef.current?.focus();
        }, 500);
      }
    },
    [unlock]
  );

  // Auto-focus the numeric input on mount and on any reload so the phone keypad pops up immediately
  useEffect(() => {
    if (!unlocked && ready) {
      inputRef.current?.focus();
      const raf = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }
  }, [unlocked, ready]);

  // Keep focus on the hidden numeric input when clicking anywhere on screen
  const handleContainerClick = () => {
    if (!unlocked) {
      inputRef.current?.focus();
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" />
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div
      onClick={handleContainerClick}
      className="relative flex min-h-screen flex-col items-center justify-center bg-background px-6 select-none cursor-pointer"
    >
      {/* Hidden high-priority numeric input to trigger mobile phone numeric keypad on load */}
      <input
        ref={inputRef}
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoFocus
        autoComplete="one-time-code"
        value={digits}
        onChange={(e) => tryPin(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDigits("");
            setError(false);
          }
        }}
        className="sr-only"
        aria-label="Enter PIN"
      />

      {/* Brand & Animated Logo */}
      <div className="mb-8 flex flex-col items-center gap-3.5 text-center">
        <div className="relative flex items-center justify-center">
          {/* Subtle glowing ring behind animated logo */}
          <span className="pointer-events-none absolute size-16 rounded-full bg-primary/10 blur-xl animate-pulse" />
          <VexaLogo size="xl" animated={true} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Unlock Vexa</h1>
        <p className="text-sm text-muted-foreground">
          Enter PIN to access your workspace
        </p>
      </div>

      {/* 4-digit indicator dots */}
      <div
        className={cn(
          "mb-4 flex h-14 w-full max-w-[240px] items-center justify-center gap-4 rounded-2xl border bg-card/60 px-6 backdrop-blur-md shadow-xs transition-all duration-300",
          error
            ? "border-destructive animate-shake shadow-[0_0_15px_rgba(239,68,68,0.25)]"
            : "border-border/80 hover:border-border"
        )}
      >
        {[0, 1, 2, 3].map((i) => {
          const filled = digits.length > i;
          return (
            <div
              key={i}
              className={cn(
                "flex size-4 items-center justify-center rounded-full border-2 transition-all duration-200",
                filled
                  ? "scale-110 border-foreground bg-foreground shadow-xs"
                  : "border-muted-foreground/30 bg-transparent",
                error && "border-destructive bg-destructive/40"
              )}
            />
          );
        })}
      </div>

      <p className="font-mono text-xs text-muted-foreground">
        {digits.length}/4 digits
      </p>

      {error && (
        <p className="mt-3 text-xs font-medium text-destructive animate-fade-in">
          Incorrect PIN — please try again
        </p>
      )}
    </div>
  );
}
