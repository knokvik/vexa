"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Home,
  Inbox,
  Radio,
  Settings,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/workspace", label: "Tables", icon: Table2 },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/timeline", label: "Timeline", icon: Inbox },
  { href: "/services", label: "Live", icon: Radio },
  { href: "/settings", label: "You", icon: Settings },
] as const;

/**
 * Curved floating page switcher for mobile (replaces hamburger drawer).
 */
export function FloatingNav() {
  const pathname = usePathname();

  function active(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] md:hidden"
      aria-label="Pages"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-full items-end gap-0.5 overflow-x-auto",
          "rounded-[1.75rem] border border-border/60 bg-background/90 px-1.5 py-1.5 shadow-[0_8px_40px_rgba(0,0,0,0.18)]",
          "backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10",
          "vexa-scroll-hide"
        )}
        style={{
          /* soft “curve” feel via asymmetric radius + shadow */
          borderRadius: "1.85rem 1.85rem 1.35rem 1.35rem",
        }}
      >
        {ITEMS.map((item) => {
          const on = active(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[3.1rem] flex-col items-center gap-0.5 rounded-2xl px-2.5 py-1.5 transition-[background-color,color,transform] duration-200 ease-out",
                on
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              <Icon className="size-[18px]" />
              <span className="text-[9px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
