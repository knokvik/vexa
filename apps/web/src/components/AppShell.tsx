"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME, APP_TAGLINE } from "@vexa/shared";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/onboarding", label: "Profile" },
  { href: "/connections", label: "Connections" },
  { href: "/jobs", label: "Jobs" },
  { href: "/inbox", label: "Draft Inbox" },
  { href: "/resumes", label: "Resumes" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketing = pathname === "/welcome";

  if (isMarketing) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 font-mono text-sm font-bold text-accent shadow-glow">
              Vx
            </span>
            <div>
              <div className="text-sm font-semibold tracking-tight">{APP_NAME}</div>
              <div className="text-[11px] text-zinc-500">{APP_TAGLINE}</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link href="/inbox" className="btn-primary text-xs md:text-sm">
            Ready to apply
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
