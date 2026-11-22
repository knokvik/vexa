"use client";

import { useEffect, useState } from "react";
import { Bot, Check, Copy, Sparkles, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type AiProvider =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "mistral"
  | "kimi"
  | "grok"
  | "copilot"
  | "cursor"
  | "unknown";

interface AiActivityData {
  provider: AiProvider;
  action: string;
  detail?: string;
  at: number;
}

// ── SVG LOGOS FOR EACH AI PROVIDER ──

function ChatGptIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="ChatGPT"
    >
      <path d="M22.28 9.87a5.98 5.98 0 0 0-.52-4.92 6.05 6.05 0 0 0-4.44-2.83 6.01 6.01 0 0 0-5.32 1.48 6.01 6.01 0 0 0-4.06.35 6.02 6.02 0 0 0-3.32 3.86 6.02 6.02 0 0 0 .8 5.76 5.98 5.98 0 0 0 .52 4.92 6.05 6.05 0 0 0 4.44 2.83 6.01 6.01 0 0 0 5.32-1.48 6.01 6.01 0 0 0 4.06-.35 6.02 6.02 0 0 0 3.32-3.86 6.02 6.02 0 0 0-.8-5.76zm-8.8 11.23a4.5 4.5 0 0 1-2.9-.84l.13-.07 4.8-2.77a.78.78 0 0 0 .39-.68v-6.76l2.03 1.17v5.59a4.52 4.52 0 0 1-4.45 4.36zm-8.4-3.66a4.5 4.5 0 0 1-.54-2.98l.13.08 4.8 2.77c.24.14.54.14.78 0l5.86-3.38v2.35l-4.84 2.8a4.52 4.52 0 0 1-6.19-1.64zm-1.48-9.04a4.5 4.5 0 0 1 2.37-2.14v5.71a.78.78 0 0 0 .39.68l5.85 3.38-2.03 1.17-4.84-2.8a4.52 4.52 0 0 1-1.74-6zm12.3-1.66l-4.8-2.77a.78.78 0 0 0-.78 0l-5.86 3.38v-2.35l4.84-2.8a4.52 4.52 0 0 1 6.6 4.54zm3.5 4.64l-4.84-2.8a.78.78 0 0 0-.78 0l-5.86 3.38v-2.35l4.84-2.8a4.52 4.52 0 0 1 6.64 4.57zm-6.2 3.58l-2.93-1.7 2.93-1.69 2.93 1.69-2.93 1.7z" />
    </svg>
  );
}

function ClaudeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Claude"
    >
      <path d="M13.67 2.12c-.41-.16-.88.02-1.07.41L10.2 7.15l-4.43-1.8c-.42-.17-.89 0-1.07.4-.17.41-.01.89.4 1.07l4.38 1.83-3.63 3.38c-.34.31-.38.83-.09 1.19.3.35.82.4 1.18.11l3.6-3.35.1 4.85c.01.45.38.8.83.81.45.01.82-.35.83-.8l-.1-4.87 3.52 3.44c.33.32.85.3 1.17-.04.32-.34.3-.87-.04-1.19l-3.53-3.46 4.47-1.69c.42-.16.64-.63.48-1.05-.15-.42-.62-.65-1.04-.49l-4.5 1.7 2.37-4.48c.2-.39.04-.87-.36-1.06zm-1.84 9.94l.03 9.42c0 .46.38.82.84.82.45 0 .82-.37.82-.82l-.03-9.42-1.66 0z" />
    </svg>
  );
}

function MistralIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-label="Mistral"
    >
      <rect x="3" y="4" width="3.8" height="3.8" rx="0.6" />
      <rect x="17.2" y="4" width="3.8" height="3.8" rx="0.6" />
      <rect x="3" y="10.1" width="3.8" height="3.8" rx="0.6" />
      <rect x="10.1" y="10.1" width="3.8" height="3.8" rx="0.6" />
      <rect x="17.2" y="10.1" width="3.8" height="3.8" rx="0.6" />
      <rect x="3" y="16.2" width="3.8" height="3.8" rx="0.6" />
      <rect x="17.2" y="16.2" width="3.8" height="3.8" rx="0.6" />
    </svg>
  );
}

function KimiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Kimi"
    >
      <path d="M5 3.5a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 3 0v-5.25l5.88 5.88a1.5 1.5 0 1 0 2.12-2.12L9.62 12l4.88-4.88a1.5 1.5 0 0 0-2.12-2.12L6.5 10.88V5a1.5 1.5 0 0 0-1.5-1.5z" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="18.5" cy="18" r="2" opacity="0.8" />
    </svg>
  );
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Gemini"
    >
      <path d="M12 2C12 7.52 7.52 12 2 12C7.52 12 12 16.48 12 22C12 16.48 16.48 12 22 12C16.48 12 12 7.52 12 2Z" />
    </svg>
  );
}

function GrokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-label="Grok"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const PROVIDER_CONFIG: Record<
  AiProvider,
  {
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    ringColor: string;
    glowClass: string;
    badgeText: string;
  }
