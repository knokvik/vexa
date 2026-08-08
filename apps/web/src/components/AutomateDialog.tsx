"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Loader2,
  Mail,
  Radar,
  Search,
  Sunrise,
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
import { LogsDialog } from "@/components/LiveLogsWidget";
import {
  KeywordSearchInput,
  buildKeywordQuery,
} from "@/components/KeywordSearchInput";

export type AutomateMode =
  | "find"
  | "pipeline"
  | "cold_email"
  | "briefing";

type ModeOption = {
  id: AutomateMode;
  title: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
  badge?: string;
  risk: "safe" | "review";
  href?: string;
  action?: "find" | "briefing" | "none";
};

const MODES: ModeOption[] = [
  {
    id: "pipeline",
    title: "Email pipeline CRM",
    description: "Classify emails → graph + stages. No auto-apply.",
    detail:
      "Opens Pipeline. Drop confirmation, screen, rejection, or offer emails. System builds company/contact/job graph and advances stages. You apply and reply yourself.",
    icon: <GitBranch className="size-5" />,
    badge: "Core",
    risk: "safe",
    href: "/pipeline",
  },
  {
    id: "find",
    title: "Find open roles",
    description: "Free boards + ATS discovery only.",
    detail:
      "Searches Remotive, Jobicy, Himalayas, Greenhouse/Lever… No resume tailor. No drafts. Review roles, then apply manually with network intelligence.",
    icon: <Search className="size-5" />,
    badge: "Discover",
    risk: "safe",
    action: "find",
    href: "/jobs",
  },
  {
    id: "cold_email",
    title: "Cold email draft",
    description: "Human outreach to people at target companies.",
    detail:
      "Opens Outreach. Find contacts (free patterns), draft with a real hook, copy to Gmail. Never bulk spam.",
    icon: <Mail className="size-5" />,
    risk: "safe",
    href: "/outreach",
  },
  {
    id: "briefing",
    title: "Morning briefing",
    description: "Interviews, follow-ups, offers.",
    detail:
      "Runs action engine: overdue follow-ups, prep for interviews in 48h, offer decision timers. Email-native CRM only.",
    icon: <Sunrise className="size-5" />,
    risk: "safe",
    action: "briefing",
    href: "/timeline",
  },
];

/**
 * Command sheet — email CRM modes. No tailor / auto-apply.
 */
export function AutomateDialog({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AutomateMode>("pipeline");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [roleQuery, setRoleQuery] = useState("software engineer");
  const [keywords, setKeywords] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);

  const mode = MODES.find((m) => m.id === selected)!;

  async function run() {
    setBusy(true);
    setNote("");
    try {
      if (mode.action === "find") {
        const query =
          buildKeywordQuery(roleQuery, keywords) || "software engineer";
        const res = await fetch("/api/automation/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "find", query }),
        });
        const data = await res.json();
        setNote(
          data.message ||
            `Found ${data.discovered ?? 0} roles. Open Boards to review.`
        );
        if (mode.href) router.push(mode.href);
      } else if (mode.action === "briefing") {
        const res = await fetch("/api/crm/briefing");
        const data = await res.json();
        setNote(data.summary || "Briefing ready.");
        if (mode.href) router.push(mode.href);
      } else if (mode.href) {
        router.push(mode.href);
        setOpen(false);
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="sm"
            className={cn(
              "gap-1.5 rounded-full",
              compact && "px-2.5 text-xs"
            )}
          >
            <Radar className="size-3.5" />
            {compact ? "Go" : "Command"}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Command center</SheetTitle>
            <SheetDescription>
              Email-native job CRM. No auto-apply. No resume tailor. You stay in
              control of every send and submit.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  selected === m.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-muted-foreground">{m.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold">{m.title}</span>
                      {m.badge && (
                        <Badge variant="secondary" className="text-[10px]">
                          {m.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {m.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <Separator className="my-4" />

          <p className="text-xs text-muted-foreground">{mode.detail}</p>

          {mode.id === "find" && (
            <div className="mt-3">
              <KeywordSearchInput
                value={roleQuery}
                onChange={setRoleQuery}
                keywords={keywords}
                onKeywordsChange={setKeywords}
                placeholder="Role"
                keywordsPlaceholder="Keywords"
              />
            </div>
          )}

          {note && (
            <p className="mt-3 text-xs text-muted-foreground">{note}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => void run()}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Continue"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setLogsOpen(true)}
            >
              Logs
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <LogsDialog open={logsOpen} onOpenChange={setLogsOpen} />
    </>
  );
}
