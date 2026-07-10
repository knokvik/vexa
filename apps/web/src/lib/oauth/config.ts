import type { PlatformId } from "@vexa/shared";

export type OAuthProviderId = Extract<
  PlatformId,
  "github" | "google" | "linkedin" | "x"
>;

export interface OAuthProviderConfig {
  id: OAuthProviderId;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** X requires PKCE */
  usePkce: boolean;
  /** LinkedIn uses form body for token */
  tokenAuth: "body" | "basic";
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:5173"
  );
}

export function getStateSecret(): string {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "vexa-dev-oauth-state-change-me"
  );
}

function env(name: string): string {
  return (process.env[name] || "").trim();
}

export function getOAuthProvider(
  id: OAuthProviderId
): OAuthProviderConfig | null {
  switch (id) {
    case "github": {
      const clientId = env("GITHUB_CLIENT_ID");
      const clientSecret = env("GITHUB_CLIENT_SECRET");
      if (!clientId || !clientSecret) return null;
      return {
        id,
        clientId,
        clientSecret,
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scopes: ["read:user", "user:email"],
        usePkce: false,
        tokenAuth: "body",
      };
    }
    case "google": {
      const clientId = env("GOOGLE_CLIENT_ID");
      const clientSecret = env("GOOGLE_CLIENT_SECRET");
      if (!clientId || !clientSecret) return null;
      return {
        id,
        clientId,
        clientSecret,
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: ["openid", "email", "profile"],
        usePkce: false,
        tokenAuth: "body",
      };
    }
    case "linkedin": {
      const clientId = env("LINKEDIN_CLIENT_ID");
      const clientSecret = env("LINKEDIN_CLIENT_SECRET");
      if (!clientId || !clientSecret) return null;
      return {
        id,
        clientId,
        clientSecret,
        authUrl: "https://www.linkedin.com/oauth/v2/authorization",
        tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
        // OpenID Connect scopes — available for most LinkedIn apps
        scopes: ["openid", "profile", "email"],
        usePkce: false,
        tokenAuth: "body",
      };
    }
    case "x": {
      const clientId = env("X_CLIENT_ID");
      const clientSecret = env("X_CLIENT_SECRET");
      if (!clientId || !clientSecret) return null;
      return {
        id,
        clientId,
        clientSecret,
        authUrl: "https://twitter.com/i/oauth2/authorize",
        tokenUrl: "https://api.twitter.com/2/oauth2/token",
        scopes: ["tweet.read", "users.read", "offline.access"],
        usePkce: true,
        tokenAuth: "basic",
      };
    }
    default:
      return null;
  }
}

export function isOAuthProvider(id: string): id is OAuthProviderId {
  return ["github", "google", "linkedin", "x"].includes(id);
}

export function listOAuthConfigStatus(): Record<
  PlatformId,
  { oauthConfigured: boolean; oauthSupported: boolean; setupHint?: string }
> {
  return {
    github: {
      oauthSupported: true,
      oauthConfigured: !!getOAuthProvider("github"),
      setupHint: "Set GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET",
    },
    google: {
      oauthSupported: true,
      oauthConfigured: !!getOAuthProvider("google"),
      setupHint: "Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET",
    },
    linkedin: {
      oauthSupported: true,
      oauthConfigured: !!getOAuthProvider("linkedin"),
      setupHint: "Set LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET",
    },
    x: {
      oauthSupported: true,
      oauthConfigured: !!getOAuthProvider("x"),
      setupHint: "Set X_CLIENT_ID + X_CLIENT_SECRET (OAuth 2.0 PKCE)",
    },
    indeed: {
      oauthSupported: false,
      oauthConfigured: false,
      setupHint: "Indeed profile OAuth requires partner access — not public yet",
    },
    wellfound: {
      oauthSupported: false,
      oauthConfigured: false,
      setupHint: "Wellfound has no public consumer OAuth for profile sync yet",
    },
  };
}

export function callbackUrl(provider: OAuthProviderId): string {
  return `${getAppUrl()}/api/oauth/${provider}/callback`;
}