> = {
  chatgpt: {
    name: "ChatGPT",
    icon: ChatGptIcon,
    color: "text-[#10a37f]",
    bgColor: "bg-[#10a37f]/15",
    ringColor: "ring-[#10a37f]",
    glowClass: "shadow-[0_0_12px_rgba(16,163,127,0.6)] animate-pulse",
    badgeText: "GPT",
  },
  claude: {
    name: "Claude",
    icon: ClaudeIcon,
    color: "text-[#d97706] dark:text-[#f59e0b]",
    bgColor: "bg-[#d97706]/15",
    ringColor: "ring-[#d97706]",
    glowClass: "shadow-[0_0_12px_rgba(217,119,6,0.6)] animate-pulse",
    badgeText: "Claude",
  },
  mistral: {
    name: "Mistral",
    icon: MistralIcon,
    color: "text-[#f97316]",
    bgColor: "bg-[#f97316]/15",
    ringColor: "ring-[#f97316]",
    glowClass: "shadow-[0_0_12px_rgba(249,115,22,0.6)] animate-pulse",
    badgeText: "Mistral",
  },
  kimi: {
    name: "Kimi",
    icon: KimiIcon,
    color: "text-[#06b6d4]",
    bgColor: "bg-[#06b6d4]/15",
    ringColor: "ring-[#06b6d4]",
    glowClass: "shadow-[0_0_12px_rgba(6,182,212,0.6)] animate-pulse",
    badgeText: "Kimi",
  },
  grok: {
    name: "Grok",
    icon: GrokIcon,
    color: "text-foreground",
    bgColor: "bg-foreground/15",
    ringColor: "ring-foreground",
    glowClass: "shadow-[0_0_12px_rgba(255,255,255,0.7)] animate-pulse",
    badgeText: "Grok",
  },
  gemini: {
    name: "Gemini",
    icon: GeminiIcon,
    color: "text-[#3b82f6]",
    bgColor: "bg-[#3b82f6]/15",
    ringColor: "ring-[#3b82f6]",
    glowClass: "shadow-[0_0_12px_rgba(59,130,246,0.6)] animate-pulse",
    badgeText: "Gemini",
  },
  copilot: {
    name: "Copilot",
    icon: ChatGptIcon,
    color: "text-[#8b5cf6]",
    bgColor: "bg-[#8b5cf6]/15",
    ringColor: "ring-[#8b5cf6]",
    glowClass: "shadow-[0_0_12px_rgba(139,92,246,0.6)] animate-pulse",
    badgeText: "Copilot",
  },
  cursor: {
    name: "Cursor",
    icon: Terminal,
    color: "text-[#14b8a6]",
    bgColor: "bg-[#14b8a6]/15",
    ringColor: "ring-[#14b8a6]",
    glowClass: "shadow-[0_0_12px_rgba(20,184,166,0.6)] animate-pulse",
    badgeText: "Cursor",
  },
  unknown: {
    name: "AI Agent",
    icon: Bot,
    color: "text-primary",
    bgColor: "bg-primary/15",
    ringColor: "ring-primary",
    glowClass: "shadow-[0_0_12px_rgba(120,120,255,0.6)] animate-pulse",
    badgeText: "AI",
  },
};

