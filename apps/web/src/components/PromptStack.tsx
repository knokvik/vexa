"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/command-history";

/**
 * iPhone Notification Center–style stack.
 *
 * Structure (critical): each card lives in a **bounded slot**.
 * Sticky only lasts for the slot’s height — so top cards pile, then
 * scroll up and leave the viewport (not permanently pinned).
 * Bottom cards grow in as they enter.
 */
export function PromptStack({
  items,
  onSelect,
  className,
}: {
  items: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  className?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Run a prompt — cards stack here. Tap one for the bottom sheet.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "vexa-ios-stack relative mx-auto w-full max-w-xl",
        className
      )}
    >
      {items.map((h, i) => {
        // Slight top offset so a few cards peek as a pile before the top one leaves
        const pile = Math.min(i, 4);
        const topPx = 8 + pile * 6;
        // Newer (lower index / later in scroll) sits above older while stacking
        const z = 100 + i;

        return (
          <div
            key={h.id}
            className="vexa-ios-stack-slot"
            style={
              {
                zIndex: z,
                ["--pile" as string]: pile,
              } as React.CSSProperties
            }
          >
            <div
              className="vexa-ios-stack-item"
              style={{ top: `${topPx}px`, zIndex: z }}
            >
              <button
                type="button"
                onClick={() => onSelect(h)}
                className={cn(
                  "vexa-ios-stack-card group w-full rounded-[1.15rem] border bg-card/95 px-4 py-3.5 text-left",
                  "shadow-[0_8px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl",
                  "ring-1 ring-black/[0.06]",
                  "dark:bg-card/90 dark:ring-white/10",
                  !h.ok && "border-destructive/35"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full shadow-sm",
                      h.ok ? "bg-emerald-500" : "bg-destructive"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[14px] font-semibold leading-snug tracking-tight">
                      {h.prompt}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                      {h.summary}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
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
                      <span className="text-[9px] text-muted-foreground opacity-0 transition group-hover:opacity-100">
                        Tap for details
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
