"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  PlatformConnection,
  PlatformDefinition,
  PlatformId,
  SyncRunReport,
} from "@vexa/shared";
import {
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type EnvKeyStatus = {
  name: string;
  set: boolean;
  kind: "id" | "secret" | "url" | "other";
};

type OAuthStatus = {
  oauthConfigured: boolean;
  oauthSupported: boolean;
  setupHint?: string;
  steps?: string[];
  consoleUrl?: string;
  consoleLabel?: string;
  callbackUrl?: string;
  envKeys?: EnvKeyStatus[];
  scopes?: string[];
  envSnippet?: string;
  notes?: string[];
};

type PlatformsResponse = {
  catalog: PlatformDefinition[];
  platforms: (PlatformConnection & { hasServerTokens?: boolean })[];
  oauth?: Record<PlatformId, OAuthStatus>;
  appEnv?: {
    appUrl: string;
    keys: EnvKeyStatus[];
    ready: boolean;
    envPath: string;
  };
  setup?: {
    readyCount: number;
    missingCount: number;
    readyProviders: string[];
    missingProviders: string[];
    docsPath: string;
  };
  syncBeforeApply: boolean;
  connectedCount: number;
  syncEnabledCount: number;
  staleCount: number;
  maxAgeHours: number;
  lastSyncReport: SyncRunReport | null;
};

function KeyRow({ k }: { k: EnvKeyStatus }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs">
      <code className="truncate font-mono text-[11px]">{k.name}</code>
      {k.set ? (
        <Badge variant="success" className="shrink-0 gap-1 text-[10px]">
          <CheckCircle2 className="size-3" /> set
        </Badge>
      ) : (
        <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
          <Circle className="size-3" /> missing
        </Badge>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 gap-1 text-[11px]"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        });
      }}
    >
      <Copy className="size-3" />
      {ok ? "Copied" : label || "Copy"}
    </Button>
  );
}

