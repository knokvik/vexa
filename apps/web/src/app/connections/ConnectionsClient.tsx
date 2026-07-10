"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  PlatformConnection,
  PlatformDefinition,
  PlatformId,
  SyncRunReport,
} from "@vexa/shared";

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

export default function ConnectionsPage() {
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
      setNote(`Connected ${ok} with real OAuth. Profile synced from the provider.`);
      load();
    }
    if (err) {
      setNote(`OAuth error: ${err}`);
    }
  }, [searchParams, load]);

  function startOAuth(platformId: PlatformId) {
    // Full navigation so cookies/session work on provider redirect
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
      body: JSON.stringify({
        action: "toggle_sync",
        platformId,
        syncEnabled,
      }),
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
    return <div className="text-sm text-zinc-400">Loading connections…</div>;
  }

  const byId = Object.fromEntries(
    data.platforms.map((p) => [p.platformId, p])
  ) as Record<PlatformId, PlatformConnection & { hasServerTokens?: boolean }>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm text-accent">Connections</p>
          <h1 className="mt-1 text-3xl font-semibold">Real platform OAuth</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Connect with GitHub, Google, LinkedIn, or X. Tokens stay on the
            server. Daily sync refreshes profile data every{" "}
            <span className="text-zinc-200">{data.maxAgeHours}h</span> and again
            before drafts / apply packages.
          </p>
        </div>
        <button
          className="btn-primary"
          disabled={busy === "sync"}
          onClick={runSyncNow}
        >
          {busy === "sync" ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {note && (
        <div className="rounded-xl border border-accent/20 bg-accent/10 px-4 py-3 text-sm text-accent">
          {note}
        </div>
      )}

      <div className="card space-y-2 border-warn/20 p-5">
        <h2 className="text-sm font-medium text-warn">Setup required</h2>
        <p className="text-sm text-zinc-400">
          Add OAuth app credentials to{" "}
          <code className="text-accent">apps/web/.env.local</code> (see{" "}
          <code className="text-accent">docs/OAUTH_SETUP.md</code>). Callback
          base URL:{" "}
          <code className="text-zinc-300">http://127.0.0.1:5173</code>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <div className="text-xs uppercase text-zinc-500">Connected</div>
          <div className="mt-2 font-mono text-3xl">{data.connectedCount}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase text-zinc-500">Daily sync on</div>
          <div className="mt-2 font-mono text-3xl">{data.syncEnabledCount}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase text-zinc-500">Stale now</div>
          <div className="mt-2 font-mono text-3xl text-warn">{data.staleCount}</div>
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-medium">Sync before draft / apply</h2>
          <p className="mt-1 text-sm text-zinc-400">
            When on, stale OAuth connections refresh from live APIs before
            resume generation.
          </p>
        </div>
        <button
          type="button"
          className={`btn ${data.syncBeforeApply ? "btn-primary" : "btn-ghost"}`}
          disabled={busy === "global"}
          onClick={() => setSyncBeforeApply(!data.syncBeforeApply)}
        >
          {data.syncBeforeApply ? "On" : "Off"}
        </button>
      </div>

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
            <div key={plat.id} className="card flex flex-col gap-4 p-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold"
                    style={{
                      background: `${plat.brandColor}22`,
                      color: plat.brandColor,
                      border: `1px solid ${plat.brandColor}44`,
                    }}
                  >
                    {plat.icon}
                  </span>
                  <div>
                    <h3 className="font-medium">{plat.name}</h3>
                    <p className="text-xs text-zinc-500">{plat.description}</p>
                  </div>
                </div>
                <span
                  className={`badge ${
                    connected
                      ? "bg-mint/15 text-mint"
                      : errored
                        ? "bg-danger/15 text-danger"
                        : "bg-white/5 text-zinc-400"
                  }`}
                >
                  {conn?.status ?? "disconnected"}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {plat.syncScopes.map((s) => (
                  <span key={s} className="badge bg-ink-800 text-zinc-400">
                    {s.replace(/_/g, " ")}
                  </span>
                ))}
                {conn?.authMode === "oauth" && (
                  <span className="badge bg-accent/15 text-accent">OAuth</span>
                )}
                {conn?.hasServerTokens && (
                  <span className="badge bg-mint/10 text-mint">tokens</span>
                )}
              </div>

              {connected && (
                <div className="space-y-1 text-xs text-zinc-500">
                  {conn.externalHandle && (
                    <p>
                      Handle:{" "}
                      <span className="text-zinc-300">
                        {conn.externalHandle}
                      </span>
                    </p>
                  )}
                  {conn.lastSyncedAt && (
                    <p>
                      Last sync:{" "}
                      <span className="font-mono text-zinc-300">
                        {new Date(conn.lastSyncedAt).toLocaleString()}
                      </span>
                    </p>
                  )}
                  {conn.lastSyncSummary && conn.lastSyncSummary.length > 0 && (
                    <p>Updated: {conn.lastSyncSummary.join(", ")}</p>
                  )}
                  {conn.errorMessage && (
                    <p className="text-danger">{conn.errorMessage}</p>
                  )}
                </div>
              )}

              {!supported && (
                <p className="text-xs text-zinc-500">
                  {oauth?.setupHint ??
                    "No public consumer OAuth — partner access required."}
                </p>
              )}

              {supported && !configured && (
                <p className="text-xs text-warn">
                  {oauth?.setupHint ?? "Add client ID/secret to .env.local"}
                </p>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
                {!connected ? (
                  <button
                    className="btn-primary"
                    disabled={
                      busy === plat.id || !supported || (supported && !configured)
                    }
                    onClick={() => startOAuth(plat.id)}
                  >
                    {!supported
                      ? "Coming soon"
                      : !configured
                        ? "Configure env first"
                        : "Connect with OAuth"}
                  </button>
                ) : (
                  <>
                    <button
                      className="btn-ghost"
                      disabled={busy === plat.id}
                      onClick={() => disconnect(plat.id)}
                    >
                      Disconnect
                    </button>
                    <button
                      className={`btn ${conn.syncEnabled ? "btn-primary" : "btn-ghost"}`}
                      disabled={busy === plat.id}
                      onClick={() => toggleSync(plat.id, !conn.syncEnabled)}
                    >
                      Daily sync: {conn.syncEnabled ? "On" : "Off"}
                    </button>
                    {supported && configured && (
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => startOAuth(plat.id)}
                      >
                        Reconnect
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {data.lastSyncReport && (
        <div className="card space-y-2 p-6">
          <h2 className="text-lg font-medium">Last sync report</h2>
          <p className="text-xs text-zinc-500">
            {data.lastSyncReport.triggeredBy} ·{" "}
            {new Date(data.lastSyncReport.ranAt).toLocaleString()}
            {data.lastSyncReport.skipped
              ? ` · skipped: ${data.lastSyncReport.skipReason}`
              : ""}
          </p>
          <ul className="space-y-1 text-sm text-zinc-400">
            {data.lastSyncReport.results.map((r) => (
              <li key={r.platformId + r.syncedAt}>
                <span className={r.ok ? "text-mint" : "text-danger"}>
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
        </div>
      )}
    </div>
  );
}
