import { NextResponse } from "next/server";
import { PLATFORM_CATALOG } from "@vexa/shared";
import type { PlatformId } from "@vexa/shared";
import { store } from "@/lib/store";
import {
  getOAuthAppEnvStatus,
  listOAuthConfigStatus,
} from "@/lib/oauth/config";

export async function GET() {
  const oauth = listOAuthConfigStatus();
  const appEnv = getOAuthAppEnvStatus();
  const readyProviders = (
    ["github", "google", "linkedin", "x"] as const
  ).filter((id) => oauth[id].oauthConfigured);
  const missingProviders = (
    ["github", "google", "linkedin", "x"] as const
  ).filter((id) => !oauth[id].oauthConfigured);

  return NextResponse.json({
    catalog: PLATFORM_CATALOG,
    oauth,
    appEnv,
    setup: {
      readyCount: readyProviders.length,
      missingCount: missingProviders.length,
      readyProviders,
      missingProviders,
      docsPath: "docs/OAUTH_SETUP.md",
    },
    ...store.getSyncStatus(),
  });
}

/**
 * Connect (demo only if ALLOW_DEMO_OAUTH) / disconnect / toggle daily sync.
 * Real connect uses GET /api/oauth/:provider/start
 */
export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action as string;

  if (action === "set_sync_before_apply") {
    store.setSyncBeforeApply(Boolean(body.syncBeforeApply));
    return NextResponse.json(store.getSyncStatus());
  }

  const platformId = body.platformId as PlatformId;
  if (!platformId) {
    return NextResponse.json({ error: "platformId required" }, { status: 400 });
  }

  if (action === "connect") {
    // Prefer telling client to use OAuth redirect
    if (process.env.ALLOW_DEMO_OAUTH !== "true") {
      return NextResponse.json(
        {
          error: "Use real OAuth",
          oauthStartUrl: `/api/oauth/${platformId}/start`,
        },
        { status: 400 }
      );
    }
    const result = store.connectPlatform(platformId, {
      handle: body.handle,
      profileUrl: body.profileUrl,
    });
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({
      connection: result,
      profile: store.getProfile(),
      ...store.getSyncStatus(),
    });
  }

  if (action === "disconnect") {
    const result = store.disconnectPlatform(platformId);
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ connection: result, ...store.getSyncStatus() });
  }

  if (action === "toggle_sync") {
    const result = store.setPlatformSyncEnabled(
      platformId,
      Boolean(body.syncEnabled)
    );
    if ("error" in result) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json({ connection: result, ...store.getSyncStatus() });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
