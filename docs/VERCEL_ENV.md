# Vercel environment variables (paste in dashboard)

Do **not** commit real keys to GitHub (push protection blocks them).

## How to add (2 minutes)

1. Open [Vercel](https://vercel.com) → your **vexa** project  
2. **Settings → Environment Variables**  
3. Paste each row for **Production** (and Preview if you want)  
4. **Deployments → Redeploy**

## Values from your local machine

Copy from `apps/web/.env.local` (already on your Mac) into Vercel:

| Name | From local file |
|------|-----------------|
| `OPENROUTER_API_KEY` | same |
| `OPENROUTER_MODEL` | same |
| `OPENROUTER_MODELS` | same |
| `OPENROUTER_APP_TITLE` | `Vexa` |
| `OPENROUTER_MAX_TOKENS_DEFAULT` | same |
| `OPENROUTER_TIMEOUT_MS` | same |
| `OPENROUTER_MAX_ATTEMPTS` | same |
| `EXA_API_KEY` | same |
| `FIRECRAWL_API_KEY` | same |
| `BRIGHT_DATA_API_KEY` | same |
| `OAUTH_STATE_SECRET` | same |
| `VEXA_SINGLE_USER` | `true` |

## URLs (use your Vercel domain after first deploy)

```text
NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app
APP_URL=https://YOUR-PROJECT.vercel.app
OPENROUTER_HTTP_REFERER=https://YOUR-PROJECT.vercel.app
```

Code falls back to `VERCEL_URL` if these are empty, but setting them explicitly is best.

## One-shot CLI (optional)

```bash
# install: npm i -g vercel
cd /path/to/vexa
vercel link
# push each secret from .env.local (example):
vercel env add OPENROUTER_API_KEY production < <(grep OPENROUTER_API_KEY apps/web/.env.local | cut -d= -f2-)
```

Or bulk via Vercel dashboard paste.

**PIN after deploy:** `2580`
