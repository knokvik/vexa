"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Check,
  Loader2,
  Mail,
  Radar,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export type AutomateMode =
  | "find"
  | "find_draft"
  | "cold_email"
  | "full_copilot";

type ModeOption = {
  id: AutomateMode;
  title: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
  badge?: string;
  risk: "safe" | "review" | "elevated";
  href?: string;
  action?: "batch_draft" | "none";
};

const MODES: ModeOption[] = [
  {
    id: "find",
    title: "Job finding only",
    description: "Discover roles with Firecrawl / Exa / official boards.",
    detail:
      "Runs live search tiers (company → portals). No drafts, no emails, no apply. Safest starting point.",
    icon: <Search className="size-5" />,
    badge: "Safest",
    risk: "safe",
    href: "/search",
  },
  {
    id: "find_draft",
    title: "Find + prepare drafts",
    description: "Search, then tailor Ivy-style resumes for strong matches.",
    detail:
      "Uses your profile + preferred template. Packages land in Draft Inbox for one-tap prefill. You still click Submit.",
    icon: <Briefcase className="size-5" />,
    badge: "Recommended",
    risk: "review",
    action: "batch_draft",
    href: "/inbox",
  },
  {
    id: "cold_email",
    title: "Cold email only",
    description: "Personal outreach to people at target companies.",
    detail:
      "Opens Outreach. Draft with a real hook, review, then copy or send. Follow-ups are scheduled — never bulk spam.",
    icon: <Mail className="size-5" />,
    risk: "safe",
    href: "/outreach",
  },
  {
    id: "full_copilot",
    title: "Full co-pilot loop",
    description: "Discover → intel → draft → prefill path.",
    detail:
      "Guided pipeline: find roles, research people/projects, prepare drafts, cold email high-fit companies. No unattended LinkedIn auto-submit.",
    icon: <Radar className="size-5" />,
    badge: "Co-pilot",
    risk: "review",
    href: "/search",
  },
];

/**
 * Professional Automate control — black pill + sheet of automation modes.
 * compact: shorter label on phone so header doesn't overlap the logo.
 */
export function AutomateDialog({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AutomateMode>("find_draft");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const mode = MODES.find((m) => m.id === selected)!;

  async function run() {
    setBusy(true);
    setNote("");
    try {
      if (mode.action === "batch_draft" || mode.id === "full_copilot") {
        const res = await fetch("/api/automation/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: mode.id === "full_copilot" ? "full_copilot" : "find_draft",
            query: "software engineer",
            maxDrafts: 5,
            coldEmails: mode.id === "full_copilot",
          }),
        });
        const data = await res.json();
        const bits = [
          data.discovered != null ? `${data.discovered} found` : null,
          `Prepared ${data.prepared ?? 0} draft(s)`,
          data.outreach?.length
            ? `${data.outreach.length} HR cold email draft(s)`
            : null,
        ].filter(Boolean);
        setNote(`${bits.join(" · ")}. Review in Inbox before apply.`);
        setTimeout(() => {
          setOpen(false);
          router.push(mode.id === "full_copilot" ? "/inbox" : "/inbox");
        }, 1100);
        return;
      }
      if (mode.href) {
        setOpen(false);
        router.push(mode.href);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Something failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          className={cn(
            "h-8 shrink-0 rounded-full bg-primary text-[12px] font-semibold text-primary-foreground shadow-none hover:bg-primary/90 sm:text-[13px]",
            compact ? "px-2.5 sm:px-4" : "px-4"
          )}
        >
          {compact ? (
            <>
              <span className="sm:hidden">Auto</span>
              <span className="hidden sm:inline">Automate</span>
            </>
          ) : (
            "Automate"
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full max-w-full flex-col gap-0 p-0 sm:max-w-md"
      >
        <SheetHeader className="space-y-1 border-b px-5 py-5 text-left">
          <SheetTitle className="text-lg font-semibold tracking-tight">
            Automate
          </SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed">
            Choose what Vexa should run for you. Everything stays review-first —
            the server never clicks Submit on job sites.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {MODES.map((m) => {
            const active = selected === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={cn(
                  "flex w-full gap-3 rounded-2xl border p-3.5 text-left transition-all",
                  active
                    ? "border-foreground/20 bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-white/95 dark:text-black"
                    : "border-border/70 bg-card hover:border-foreground/15 hover:bg-muted/40"
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {m.icon}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold tracking-tight">
                      {m.title}
                    </p>
                    {m.badge && (
                      <Badge
                        variant="secondary"
                        className="rounded-full text-[10px]"
                      >
                        {m.badge}
                      </Badge>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-[12px] leading-snug",
                      active ? "text-black/60" : "text-muted-foreground"
                    )}
                  >
                    {m.description}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  )}
                >
                  {active && <Check className="size-3" />}
                </span>
              </button>
            );
          })}

          <div className="mt-3 rounded-2xl border border-border/70 bg-muted/40 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              How this mode works
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">
              {mode.detail}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <RiskChip risk={mode.risk} />
              {mode.id !== "cold_email" && (
                <Badge variant="outline" className="rounded-full text-[10px]">
                  No LinkedIn auto-submit
                </Badge>
              )}
            </div>
          </div>

          {note && (
            <p className="rounded-xl border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
              {note}
            </p>
          )}
        </div>

        <div className="border-t p-4">
          <Button
            className="h-11 w-full rounded-full text-sm font-semibold"
            disabled={busy}
            onClick={() => void run()}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode.action === "batch_draft"
              ? "Prepare drafts now"
              : mode.id === "find"
                ? "Open live search"
                : mode.id === "cold_email"
                  ? "Open outreach"
                  : "Start co-pilot"}
          </Button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            You stay in control of every submit and every email send.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RiskChip({ risk }: { risk: ModeOption["risk"] }) {
  const map = {
    safe: { label: "Low risk", className: "bg-success/15 text-success" },
    review: {
      label: "Review required",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    },
    elevated: {
      label: "Elevated risk",
      className: "bg-destructive/15 text-destructive",
    },
  }[risk];
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-medium",
        map.className
      )}
    >
      {map.label}
    </span>
  );
}

