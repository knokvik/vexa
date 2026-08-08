"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VexaLogo } from "@/components/VexaLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PIN = "2580";
const STORAGE_KEY = "vexa_pin_ok_v1";

/**
 * Host unlock — click pad or type 0–9 on the keyboard.
 */
export function PinGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);
  const digitsRef = useRef("");

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

  useEffect(() => {
    digitsRef.current = digits;
  }, [digits]);

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
      const pin = next.slice(0, 4);
      setDigits(pin);
      if (pin.length < 4) return;
      if (pin === PIN) {
        unlock();
      } else {
        setError(true);
        window.setTimeout(() => {
          setDigits("");
          setError(false);
        }, 400);
      }
    },
    [unlock]
  );

  const press = useCallback(
    (d: string) => {
      tryPin(digitsRef.current + d);
    },
    [tryPin]
  );

  const backspace = useCallback(() => {
    setError(false);
    setDigits((d) => d.slice(0, -1));
  }, []);

  // Laptop keyboard: type numbers / backspace / enter
  useEffect(() => {
    if (unlocked || !ready) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        press(e.key);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        backspace();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDigits("");
        setError(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlocked, ready, press, backspace]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" />
    );
  }

  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <VexaLogo size="xl" animated={false} />
        <h1 className="text-xl font-semibold tracking-tight">Unlock Vexa</h1>
        <p className="text-center text-sm text-muted-foreground">
          Type the PIN on your keyboard or tap the pad
        </p>
      </div>

      {/* Visible PIN field for laptop typing feedback */}
      <div
        className={cn(
          "mb-6 flex h-12 w-full max-w-[260px] items-center justify-center gap-3 rounded-2xl border bg-card px-4 shadow-sm",
          error && "border-destructive"
        )}
        aria-label="PIN entry"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 transition-all duration-150",
              digits.length > i
                ? "scale-110 border-foreground bg-foreground"
                : "border-muted-foreground/40",
              error && "border-destructive bg-destructive/30"
            )}
          />
        ))}
      </div>

      <p className="mb-4 font-mono text-xs text-muted-foreground">
        {digits.length}/4
        <span className="ml-2 hidden sm:inline">· keys 0–9 work</span>
      </p>

      <div className="grid w-full max-w-[260px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
          (key, i) => {
            if (key === "") return <div key={i} />;
            if (key === "⌫") {
              return (
                <Button
                  key={i}
                  type="button"
                  variant="ghost"
                  className="h-14 rounded-2xl text-lg"
                  onClick={backspace}
                >
                  ⌫
                </Button>
              );
            }
            return (
              <Button
                key={i}
                type="button"
                variant="secondary"
                className="h-14 rounded-2xl text-xl font-medium active:scale-95"
                onClick={() => press(key)}
              >
                {key}
              </Button>
            );
          }
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive">Incorrect PIN — try again</p>
      )}
    </div>
  );
}
