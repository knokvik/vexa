"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  FileText,
  Home,
  Inbox,
  Link2,
  Menu,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@vexa/shared";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { MemoryVaultButton } from "@/components/MemoryVaultButton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

const NAV = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/jobs", label: "Jobs", icon: Briefcase },
  { href: "/inbox", label: "Draft Inbox", icon: Inbox },
  { href: "/onboarding", label: "Profile", icon: UserRound },
  { href: "/connections", label: "Connections", icon: Link2 },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({
  pathname,
  onNavigate,
  vertical,
}: {
  pathname: string;
  onNavigate?: () => void;
  vertical?: boolean;
}) {
  return (
    <nav
      className={cn(
        vertical ? "flex flex-col gap-1" : "hidden items-center gap-1 md:flex"
      )}
    >
      {NAV.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              vertical && "w-full",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isMarketing = pathname === "/welcome";

  if (isMarketing) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="md:hidden">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle>{APP_NAME}</SheetTitle>
                </SheetHeader>
                <Separator className="my-4" />
                <NavLinks pathname={pathname} vertical />
              </SheetContent>
            </Sheet>

            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-mono text-xs font-bold text-primary-foreground">
                Vx
              </span>
              <div className="hidden leading-tight sm:block">
                <div className="text-sm font-semibold tracking-tight">
                  {APP_NAME}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {APP_TAGLINE}
                </div>
              </div>
            </Link>
          </div>

          <NavLinks pathname={pathname} />

          <div className="flex items-center gap-2">
            <MemoryVaultButton />
            <ModeToggle />
            <Button asChild size="sm">
              <Link href="/inbox">Ready to apply</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
