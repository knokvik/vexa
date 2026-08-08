"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HistoryEntry } from "@/lib/command-history";

/**
 * iPhone Notification Center–style stack.
 * Each card is sticky: as you scroll to see older prompts, upper cards
 * pile at the top (scale/offset), then slide away above.
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
        // Stick lower for cards deeper in the list so they form a visible pile
        const stickRank = Math.min(i, 6);
        const top = 10 + stickRank * 7;
        // Later items render above earlier ones while scrolling
        const z = items.length - i;
        return (
          <div
            key={h.id}
            className="vexa-ios-stack-item"
            style={
              {
                top: `${top}px`,
                zIndex: z,
                ["--stack-i" as string]: stickRank,
              } as React.CSSProperties
            }
          >
            <button
              type="button"
              onClick={() => onSelect(h)}
              className={cn(
                "vexa-ios-stack-card group w-full rounded-[1.15rem] border bg-card/95 px-4 py-3.5 text-left",
                "shadow-[0_8px_28px_rgba(0,0,0,0.10)] backdrop-blur-xl",
                "ring-1 ring-black/[0.06] transition-[transform,box-shadow] duration-200",
                "hover:shadow-[0_12px_36px_rgba(0,0,0,0.14)] active:scale-[0.99]",
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
        );
      })}
      {/* Spacer so last sticky cards can fully stack / unstack */}
      <div className="h-24" aria-hidden />
    </div>
  );
}
