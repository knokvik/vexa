"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { APP_NAME } from "@vexa/shared";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { AiActivityIndicator } from "@/components/AiActivityIndicator";
import { VexaLogo } from "@/components/VexaLogo";
import { HeaderActivityTicker } from "@/components/HeaderActivityTicker";
import { FloatingNav } from "@/components/FloatingNav";
import { PinGate } from "@/components/PinGate";
import { PageTransition } from "@/components/PageTransition";
import { SearchProvider } from "@/components/SearchProvider";

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
        <div
          className={cn(
            "relative flex h-12 items-center justify-between gap-2 pb-2 sm:h-14 sm:gap-3",
            pathname === "/"
              ? "w-full max-w-[1720px] mx-auto px-2 sm:px-4 lg:px-6"
              : "vexa-shell"
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              className="vexa-brand flex min-w-0 items-center gap-1 text-[18px] leading-none sm:text-[20px]"
            >
              <VexaLogo size="match" animated />
              <span className="vexa-wordmark truncate font-semibold leading-none tracking-tight">
                {APP_NAME}
              </span>
            </Link>
          </div>

          <div className="relative z-10 flex shrink-0 items-center justify-end gap-1.5">
            <HeaderActivityTicker />
            <div className="flex h-9 items-center gap-0 rounded-full bg-muted/80 p-0.5 shadow-sm ring-1 ring-black/5 dark:ring-white/10 sm:h-10 sm:gap-0.5 sm:p-1">
              <AiActivityIndicator />
              <ModeToggle />
              <Link
                href="/settings"
                title="Settings"
                className="vexa-icon-btn inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
              </Link>
            </div>
          </div>
        </div>
      </header>
      {/* Offset for fixed header height + mobile floating nav */}
      <main
        className={cn(
          "relative z-0 overflow-x-hidden pt-[4.25rem] sm:pt-[4.75rem]",
          pathname === "/"
            ? "w-full max-w-[1720px] mx-auto px-2 sm:px-4 lg:px-6 h-[calc(100dvh-4.25rem)] sm:h-[calc(100dvh-4.75rem)] pb-2 overflow-hidden flex flex-col"
            : "vexa-shell pb-28 sm:pb-12 md:pb-12"
        )}
      >
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
