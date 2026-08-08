"use client";

import { useEffect, useState } from "react";
import { VexaLogo } from "@/components/VexaLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PIN = "2580";
const STORAGE_KEY = "vexa_pin_ok_v1";

/**
 * Simple host gate — PIN 2580 (client-side, single-user).
 */
export function PinGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [digits, setDigits] = useState("");
  const [error, setError] = useState(false);

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

  function press(d: string) {
    setError(false);
    const next = (digits + d).slice(0, 4);
    setDigits(next);
    if (next.length === 4) {
      if (next === PIN) {
        try {
          sessionStorage.setItem(STORAGE_KEY, "1");
        } catch {
          /* ignore */
        }
        setUnlocked(true);
      } else {
        setError(true);
        setTimeout(() => setDigits(""), 350);
      }
    }
  }

  function backspace() {
    setError(false);
    setDigits((d) => d.slice(0, -1));
  }

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
        <h1 className="text-xl font-semibold tracking-tight">Enter PIN</h1>
        <p className="text-center text-sm text-muted-foreground">
          Private host gate for this session
        </p>
      </div>

      <div className="mb-8 flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              "flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 transition-colors",
              digits.length > i
                ? "border-foreground bg-foreground"
                : "border-muted-foreground/40",
              error && "border-destructive bg-destructive/20"
            )}
          />
        ))}
      </div>

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
                className="h-14 rounded-2xl text-xl font-medium"
                onClick={() => press(key)}
              >
                {key}
              </Button>
            );
          }
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive">Incorrect PIN</p>
      )}
    </div>
  );
}
