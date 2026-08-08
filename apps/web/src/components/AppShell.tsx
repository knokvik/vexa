"use client";

import { useEffect, useState } from "react";
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
import { APP_NAME } from "@vexa/shared";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { MemoryVaultButton } from "@/components/MemoryVaultButton";
import { VexaLogo } from "@/components/VexaLogo";
import { ModelStatusBadge } from "@/components/ModelStatusBadge";
import { HeaderActivityTicker } from "@/components/HeaderActivityTicker";
import { AutomateDialog } from "@/components/AutomateDialog";
import { FloatingNav } from "@/components/FloatingNav";
import { PinGate } from "@/components/PinGate";
import { PageTransition } from "@/components/PageTransition";
import { SearchProvider } from "@/components/SearchProvider";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  badgeKey: string | null;
};

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home, badgeKey: null },
  { href: "/workspace", label: "Tables", icon: Table2, badgeKey: null },
  { href: "/jobs", label: "Jobs", icon: Briefcase, badgeKey: null },
  { href: "/timeline", label: "Timeline", icon: Inbox, badgeKey: null },
  { href: "/services", label: "Services", icon: Radio, badgeKey: null },
  { href: "/settings", label: "Settings", icon: Settings, badgeKey: null },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("#")) return false;
  if (href === "/settings") {
    return (
      pathname.startsWith("/settings") ||
      pathname.startsWith("/resumes") ||
      pathname.startsWith("/onboarding")
    );
  }
  return pathname.startsWith(href);
}

function NavLinks({
  pathname,
  onNavigate,
  vertical,
  badges,
}: {
  pathname: string;
  onNavigate?: () => void;
  vertical?: boolean;
  badges: Record<string, number>;
}) {
  if (vertical) {
    return (
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const count =
            item.badgeKey && badges[item.badgeKey]
              ? badges[item.badgeKey]
              : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "relative inline-flex w-full items-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-foreground shadow-sm ring-1 ring-black/5 dark:bg-white/95 dark:text-black"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {count > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-0.5" aria-label="Main">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        const count =
          item.badgeKey && badges[item.badgeKey] ? badges[item.badgeKey] : 0;

        const className = cn(
          "vexa-nav-item group relative inline-flex h-9 items-center justify-center overflow-hidden rounded-full",
          "transition-[max-width,padding,gap,background-color,color,box-shadow,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          active
            ? "max-w-[9rem] gap-1.5 bg-white px-3 text-foreground shadow-sm ring-1 ring-black/[0.06] dark:bg-white dark:text-black dark:ring-white/20"
            : "max-w-9 gap-0 bg-transparent px-0 text-muted-foreground hover:text-foreground"
        );

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={className}
            style={{
              minWidth: active ? undefined : 36,
              width: active ? "auto" : 36,
            }}
          >
            <span className="relative inline-flex shrink-0">
              <Icon className="h-[18px] w-[18px]" />
              {count > 0 && !active && (
                <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold leading-none text-primary-foreground">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-[13px] font-medium tracking-tight",
                "transition-[opacity,max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                active
                  ? "max-w-[5rem] opacity-100"
                  : "max-w-0 overflow-hidden opacity-0"
              )}
            >
              {item.label}
            </span>
            {count > 0 && active && (
              <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {count > 99 ? "99+" : count}
              </span>
            )}
            <span className="sr-only">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketing = pathname === "/welcome";
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [appsRes, statsRes] = await Promise.all([
          fetch("/api/applications"),
          fetch("/api/stats/weekly").catch(() => null),
        ]);
        const appsData = await appsRes.json();
        const apps = appsData.applications || [];
        const review = apps.filter(
          (a: { status?: string }) => a.status === "requires_review"
        ).length;
        let outreach = 0;
        if (statsRes?.ok) {
          const s = await statsRes.json();
          outreach = s.stats?.coldEmails?.followUpsDue ?? 0;
        }
        if (!cancelled) {
          setBadges({ inbox: review, outreach });
        }
      } catch {
        /* ignore */
      }
    }
    void load();
    const id = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pathname]);

  if (isMarketing) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      {/* Fixed top bar — does not scroll away */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/40 bg-background/95 pt-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/85 sm:pt-3">
        <div className="vexa-shell relative flex h-12 items-center justify-between gap-2 pb-2 sm:h-14 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              className="vexa-brand flex min-w-0 items-center gap-0.5 text-[18px] leading-none sm:gap-0.5 sm:text-[20px]"
            >
              {/* Tight mark↔wordmark gap (cropped logo + gap-0.5) */}
              <VexaLogo
                size="xl"
                animated
                className="!h-8 !w-8 sm:!h-9 sm:!w-9"
              />
              <span className="vexa-wordmark -ml-0.5 truncate font-semibold leading-none tracking-tight">
                {APP_NAME}
              </span>
            </Link>
          </div>

          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:block">
            <div className="rounded-full bg-muted/70 p-1 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              <NavLinks pathname={pathname} badges={badges} />
            </div>
          </div>

          <div className="relative z-10 flex shrink-0 items-center justify-end gap-1.5">
            <HeaderActivityTicker />
            <div className="flex h-9 items-center gap-0 rounded-full bg-muted/80 p-0.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10 sm:h-10 sm:gap-0.5 sm:p-1">
              <ModelStatusBadge />
              <ModeToggle />
              <div className="hidden sm:block">
                <MemoryVaultButton />
              </div>
              <AutomateDialog compact />
            </div>
          </div>
        </div>
      </header>
      {/* Offset for fixed header height + mobile floating nav */}
      <main className="vexa-shell relative z-0 overflow-x-hidden pb-28 pt-[4.25rem] sm:pb-12 sm:pt-[4.75rem] md:pb-12">
        <PageTransition>{children}</PageTransition>
      </main>
      <FloatingNav />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SearchProvider>
      <PinGate>
        <AppShellInner>{children}</AppShellInner>
      </PinGate>
    </SearchProvider>
  );
}
