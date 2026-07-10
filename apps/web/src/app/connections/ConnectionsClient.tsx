"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  PlatformConnection,
  PlatformDefinition,
  PlatformId,
  SyncRunReport,
} from "@vexa/shared";
import { Loader2, RefreshCw } from "lucide-react";
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

type OAuthStatus = {
  oauthConfigured: boolean;
  oauthSupported: boolean;
  setupHint?: string;
};

type PlatformsResponse = {
  catalog: PlatformDefinition[];
  platforms: (PlatformConnection & { hasServerTokens?: boolean })[];
  oauth?: Record<PlatformId, OAuthStatus>;
  syncBeforeApply: boolean;
  connectedCount: number;
  syncEnabledCount: number;
  staleCount: number;
  maxAgeHours: number;
  lastSyncReport: SyncRunReport | null;
};

export default function ConnectionsClient() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PlatformsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/platforms");
    const json = await res.json();
    setData(json);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ok = searchParams.get("oauth_success");
    const err = searchParams.get("oauth_error");
    if (ok) {
      setNote(
        `Connected ${ok} with real OAuth. Profile synced from the provider.`
      );
      load();
    }
    if (err) setNote(`OAuth error: ${err}`);
  }, [searchParams, load]);

  function startOAuth(platformId: PlatformId) {
    window.location.href = `/api/oauth/${platformId}/start`;
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connections"
        title="Real platform OAuth"
        description={`Connect GitHub, Google, LinkedIn, or X. Tokens stay on the server. Daily sync refreshes profile data every ${data.maxAgeHours}h and again before drafts / apply.`}
        actions={
          <Button disabled={busy === "sync"} onClick={runSyncNow}>
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

      <Alert variant="warning">
        <AlertTitle>Setup required</AlertTitle>
        <AlertDescription>
          Add OAuth credentials to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            apps/web/.env.local
          </code>{" "}
          (see{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            docs/OAUTH_SETUP.md
          </code>
          ). Callback base:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            http://127.0.0.1:5173
          </code>
        </AlertDescription>
      </Alert>

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
            onCheckedChange={(v) => setSyncBeforeApply(v)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {data.catalog.map((plat) => {
          const conn = byId[plat.id];
          const oauth = data.oauth?.[plat.id];
          const connected =
            conn?.status === "connected" || conn?.status === "syncing";
          const errored = conn?.status === "error";
          const configured = oauth?.oauthConfigured ?? false;
          const supported = oauth?.oauthSupported ?? plat.oauthReady;

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

                {!supported && (
                  <p className="text-xs text-muted-foreground">
                    {oauth?.setupHint ??
                      "No public consumer OAuth — partner access required."}
                  </p>
                )}
                {supported && !configured && (
                  <p className="text-xs text-warning">
                    {oauth?.setupHint ?? "Add client ID/secret to .env.local"}
                  </p>
                )}
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
                        ? "Configure env first"
                        : "Connect with OAuth"}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy === plat.id}
                      onClick={() => disconnect(plat.id)}
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
                        onCheckedChange={(v) => toggleSync(plat.id, v)}
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
              </CardFooter>
            </Card>
          );
        })}
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
