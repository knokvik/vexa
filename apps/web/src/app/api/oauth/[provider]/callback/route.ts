import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/lib/demo-data";
import {
  getAppUrl,
  isOAuthProvider,
  type OAuthProviderId,
} from "@/lib/oauth/config";
import { verifyState } from "@/lib/oauth/crypto";
import { exchangeCodeForTokens } from "@/lib/oauth/exchange";
import { saveTokens } from "@/lib/oauth/token-store";
import { store } from "@/lib/store";

function redirectError(message: string) {
  const url = new URL("/connections", getAppUrl());
  url.searchParams.set("oauth_error", message);
  return NextResponse.redirect(url.toString());
}

/**
 * GET /api/oauth/:provider/callback?code=&state=
 * Completes OAuth, stores tokens server-side, syncs profile, redirects to Connections.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: raw } = await context.params;
  if (!isOAuthProvider(raw)) {
    return redirectError("Unsupported provider");
  }
  const provider = raw as OAuthProviderId;

  const { searchParams } = new URL(request.url);
  const err = searchParams.get("error");
  const errDesc = searchParams.get("error_description");
  if (err) {
    return redirectError(errDesc || err);
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return redirectError("Missing code or state");
  }

  const payload = verifyState(state);
  if (!payload || payload.provider !== provider) {
    return redirectError("Invalid or expired OAuth state");
  }

  try {
    const tokens = await exchangeCodeForTokens(
      provider,
      code,
      payload.codeVerifier
    );

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : undefined;

    saveTokens(DEMO_USER_ID, {
      platformId: provider,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenType: tokens.token_type,
      scope: tokens.scope,
      expiresAt,
      obtainedAt: new Date().toISOString(),
    });

    const result = await store.connectWithOAuthTokens(provider, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    });

    if ("error" in result) {
      return redirectError(result.error);
    }

    const url = new URL("/connections", getAppUrl());
    url.searchParams.set("oauth_success", provider);
    return NextResponse.redirect(url.toString());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OAuth failed";
    console.error("[oauth callback]", provider, msg);
    return redirectError(msg);
  }
}
