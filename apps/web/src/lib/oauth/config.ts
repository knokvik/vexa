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

export type EnvKeyStatus = {
  name: string;
  set: boolean;
  /** Never include actual secret values */
  kind: "id" | "secret" | "url" | "other";
};

export type ProviderSetupGuide = {
  oauthConfigured: boolean;
  oauthSupported: boolean;
  setupHint?: string;
  /** Human steps to get credentials */
  steps?: string[];
  /** Where to create the app */
  consoleUrl?: string;
  consoleLabel?: string;
  /** Exact callback to paste in the provider dashboard */
  callbackUrl?: string;
  envKeys?: EnvKeyStatus[];
  scopes?: string[];
  /** Snippet for .env.local (empty values only) */
  envSnippet?: string;
  notes?: string[];
};

export function getAppUrl(): string {
  const fromEnv = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");
  // Ignore empty or localhost in production so Vercel domain wins
  if (
    fromEnv &&
    !/localhost|127\.0\.0\.1/i.test(fromEnv)
  ) {
    return fromEnv;
  }
  const vercel = (process.env.VERCEL_URL || "").trim().replace(/\/$/, "");
  if (vercel) {
    return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  }
  return fromEnv || "http://127.0.0.1:5173";
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

function envSet(name: string): boolean {
  return env(name).length > 0;
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

export function callbackUrl(provider: OAuthProviderId): string {
  return `${getAppUrl()}/api/oauth/${provider}/callback`;
}

function guideFor(
  id: OAuthProviderId,
  opts: {
    idKey: string;
    secretKey: string;
    consoleUrl: string;
    consoleLabel: string;
    steps: string[];
    scopes: string[];
    notes?: string[];
  }
): ProviderSetupGuide {
  const configured = !!getOAuthProvider(id);
  const keys: EnvKeyStatus[] = [
    {
      name: opts.idKey,
      set: envSet(opts.idKey),
      kind: "id",
    },
    {
      name: opts.secretKey,
      set: envSet(opts.secretKey),
      kind: "secret",
    },
  ];
  const missing = keys.filter((k) => !k.set).map((k) => k.name);
  const cb = callbackUrl(id);

  return {
    oauthSupported: true,
    oauthConfigured: configured,
    setupHint: configured
      ? "Ready — click Connect with OAuth"
      : missing.length
        ? `Missing in .env.local: ${missing.join(", ")}`
        : "Add credentials to .env.local and restart the server",
    steps: opts.steps,
    consoleUrl: opts.consoleUrl,
    consoleLabel: opts.consoleLabel,
    callbackUrl: cb,
    envKeys: keys,
    scopes: opts.scopes,
    envSnippet: `${opts.idKey}=\n${opts.secretKey}=`,
    notes: opts.notes,
  };
}

export function listOAuthConfigStatus(): Record<
  PlatformId,
  ProviderSetupGuide
> {
  const appUrl = getAppUrl();

  return {
    github: guideFor("github", {
      idKey: "GITHUB_CLIENT_ID",
      secretKey: "GITHUB_CLIENT_SECRET",
      consoleUrl: "https://github.com/settings/developers",
      consoleLabel: "GitHub → Settings → Developer settings → OAuth Apps",
      scopes: ["read:user", "user:email"],
      steps: [
        "Open GitHub Developer settings → OAuth Apps → New OAuth App",
        `Application name: Vexa (local)`,
        `Homepage URL: ${appUrl}`,
        `Authorization callback URL: ${callbackUrl("github")}`,
        "Create app → copy Client ID",
        "Generate a new client secret → copy it",
        "Paste both into apps/web/.env.local",
        "Restart Next.js (pnpm dev / next dev) so env reloads",
        "Return here and click Connect with OAuth",
      ],
      notes: [
        "Syncs: name, bio, location, languages from repos, GitHub URL",
        "Never commit .env.local",
      ],
    }),
    google: guideFor("google", {
      idKey: "GOOGLE_CLIENT_ID",
      secretKey: "GOOGLE_CLIENT_SECRET",
      consoleUrl: "https://console.cloud.google.com/apis/credentials",
      consoleLabel: "Google Cloud → APIs & Services → Credentials",
      scopes: ["openid", "email", "profile"],
      steps: [
        "Create or select a Google Cloud project",
        "APIs & Services → Credentials → Create credentials → OAuth client ID",
        "Application type: Web application",
        `Authorized JavaScript origins: ${appUrl}`,
        `Authorized redirect URIs: ${callbackUrl("google")}`,
        "Copy Client ID and Client secret into .env.local",
        "Configure OAuth consent screen (External / Testing is fine for you)",
        "Restart the dev server, then Connect with OAuth",
      ],
      notes: ["Syncs: name, verified email", "Add your Google account as a test user if app is in Testing"],
    }),
    linkedin: guideFor("linkedin", {
      idKey: "LINKEDIN_CLIENT_ID",
      secretKey: "LINKEDIN_CLIENT_SECRET",
      consoleUrl: "https://www.linkedin.com/developers/apps",
      consoleLabel: "LinkedIn Developers → My apps",
      scopes: ["openid", "profile", "email"],
      steps: [
        "Create an app at LinkedIn Developers",
        "Auth tab → Authorized redirect URLs for your app",
        `Add exactly: ${callbackUrl("linkedin")}`,
        "Products → request “Sign In with LinkedIn using OpenID Connect”",
        "Auth tab → copy Client ID and Primary Client Secret",
        "Paste into .env.local as LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET",
        "Restart server → Connect with OAuth",
      ],
      notes: [
        "OpenID Connect product is required (openid profile email)",
        "Full experience/skills API needs extra LinkedIn products (restricted)",
      ],
    }),
    x: guideFor("x", {
      idKey: "X_CLIENT_ID",
      secretKey: "X_CLIENT_SECRET",
      consoleUrl: "https://developer.x.com/en/portal/dashboard",
      consoleLabel: "X Developer Portal → Projects & Apps",
      scopes: ["tweet.read", "users.read", "offline.access"],
      steps: [
        "Create a Project + App in the X Developer Portal",
        "User authentication settings → Set up → OAuth 2.0",
        "Type of App: Web App, Automated App or Bot (confidential client)",
        `Callback URI / Redirect URL: ${callbackUrl("x")}`,
        `Website URL: ${appUrl}`,
        "Enable OAuth 2.0 (not only 1.0a)",
        "Copy Client ID and Client Secret into .env.local",
        "Restart server → Connect with OAuth",
      ],
      notes: [
        "Vexa uses OAuth 2.0 + PKCE",
        "Syncs: username, bio, location, interests from description",
      ],
    }),
    indeed: {
      oauthSupported: false,
      oauthConfigured: false,
      setupHint:
        "Indeed profile OAuth is partner-only — not available for consumer apps yet",
      steps: [
        "No public consumer OAuth for Indeed profile sync",
        "Use Search / discovery instead of Indeed connect for now",
      ],
      notes: ["Status: Coming soon"],
    },
    wellfound: {
      oauthSupported: false,
      oauthConfigured: false,
      setupHint:
        "Wellfound has no public consumer OAuth for profile sync yet",
      steps: [
        "No public Wellfound OAuth for profile sync",
        "Add startup preferences manually in Profile for now",
      ],
      notes: ["Status: Coming soon"],
    },
  };
}

/** Shared app-level env needed for any OAuth */
export function getOAuthAppEnvStatus(): {
  appUrl: string;
  keys: EnvKeyStatus[];
  ready: boolean;
  envPath: string;
} {
  const keys: EnvKeyStatus[] = [
    {
      name: "NEXT_PUBLIC_APP_URL",
      set: envSet("NEXT_PUBLIC_APP_URL") || envSet("APP_URL"),
      kind: "url",
    },
    {
      name: "OAUTH_STATE_SECRET",
      set: envSet("OAUTH_STATE_SECRET") || envSet("NEXTAUTH_SECRET"),
      kind: "other",
    },
  ];
  return {
    appUrl: getAppUrl(),
    keys,
    ready: keys.every((k) => k.set),
    envPath: "apps/web/.env.local",
  };
}
