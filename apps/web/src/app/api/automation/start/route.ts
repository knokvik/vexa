import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST() {
  const { results, sync } = await store.startAutomation();
  const prepared = results.filter((r) => !("error" in r)).length;
  const errors = results
    .filter((r): r is { error: string } => "error" in r)
    .map((r) => r.error);

  return NextResponse.json({
    enabled: true,
    prepared,
    errors,
    sync,
    message:
      "Synced connected platforms (if stale), then prepared humanized drafts. Open Draft Inbox. Server never auto-submits.",
  });
}