function SetupPanel({ oauth }: { oauth: OAuthStatus }) {
  if (!oauth.oauthSupported) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Not available yet</p>
        <p className="mt-1">{oauth.setupHint}</p>
        {oauth.steps?.length ? (
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            {oauth.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold">
          {oauth.oauthConfigured ? "Ready to connect" : "Setup checklist"}
        </p>
        {oauth.oauthConfigured ? (
          <Badge variant="success" className="text-[10px]">
            env OK
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            needs .env.local
          </Badge>
        )}
      </div>

      {oauth.envKeys?.length ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Env vars (apps/web/.env.local)
          </p>
          {oauth.envKeys.map((k) => (
            <KeyRow key={k.name} k={k} />
          ))}
        </div>
      ) : null}

      {oauth.callbackUrl && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Callback URL (paste in provider dashboard)
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full flex-1 truncate rounded-md border bg-background px-2 py-1.5 font-mono text-[10px]">
              {oauth.callbackUrl}
            </code>
            <CopyButton text={oauth.callbackUrl} label="Copy URL" />
          </div>
        </div>
      )}

      {oauth.scopes?.length ? (
        <div className="flex flex-wrap gap-1">
          {oauth.scopes.map((s) => (
            <Badge key={s} variant="outline" className="font-mono text-[10px]">
              {s}
            </Badge>
          ))}
        </div>
      ) : null}

      {oauth.consoleUrl && (
        <Button asChild size="sm" variant="secondary" className="h-8 w-full">
          <a href={oauth.consoleUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-3.5" />
            {oauth.consoleLabel || "Open developer console"}
          </a>
        </Button>
      )}

      {oauth.steps?.length ? (
        <ol className="list-decimal space-y-1.5 pl-4 text-[11px] leading-snug text-muted-foreground">
          {oauth.steps.map((s, i) => (
            <li key={i}>
              <span className="text-foreground/90">{s}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {oauth.envSnippet && !oauth.oauthConfigured && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Paste into .env.local
            </p>
            <CopyButton text={oauth.envSnippet} label="Copy snippet" />
          </div>
          <pre className="overflow-x-auto rounded-md border bg-background p-2 font-mono text-[10px] text-muted-foreground">
            {oauth.envSnippet}
          </pre>
        </div>
      )}

      {oauth.notes?.length ? (
        <ul className="space-y-0.5 text-[10px] text-muted-foreground">
          {oauth.notes.map((n) => (
            <li key={n}>• {n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function ConnectionsClient() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PlatformsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/platforms");
    const json = await res.json();
    setData(json);
    // Auto-expand providers that still need setup
    const next: Record<string, boolean> = {};
    for (const [id, o] of Object.entries(
      (json.oauth || {}) as Record<string, OAuthStatus>
    )) {
      if (o.oauthSupported && !o.oauthConfigured) next[id] = true;
    }
    setExpanded((prev) => ({ ...next, ...prev }));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ok = searchParams.get("oauth_success");
    const err = searchParams.get("oauth_error");
    if (ok) {
      setNote(
        `Connected ${ok} with real OAuth. Profile synced from the provider.`
      );
      void load();
    }
    if (err) setNote(`OAuth error: ${err}`);
  }, [searchParams, load]);

  function startOAuth(platformId: PlatformId) {
    const oauth = data?.oauth?.[platformId as keyof typeof data.oauth];
    if (oauth && oauth.oauthSupported && !oauth.oauthConfigured) {
      setNote(
        `${platformId}: add ${platformId.toUpperCase()}_CLIENT_ID and _CLIENT_SECRET to apps/web/.env.local, restart the server, then click Connect again. You will be sent to ${platformId} to approve access.`
      );
      setExpanded((e) => ({ ...e, [platformId]: true }));
      return;
    }
    // Full browser navigation → real LinkedIn/GitHub/Google/X permission screen
    setNote(`Redirecting to ${platformId} for permission…`);
    window.location.assign(`/api/oauth/${platformId}/start`);
  }

  async function disconnect(platformId: PlatformId) {
    setBusy(platformId);
    await fetch("/api/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect", platformId }),
    });
    setBusy(null);
    setNote(`Disconnected ${platformId}. Tokens removed.`);
    await load();
  }

  async function toggleSync(platformId: PlatformId, syncEnabled: boolean) {
    setBusy(platformId);
    const res = await fetch("/api/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_sync", platformId, syncEnabled }),
    });
    const json = await res.json();
    setBusy(null);
    if (json.error) setNote(json.error);
    await load();
  }

  async function setSyncBeforeApply(syncBeforeApply: boolean) {
    setBusy("global");
    await fetch("/api/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_sync_before_apply", syncBeforeApply }),
    });
    setBusy(null);
    await load();
  }

  async function runSyncNow() {
    setBusy("sync");
    setNote("");
    const res = await fetch("/api/platforms/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true }),
    });
    const json = await res.json();
    setBusy(null);
    const n = json.report?.results?.length ?? 0;
    setNote(
      json.report?.skipped
        ? json.report.skipReason
        : `Synced ${n} platform(s) with live APIs where tokens exist.`
    );
    await load();
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading connections…
      </div>
    );
  }

  const byId = Object.fromEntries(
    data.platforms.map((p) => [p.platformId, p])
  ) as Record<PlatformId, PlatformConnection & { hasServerTokens?: boolean }>;

  const missing = data.setup?.missingCount ?? 0;
  const ready = data.setup?.readyCount ?? 0;
  const appUrl = data.appEnv?.appUrl || "http://127.0.0.1:5173";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connections"
        title="Connect platforms"
        description={`OAuth for GitHub, Google, LinkedIn, X. Tokens stay server-side. Daily sync every ${data.maxAgeHours}h + before drafts when enabled.`}
        actions={
          <Button disabled={busy === "sync"} onClick={() => void runSyncNow()}>
            {busy === "sync" ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Sync now
          </Button>
        }
      />

      {note && (
        <Alert>
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      )}

      {/* Setup overview */}
      {missing > 0 ? (
        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertTitle>
            Setup: {ready}/4 OAuth providers ready · {missing} need credentials
          </AlertTitle>
          <AlertDescription className="mt-2 space-y-2 text-sm">
            <p>
              Add keys to{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {data.appEnv?.envPath || "apps/web/.env.local"}
              </code>
              , then <strong>restart the dev server</strong>. Full guide:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {data.setup?.docsPath || "docs/OAUTH_SETUP.md"}
              </code>
            </p>
            <p>
              Callback base:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {appUrl}
              </code>
              {data.appEnv?.keys?.some((k) => !k.set) ? (
                <span className="text-warning">
                  {" "}
                  — also set{" "}
                  {data.appEnv.keys
                    .filter((k) => !k.set)
                    .map((k) => k.name)
                    .join(", ")}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(data.setup?.missingProviders || []).map((id) => (
                <Badge key={id} variant="secondary" className="font-mono text-[10px]">
                  {id}: not configured
                </Badge>
              ))}
              {(data.setup?.readyProviders || []).map((id) => (
                <Badge key={id} variant="success" className="font-mono text-[10px]">
                  {id}: ready
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle2 className="size-4 text-success" />
          <AlertTitle>All 4 OAuth providers configured</AlertTitle>
          <AlertDescription>
            Click <strong>Connect with OAuth</strong> on a card below. Callbacks
            use{" "}
            <code className="rounded bg-muted px-1 text-xs">{appUrl}</code>.
          </AlertDescription>
        </Alert>
      )}

      {/* Global env status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. App env (required for any OAuth)</CardTitle>
          <CardDescription>
            Shared settings in{" "}
            <code className="text-xs">{data.appEnv?.envPath}</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {(data.appEnv?.keys || []).map((k) => (
              <KeyRow key={k.name} k={k} />
            ))}
          </div>
          <div className="rounded-md border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-sans font-medium uppercase tracking-wide text-muted-foreground">
                Example block
              </span>
              <CopyButton
                text={`NEXT_PUBLIC_APP_URL=${appUrl}\nAPP_URL=${appUrl}\nOAUTH_STATE_SECRET=generate-a-long-random-string`}
                label="Copy"
              />
            </div>
            <pre className="whitespace-pre-wrap">{`NEXT_PUBLIC_APP_URL=${appUrl}
APP_URL=${appUrl}
OAUTH_STATE_SECRET=generate-a-long-random-string`}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            After editing env: stop and restart{" "}
            <code className="rounded bg-muted px-1">next dev</code> on port
            5173. Env is only read at process start.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Connected", value: data.connectedCount },
          { label: "Daily sync on", value: data.syncEnabledCount },
          { label: "Stale now", value: data.staleCount },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="font-mono text-3xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label className="text-base">Sync before draft / apply</Label>
            <p className="text-sm text-muted-foreground">
              When on, stale OAuth connections refresh from live APIs before
              resume generation.
            </p>
          </div>
          <Switch
            checked={data.syncBeforeApply}
            disabled={busy === "global"}
            onCheckedChange={(v) => void setSyncBeforeApply(v)}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-tight">
          2. Providers — expand for setup steps
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {data.catalog.map((plat) => {
            const conn = byId[plat.id];
            const oauth = data.oauth?.[plat.id];
            const connected =
              conn?.status === "connected" || conn?.status === "syncing";
            const errored = conn?.status === "error";
            const configured = oauth?.oauthConfigured ?? false;
            const supported = oauth?.oauthSupported ?? plat.oauthReady;
            const isOpen = expanded[plat.id] ?? false;

            return (
              <Card key={plat.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-xl border text-sm font-bold"
                        style={{
                          background: `${plat.brandColor}18`,
                          color: plat.brandColor,
                          borderColor: `${plat.brandColor}33`,
                        }}
                      >
                        {plat.icon}
                      </span>
                      <div>
                        <CardTitle className="text-base">{plat.name}</CardTitle>
                        <CardDescription className="text-xs">
                          {plat.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          connected
                            ? "success"
                            : errored
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {conn?.status ?? "disconnected"}
                      </Badge>
                      {supported && (
                        <Badge
                          variant={configured ? "success" : "outline"}
                          className="text-[10px]"
                        >
                          {configured ? "env ready" : "env missing"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {plat.syncScopes.map((s) => (
                      <Badge key={s} variant="outline">
                        {s.replace(/_/g, " ")}
                      </Badge>
                    ))}
                    {conn?.authMode === "oauth" && (
                      <Badge variant="default">OAuth</Badge>
                    )}
                    {conn?.hasServerTokens && (
                      <Badge variant="success">tokens</Badge>
                    )}
                  </div>

                  {connected && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {conn.externalHandle && (
                        <p>
                          Handle:{" "}
                          <span className="text-foreground">
                            {conn.externalHandle}
                          </span>
                        </p>
                      )}
                      {conn.lastSyncedAt && (
                        <p>
                          Last sync:{" "}
                          <span className="font-mono text-foreground">
                            {new Date(conn.lastSyncedAt).toLocaleString()}
                          </span>
                        </p>
                      )}
                      {conn.lastSyncSummary?.length ? (
                        <p>Updated: {conn.lastSyncSummary.join(", ")}</p>
                      ) : null}
                      {conn.errorMessage && (
                        <p className="text-destructive">{conn.errorMessage}</p>
                      )}
                    </div>
                  )}

                  {oauth?.setupHint && !connected && (
                    <p
                      className={cn(
                        "text-xs",
                        configured
                          ? "text-muted-foreground"
                          : "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {oauth.setupHint}
                    </p>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-between px-2 text-xs"
                    onClick={() =>
                      setExpanded((e) => ({ ...e, [plat.id]: !isOpen }))
                    }
                  >
                    {isOpen ? "Hide setup steps" : "Show how to set up"}
                    {isOpen ? (
                      <ChevronUp className="size-3.5" />
                    ) : (
                      <ChevronDown className="size-3.5" />
                    )}
                  </Button>

                  {isOpen && oauth && <SetupPanel oauth={oauth} />}
                </CardContent>
                <Separator />
                <CardFooter className="flex flex-wrap gap-2 pt-4">
                  {!connected ? (
                    <Button
                      disabled={
                        busy === plat.id ||
                        !supported ||
                        (supported && !configured)
                      }
                      onClick={() => startOAuth(plat.id)}
                    >
                      {!supported
                        ? "Coming soon"
                        : !configured
                          ? "Add env keys first"
                          : "Connect with OAuth"}
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        disabled={busy === plat.id}
                        onClick={() => void disconnect(plat.id)}
                      >
                        Disconnect
                      </Button>
                      <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                        <Label
                          htmlFor={`sync-${plat.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          Daily sync
                        </Label>
                        <Switch
                          id={`sync-${plat.id}`}
                          checked={!!conn.syncEnabled}
                          disabled={busy === plat.id}
                          onCheckedChange={(v) => void toggleSync(plat.id, v)}
                        />
                      </div>
                      {supported && configured && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startOAuth(plat.id)}
                        >
                          Reconnect
                        </Button>
                      )}
                    </>
                  )}
                  {supported && !configured && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setExpanded((e) => ({ ...e, [plat.id]: true }))
                      }
                    >
                      View setup
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {data.lastSyncReport && (
        <Card>
          <CardHeader>
            <CardTitle>Last sync report</CardTitle>
            <CardDescription>
              {data.lastSyncReport.triggeredBy} ·{" "}
              {new Date(data.lastSyncReport.ranAt).toLocaleString()}
              {data.lastSyncReport.skipped
                ? ` · skipped: ${data.lastSyncReport.skipReason}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.lastSyncReport.results.map((r) => (
                <li key={r.platformId + r.syncedAt}>
                  <span className={r.ok ? "text-success" : "text-destructive"}>
                    {r.ok ? "✓" : "✗"}
                  </span>{" "}
                  {r.platformId}
                  {r.fieldsUpdated.length
                    ? ` → ${r.fieldsUpdated.join(", ")}`
                    : ""}
                  {r.error ? ` (${r.error})` : ""}
                </li>
              ))}
              {data.lastSyncReport.results.length === 0 && (
                <li>No platforms synced in last run.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
