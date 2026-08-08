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
 * Centered mark + optional spin.
 * Light mode: pure black mark (transparent bg).
 * Dark mode: pure white mark (transparent bg).
 */
export function VexaLogo({
  size = "md",
  className,
  animated = true,
  variant = "auto",
}: {
  size?: Size;
  className?: string;
  animated?: boolean;
  /** auto = theme-aware; black / white = force mark color */
  variant?: "auto" | "black" | "white";
}) {
  const { box, px } = SIZES[size];

  const blackImg = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.png"
      alt=""
      width={px}
      height={px}
      draggable={false}
      className={cn(
        "pointer-events-none block h-full w-full select-none object-contain",
        variant === "auto" && "dark:hidden",
        variant === "white" && "hidden"
      )}
    />
  );

  const whiteImg = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark-white.png"
      alt=""
      width={px}
      height={px}
      draggable={false}
      className={cn(
        "pointer-events-none block h-full w-full select-none object-contain",
        variant === "auto" && "hidden dark:block",
        variant === "black" && "hidden",
        variant === "white" && "block"
      )}
    />
  );

  return (
    <span
      className={cn(
        "vexa-logo relative inline-flex shrink-0 items-center justify-center align-middle bg-transparent",
        box,
        className
      )}
    >
      <span
        className={cn("relative block h-full w-full", animated && "vexa-logo-spin")}
      >
        {blackImg}
        {whiteImg}
      </span>
      <span className="sr-only">Vexa</span>
    </span>
  );
}
