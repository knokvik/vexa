# Real OAuth setup (Vexa Connections)

Connect **GitHub, Google, LinkedIn, X** with real OAuth 2.0. Tokens are stored **server-side only** and used to sync profile data before drafts/apply.

## 1. Env file

Create `apps/web/.env.local` (never commit secrets):

```bash
NEXT_PUBLIC_APP_URL=http://127.0.0.1:5173
APP_URL=http://127.0.0.1:5173
OAUTH_STATE_SECRET=generate-a-long-random-string

# GitHub — https://github.com/settings/developers → OAuth Apps
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Google — https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# LinkedIn — https://www.linkedin.com/developers/apps
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

# X (Twitter) — https://developer.x.com/en/portal/dashboard
# Use OAuth 2.0 (not 1.0a). Type: Web App, confidential client.
X_CLIENT_ID=
X_CLIENT_SECRET=

# Optional: allow fake offline connect without OAuth (dev only)
# ALLOW_DEMO_OAUTH=true
```

Restart the dev server after editing env:

```bash
cd ~/Programming/vexa
pnpm dev
```

## 2. Callback URLs (register exactly)

| Provider | Authorization callback URL |
|----------|----------------------------|
| GitHub | `http://127.0.0.1:5173/api/oauth/github/callback` |
| Google | `http://127.0.0.1:5173/api/oauth/google/callback` |
| LinkedIn | `http://127.0.0.1:5173/api/oauth/linkedin/callback` |
| X | `http://127.0.0.1:5173/api/oauth/x/callback` |

If you change port or host, update **both** the provider dashboard and `APP_URL` / `NEXT_PUBLIC_APP_URL`.

## 3. Provider notes

### GitHub
- Scopes: `read:user`, `user:email`
- Syncs: name, bio, location, languages from repos, github URL

### Google
- Scopes: `openid email profile`
- Syncs: name, verified email identity

### LinkedIn
- Product: **Sign In with LinkedIn using OpenID Connect**
- Scopes: `openid profile email`
- Syncs: name (vanity profile URL needs extra restricted products)

### X
- OAuth 2.0 with **PKCE**
- Scopes: `tweet.read users.read offline.access`
- Syncs: username, bio, location, interests from description

### Indeed / Wellfound
- No public consumer profile OAuth for this product yet — shown as “Coming soon”

## 4. Flow

1. User clicks **Connect with OAuth** on `/connections`
2. Browser → `/api/oauth/{provider}/start` → provider login
3. Provider → `/api/oauth/{provider}/callback`
4. Server exchanges `code` → tokens (memory vault; encrypt in DB later)
5. Server fetches live profile → merges into Vexa profile
6. Daily / pre-apply sync reuses tokens (refresh when expired)

## 5. Security notes

- Never return `access_token` to the browser
- Rotate `OAUTH_STATE_SECRET` in production
- Production: store tokens encrypted in Postgres, per-user, with refresh rotation
- Connections only **read** profile data — never auto-submit job applications
