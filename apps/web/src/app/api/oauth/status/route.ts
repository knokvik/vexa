import { NextResponse } from "next/server";
import { listOAuthConfigStatus } from "@/lib/oauth/config";
import { DEMO_USER_ID } from "@/lib/demo-data";
import { hasTokens } from "@/lib/oauth/token-store";
import { store } from "@/lib/store";

export async function GET() {
  const status = listOAuthConfigStatus();
  const platforms = store.listPlatforms().map((p) => ({
    ...p,
    hasServerTokens: hasTokens(DEMO_USER_ID, p.platformId),
  }));

  return NextResponse.json({
    appUrl:
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://127.0.0.1:5173",
    providers: status,
    platforms,
    sync: store.getSyncStatus(),
  });
}
