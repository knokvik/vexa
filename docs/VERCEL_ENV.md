# Vercel environment variables

Do **not** commit real API keys to GitHub (push protection blocks them).

## How to add

1. [vercel.com](https://vercel.com) → your **vexa** project  
2. **Settings → Environment Variables**  
3. Add each for **Production** (and **Preview** if you want branch deploys)  
4. **Deployments → ⋮ → Redeploy** (required so the new env is attached to a build)

> Server-only keys (`OPENROUTER_API_KEY`, etc.) apply after a redeploy.  
> `NEXT_PUBLIC_*` vars are baked at **build** time — always Redeploy after changing them.

## Names to set

Copy values from your Mac: `apps/web/.env.local`  
Replace `YOUR-PROJECT` with the hostname from your Vercel deployment URL.

```text
NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app
APP_URL=https://YOUR-PROJECT.vercel.app
OPENROUTER_HTTP_REFERER=https://YOUR-PROJECT.vercel.app

OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_MODELS=
OPENROUTER_APP_TITLE=Vexa
OPENROUTER_MAX_TOKENS_DEFAULT=128
OPENROUTER_TIMEOUT_MS=8000
OPENROUTER_MAX_ATTEMPTS=2

EXA_API_KEY=
FIRECRAWL_API_KEY=
BRIGHT_DATA_API_KEY=

OAUTH_STATE_SECRET=
VEXA_SINGLE_USER=true
```

**Do not** set `NEXT_PUBLIC_APP_URL` / `APP_URL` to `http://127.0.0.1:5173` on Vercel.

**PIN after deploy:** `2580`

## Verify tools after keys

Open these on your live domain (no PIN needed for APIs):

| Check | URL |
|-------|-----|
| Keys + disk | `https://YOUR-PROJECT.vercel.app/api/health` |
| LLM smoke | `https://YOUR-PROJECT.vercel.app/api/health/llm` |
| Scrapers | `https://YOUR-PROJECT.vercel.app/api/services/status` |

Healthy response snippets:

```json
// /api/health
{
  "ok": true,
  "keys": { "openrouter": true, "firecrawl": true, "exa": true },
  "storage": { "writable": true, "ephemeral": true }
}
```

If `keys.openrouter` is **false** after you added the key:

1. Confirm the name is exactly `OPENROUTER_API_KEY` (no spaces, no `sk-` prefix in the name)
2. Environment = **Production** (not only Preview/Development)
3. **Redeploy** the latest deployment
4. Hard-refresh the browser

## What works without keys

Free job boards (Remotive, Jobicy, Himalayas, WWR, Arbeitnow, RemoteOK) work with **no API keys**.

| Key | Unlocks |
|-----|---------|
| none | Free board job search, tasks (ephemeral), tables UI |
| `OPENROUTER_API_KEY` | Smarter command parse, email classify, drafts |
| `FIRECRAWL_API_KEY` / `EXA_API_KEY` | Deeper company / people search when free boards are thin |

## Known Vercel limits (not a mis-set key)

| Issue | Why |
|-------|-----|
| Tasks / pipeline “disappear” | Data is under `/tmp` (ephemeral). Cold starts reset it. |
| Job search feels slow / empty | Some boards block cloud IPs; others may time out. Free-first path still returns what it can. |
| Function timeout | Command route uses `maxDuration = 60`. Hobby plan must allow that. |
| LLM circuit “heuristic” | Free OpenRouter models rate-limit; app falls back to local heuristics. |

## Project build settings (must match)

| Setting | Value |
|---------|--------|
| Root Directory | `.` (repo root) |
| Install | `pnpm install` |
| Build | `pnpm install && pnpm --filter @vexa/web build` |
| Node | **20.x** |

If Root is set to `apps/web`, workspace packages break and tools fail at build or runtime.
