import { NextResponse } from "next/server";
import {
  callbackUrl,
  getOAuthProvider,
  isOAuthProvider,
  type OAuthProviderId,
} from "@/lib/oauth/config";
import { randomString, sha256Base64Url, signState } from "@/lib/oauth/crypto";

/**
 * GET /api/oauth/:provider/start
 * Redirects browser to the real provider authorize URL.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider: raw } = await context.params;
  if (!isOAuthProvider(raw)) {
    return NextResponse.json(
      { error: "Unsupported OAuth provider" },
      { status: 400 }
    );
  }
  const provider = raw as OAuthProviderId;
  const cfg = getOAuthProvider(provider);
  if (!cfg) {
    // Send user back to Connect UI with a clear setup message (not raw JSON)
    const app =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://127.0.0.1:5173";
    const dest = new URL("/connections", app);
    dest.searchParams.set(
      "oauth_error",
      `${provider}_not_configured — add ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET to apps/web/.env.local, restart dev server, then Connect again`
    );
    return NextResponse.redirect(dest.toString());
  }

  const nonce = randomString(16);
  let codeVerifier: string | undefined;
  let codeChallenge: string | undefined;

  if (cfg.usePkce) {
    codeVerifier = randomString(48);
    codeChallenge = sha256Base64Url(codeVerifier);
  }

  const state = signState({
    provider,
    nonce,
    exp: Math.floor(Date.now() / 1000) + 600,
    codeVerifier,
  });

  const redirectUri = callbackUrl(provider);
  const url = new URL(cfg.authUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", cfg.scopes.join(" "));
  url.searchParams.set("state", state);

  if (provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }
  if (provider === "linkedin") {
    // Force permission screen so user always sees "Allow Vexa to connect"
    url.searchParams.set("prompt", "consent");
  }
  if (provider === "github") {
    // fine
  }
  if (cfg.usePkce && codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  return NextResponse.redirect(url.toString());
}
