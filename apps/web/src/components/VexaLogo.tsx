"use client";

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl" | "match";

/**
 * match = 1em — same height as adjacent text (use next to "Vexa" wordmark).
 */
const SIZES: Record<Size, { box: string; px: number }> = {
  sm: { box: "h-4 w-4", px: 16 },
  md: { box: "h-5 w-5", px: 20 },
  lg: { box: "h-6 w-6", px: 24 },
  xl: { box: "h-10 w-10", px: 40 },
  match: { box: "h-[1em] w-[1em]", px: 18 },
};

/**
 * Centered mark + spin-in-place.
 * Use size="match" beside text so logo height = font size.
 */
export function VexaLogo({
  size = "md",
  className,
  animated = true,
}: {
  size?: Size;
  className?: string;
  animated?: boolean;
  variant?: "auto" | "black" | "white";
}) {
  const { box, px } = SIZES[size];

  return (
    <span
      className={cn(
        "vexa-logo relative inline-flex shrink-0 items-center justify-center align-middle",
        box,
        className
      )}
    >
      <span
        className={cn(
          "block h-full w-full",
          animated && "vexa-logo-spin"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-mark.svg"
          alt=""
          width={px}
          height={px}
          draggable={false}
          className="pointer-events-none block h-full w-full select-none object-contain dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-mark-white.svg"
          alt=""
          width={px}
          height={px}
          draggable={false}
          className="pointer-events-none hidden h-full w-full select-none object-contain dark:block"
        />
      </span>
      <span className="sr-only">Vexa</span>
    </span>
  );
}
