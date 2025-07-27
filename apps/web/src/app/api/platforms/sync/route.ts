import { NextResponse } from "next/server";
import type { PlatformId } from "@vexa/shared";
import { store } from "@/lib/store";

/**
 * Manual or forced daily sync.
 * Body optional: { force?: boolean, only?: PlatformId[] }
 */
export async function POST(request: Request) {
  let force = true;
  let only: PlatformId[] | undefined;
  try {
    const body = await request.json();
    if (typeof body.force === "boolean") force = body.force;
    if (Array.isArray(body.only)) only = body.only;
  } catch {
    // empty body = force full sync
  }

  const report = store.syncPlatforms({
    force,
    only,
    triggeredBy: "manual",
  });

  return NextResponse.json({
    report,
    profile: store.getProfile(),
    ...store.getSyncStatus(),
  });
}

export async function GET() {
  return NextResponse.json(store.getSyncStatus());
}