export function AiActivityIndicator() {
  const [activity, setActivity] = useState<AiActivityData | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [copied, setCopied] = useState(false);

  // Poll for external AI activity from /api/mcp or /api/ai/action
  useEffect(() => {
    let cancelled = false;

    async function checkActivity() {
      try {
        const res = await fetch("/api/ai/activity");
        if (!res.ok) return;
        const data = await res.json();
        if (data.activity && !cancelled) {
          const age = Date.now() - data.activity.at;
          if (age < 25000) {
            setActivity(data.activity);
            setIsActive(true);
          } else {
            setIsActive(false);
          }
        } else if (!cancelled) {
          setIsActive(false);
        }
      } catch {
        // silent fail
      }
    }

    void checkActivity();
    const interval = setInterval(checkActivity, 3000);

    // Also listen to local browser dispatch for instantaneous response
    const handleLocalEvent = (e: Event) => {
      const customEvent = e as CustomEvent<AiActivityData>;
      if (customEvent.detail) {
        setActivity(customEvent.detail);
        setIsActive(true);
      }
    };

    window.addEventListener("vexa-ai-activity", handleLocalEvent);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("vexa-ai-activity", handleLocalEvent);
    };
  }, []);

  // Auto-clear active pulse animation after 15 seconds
  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      setIsActive(false);
    }, 15000);
    return () => clearTimeout(timer);
  }, [isActive, activity?.at]);

  // Trigger preview / test animation manually
  const simulateProvider = async (p: AiProvider) => {
    const fakeData: AiActivityData = {
      provider: p,
      action: "add_task",
      detail: `Task added by ${PROVIDER_CONFIG[p].name}`,
      at: Date.now(),
    };
    setActivity(fakeData);
    setIsActive(true);

    try {
      await fetch("/api/ai/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fakeData),
      });
    } catch {
      // ignore
    }
  };

  const copyMcpUrl = () => {
    const url = `${window.location.origin}/api/mcp`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentProvider = activity?.provider || "chatgpt";
  const conf = PROVIDER_CONFIG[currentProvider] || PROVIDER_CONFIG.unknown;
  const ActiveIcon = conf.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex size-8 sm:size-9 items-center justify-center rounded-full transition-all duration-300",
            isActive
              ? cn(conf.bgColor, conf.color, conf.glowClass, "scale-105")
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title={
            isActive
              ? `${conf.name} is interacting with Vexa`
              : "AI Agent Status (ChatGPT, Claude, Kimi, Mistral)"
          }
        >
          {isActive ? (
            <>
              {/* Rotating / Pulsing halo when active */}
              <span
                className={cn(
                  "pointer-events-none absolute inset-0 rounded-full border-2 border-dashed opacity-60 animate-[spin_6s_linear_infinite]",
                  conf.ringColor
                )}
              />
              {/* Ping notification dot */}
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 size-2 rounded-full",
                  conf.color === "text-[#10a37f]" ? "bg-[#10a37f]" : "bg-primary",
                  "animate-ping"
                )}
              />
              <span
                className={cn(
                  "absolute -right-0.5 -top-0.5 size-2 rounded-full",
                  conf.color === "text-[#10a37f]" ? "bg-[#10a37f]" : "bg-primary"
                )}
              />
              {/* Provider Logo with scale in */}
              <ActiveIcon className="size-4 animate-[bounce_1.5s_infinite]" />
            </>
          ) : (
            <div className="relative flex items-center justify-center">
              <Sparkles className="size-4 transition-transform duration-300 hover:rotate-12 hover:scale-110 text-muted-foreground" />
              {/* Subtle green indicator dot meaning AI service is online */}
              <span className="absolute -bottom-1 -right-1 size-1.5 rounded-full bg-emerald-500/80" />
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72 p-2">
        <DropdownMenuLabel className="flex items-center justify-between text-xs">
          <span className="font-semibold">AI Assistant Integration</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
              isActive
                ? "bg-emerald-500/20 text-emerald-500"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isActive ? "Active Now" : "Ready / Standby"}
          </span>
        </DropdownMenuLabel>

        {isActive && activity && (
          <div className="my-1 rounded-lg border bg-muted/40 p-2 text-xs">
            <div className="flex items-center gap-1.5">
              <ActiveIcon className={cn("size-3.5", conf.color)} />
              <span className="font-semibold text-foreground">{conf.name}</span>
              <span className="text-[10px] text-muted-foreground">
                ({activity.action})
              </span>
            </div>
            {activity.detail && (
              <p className="mt-1 font-mono text-[11px] text-foreground/80 truncate">
                {activity.detail}
              </p>
            )}
            <p className="mt-0.5 text-[9px] text-muted-foreground">
              Interacted {Math.max(1, Math.round((Date.now() - activity.at) / 1000))}s ago
            </p>
          </div>
        )}

        <div className="py-1">
          <p className="px-2 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
            Test AI Logo Animation
          </p>
          <div className="mt-1 grid grid-cols-2 gap-1 px-1">
            <button
              type="button"
              onClick={() => void simulateProvider("chatgpt")}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted text-left"
            >
              <ChatGptIcon className="size-3.5 text-[#10a37f]" />
              <span>ChatGPT</span>
            </button>
            <button
              type="button"
              onClick={() => void simulateProvider("claude")}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted text-left"
            >
              <ClaudeIcon className="size-3.5 text-[#d97706]" />
              <span>Claude</span>
            </button>
            <button
              type="button"
              onClick={() => void simulateProvider("kimi")}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted text-left"
            >
              <KimiIcon className="size-3.5 text-[#06b6d4]" />
              <span>Kimi</span>
            </button>
            <button
              type="button"
              onClick={() => void simulateProvider("mistral")}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted text-left"
            >
              <MistralIcon className="size-3.5 text-[#f97316]" />
              <span>Mistral</span>
            </button>
            <button
              type="button"
              onClick={() => void simulateProvider("grok")}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted text-left col-span-2"
            >
              <GrokIcon className="size-3.5 text-foreground" />
              <span>Grok (xAI)</span>
            </button>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={copyMcpUrl}
          className="flex items-center justify-between cursor-pointer text-xs"
        >
          <span className="flex items-center gap-1.5">
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span>{copied ? "Copied MCP URL!" : "Copy MCP Server URL"}</span>
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">/api/mcp</span>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <a
            href="/api/ai/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between cursor-pointer text-xs"
          >
            <span className="flex items-center gap-1.5">
              <Terminal className="size-3.5" />
              <span>Custom GPT OpenAPI Spec</span>
            </span>
            <span className="text-[10px] text-muted-foreground">↗</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
