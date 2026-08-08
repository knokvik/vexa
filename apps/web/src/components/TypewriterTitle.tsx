"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Typewriter-style headline. Cycles optional suffixes or types a full phrase once.
 */
export function TypewriterTitle({
  prefix = "What's next",
  name,
  className,
  typeMs = 55,
  holdMs = 2200,
  deleteMs = 32,
}: {
  prefix?: string;
  name?: string;
  className?: string;
  typeMs?: number;
  holdMs?: number;
  deleteMs?: number;
}) {
  const full = name?.trim()
    ? `${prefix}, ${name.trim()}?`
    : `${prefix}?`;

  const [shown, setShown] = useState("");
  const [phase, setPhase] = useState<"type" | "hold" | "delete">("type");

  useEffect(() => {
    setShown("");
    setPhase("type");
  }, [full]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;

    if (phase === "type") {
      if (shown.length < full.length) {
        t = setTimeout(
          () => setShown(full.slice(0, shown.length + 1)),
          typeMs
        );
      } else {
        t = setTimeout(() => setPhase("hold"), holdMs);
      }
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("delete"), holdMs);
    } else {
      // delete
      if (shown.length > 0) {
        t = setTimeout(() => setShown(shown.slice(0, -1)), deleteMs);
      } else {
        t = setTimeout(() => setPhase("type"), 280);
      }
    }

    return () => clearTimeout(t);
  }, [shown, phase, full, typeMs, holdMs, deleteMs]);

  return (
    <h1
      className={cn(
        "text-center text-3xl font-semibold tracking-tight sm:text-4xl",
        className
      )}
      aria-label={full}
    >
      <span>{shown}</span>
      <span
        className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[0.08em] animate-pulse bg-foreground/80 align-middle"
        aria-hidden
      />
    </h1>
  );
}
