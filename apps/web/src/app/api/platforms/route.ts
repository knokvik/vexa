import { NextResponse } from "next/server";
import { PLATFORM_CATALOG } from "@vexa/shared";
import type { PlatformId } from "@vexa/shared";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json({
    catalog: PLATFORM_CATALOG,
    ...store.getSyncStatus(),
  });
}

/**
 * Connect / disconnect / toggle daily sync.
 * Body: { action: "connect"|"disconnect"|"toggle_sync"|"set_sync_before_apply", platformId?, syncEnabled?, handle?, syncBeforeApply? }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const action = body.action as string;

  if (action === "set_sync_before_apply") {
    const enabled = Boolean(body.syncBeforeApply);
    return NextResponse.json({
      syncBeforeApply: store.setSyncBeforeApply(enabled),
      ...store.getSyncStatus(),
    });
  }

  const platformId = body.platformId as PlatformId;
  if (!platformId) {
    return NextResponse.json({ error: "platformId required" }, { status: 400 });
  }

  if (action === "connect") {
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
