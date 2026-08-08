# Vercel environment variables

Do **not** commit real API keys to GitHub (push protection blocks them).

## How to add

1. [vercel.com](https://vercel.com) → your **vexa** project  
2. **Settings → Environment Variables**  
3. Add each for **Production**  
4. **Deployments → Redeploy**

## Names to set

Copy values from your Mac: `apps/web/.env.local`

```text
NEXT_PUBLIC_APP_URL=https://YOUR-PROJECT.vercel.app
APP_URL=https://YOUR-PROJECT.vercel.app
OPENROUTER_HTTP_REFERER=https://YOUR-PROJECT.vercel.app

OPENROUTER_API_KEY=
OPENROUTER_MODEL=
OPENROUTER_MODELS=
OPENROUTER_APP_TITLE=Vexa
OPENROUTER_MAX_TOKENS_DEFAULT=128
OPENROUTER_TIMEOUT_MS=6000
OPENROUTER_MAX_ATTEMPTS=2

EXA_API_KEY=
FIRECRAWL_API_KEY=
BRIGHT_DATA_API_KEY=

OAUTH_STATE_SECRET=
VEXA_SINGLE_USER=true
```

Your agent / local session can print the real values from `.env.local` so you can paste them into Vercel (they stay off git).

**PIN after deploy:** `2580`
