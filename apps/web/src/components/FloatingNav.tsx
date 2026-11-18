"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  LayoutGrid,
  Radar,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: LayoutGrid },
  { href: "/workspace", label: "Tables", icon: Table2 },
  { href: "/jobs", label: "Research", icon: Radar },
  { href: "/timeline", label: "Timeline", icon: Clock },
] as const;

/**
 * Floating bottom navigation dock with an instant gliding indicator.
 * On click or hover, the pill slides directly across tabs without delay or collapsing.
 */
export function FloatingNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  // Active path tracking with instant local state
  const [activeHref, setActiveHref] = useState(pathname);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({ left: 0, width: 0, ready: false });

  // Sync active path with pathname changes
  useEffect(() => {
    setActiveHref(pathname);
  }, [pathname]);

  const getActiveTab = () => {
    if (activeHref === "/") return "/";
    const found = ITEMS.find((i) => i.href !== "/" && activeHref.startsWith(i.href));
    return found ? found.href : "/";
  };

  const currentTab = getActiveTab();

  useEffect(() => {
    const updatePosition = () => {
      if (!navRef.current) return;
      const target = navRef.current.querySelector<HTMLElement>(`[data-nav-href="${currentTab}"]`);
      if (target) {
        setIndicatorStyle({
          left: target.offsetLeft,
          width: target.offsetWidth,
          ready: true,
        });
      }
    };

    updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentTab]);

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3"
      aria-label="Pages"
    >
      <div
        ref={navRef}
        className={cn(
          "pointer-events-auto relative flex items-center p-1.5",
          "rounded-full border border-border/70 bg-background/85 shadow-[0_12px_45px_rgba(0,0,0,0.25)]",
          "backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/10 select-none"
        )}
      >
        {/* Continuous Gliding Indicator */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute h-[calc(100%-0.75rem)] rounded-full",
            "bg-foreground shadow-sm ring-1 ring-black/10 dark:bg-white dark:ring-white/20",
            "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            indicatorStyle.ready ? "opacity-100" : "opacity-0"
          )}
          style={{
            transform: `translate3d(${indicatorStyle.left}px, 0, 0)`,
            width: `${indicatorStyle.width}px`,
            top: "0.375rem",
          }}
        />

        {ITEMS.map((item) => {
          const on = currentTab === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              data-nav-href={item.href}
              title={item.label}
              aria-label={item.label}
              onClick={() => {
                // Instantly shift indicator on click for zero-latency glide
                setActiveHref(item.href);
              }}
              className={cn(
                "relative z-10 flex size-9 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200",
                on
                  ? "text-background dark:text-black"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
