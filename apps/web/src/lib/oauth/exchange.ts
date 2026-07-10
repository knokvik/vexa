import {
  callbackUrl,
  getOAuthProvider,
  type OAuthProviderId,
} from "./config";

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export async function exchangeCodeForTokens(
  providerId: OAuthProviderId,
  code: string,
  codeVerifier?: string
): Promise<TokenResponse> {
  const cfg = getOAuthProvider(providerId);
  if (!cfg) throw new Error(`${providerId} OAuth is not configured`);

  const redirectUri = callbackUrl(providerId);
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", redirectUri);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (cfg.tokenAuth === "basic") {
    // X (Twitter) confidential client
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString(
      "base64"
    );
    headers.Authorization = `Basic ${basic}`;
    body.set("client_id", cfg.clientId);
    if (codeVerifier) body.set("code_verifier", codeVerifier);
  } else {
    body.set("client_id", cfg.clientId);
    body.set("client_secret", cfg.clientSecret);
    if (codeVerifier) body.set("code_verifier", codeVerifier);
  }

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  const text = await res.text();
  let json: TokenResponse & { error?: string; error_description?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description ||
        json.error ||
        `Token exchange failed (${res.status})`
    );
  }

  return json;
}

export async function refreshAccessToken(
  providerId: OAuthProviderId,
  refreshToken: string
): Promise<TokenResponse> {
  const cfg = getOAuthProvider(providerId);
  if (!cfg) throw new Error(`${providerId} OAuth is not configured`);

  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", refreshToken);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (cfg.tokenAuth === "basic") {
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString(
      "base64"
    );
    headers.Authorization = `Basic ${basic}`;
    body.set("client_id", cfg.clientId);
  } else {
    body.set("client_id", cfg.clientId);
    body.set("client_secret", cfg.clientSecret);
  }

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers,
    body,
  });
  const json = (await res.json()) as TokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || "Refresh token failed"
    );
  }
  return json;
}
