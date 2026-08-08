<div align="center">

<!-- Transparent mark: black on light · white on dark (GitHub theme-aware) -->
<img src="apps/web/public/logo-mark.png#gh-light-mode-only" alt="Vexa" width="96" height="96" />
<img src="apps/web/public/logo-mark-white.png#gh-dark-mode-only" alt="Vexa" width="96" height="96" />

# **Vexa**

**Email-native job search CRM**

Command bar · free boards · pipeline tables · tasks · never auto-apply

[Deploy](docs/DEPLOY.md) · [Product](docs/PRODUCT.md) · [Free stack](docs/FREE_STACK.md) · [CRM API](docs/EMAIL_CRM.md)

</div>

---

## Overview

Vexa is a single-user job search workspace. You paste recruiter emails, search open roles, track applications and deadlines, and research companies — without blind auto-apply bots.

| Surface | Route | What it does |
|---------|--------|----------------|
| Home | `/` | GPT-style command bar, hold-to-talk mic, contribution graph, history |
| Tables | `/workspace` | Applications, jobs, companies + conferences / scholarships / hackathons |
| Jobs | `/jobs` | Role list + research people & projects |
| Timeline | `/timeline` | Tasks, deadlines, activity log |
| Services | `/services` | Live scrapers & LLM status |
| Settings | `/settings` | Profile + preferences |

**Host PIN:** `2580` (session unlock — change in `apps/web/src/components/PinGate.tsx`).

---

## Principles

- **Never** server-side auto-submit to LinkedIn, Indeed, or Workday  
- Email + free job boards as the stable signal  
- You stay in control of every send and submit  
- Free tiers first; paid APIs optional  

---

## Stack

```
apps/web                 Next.js 15 dashboard + API
apps/extension           Chrome MV3 prefill (optional)
packages/shared          Types, CRM models, constants
packages/intelligence    Match / ATS helpers
```

- **Node** ≥ 20 · **pnpm** 10.x  

---

## Quick start

### 1. Install

```bash
pnpm install
```

### 2. Environment (optional)

```bash
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local — OpenRouter, Firecrawl, Exa, Hunter as needed
```

Free job boards work **without** API keys.

### 3. Develop

```bash
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) → unlock with **PIN `2580`**.

### 4. Production build

```bash
pnpm build
pnpm --filter @vexa/web start
```

---

## Deploy online

Full guide: **[docs/DEPLOY.md](docs/DEPLOY.md)**

| Platform | Notes |
|----------|--------|
| **Railway** | Recommended for durable `data/` volume |
| **Vercel** | Fast; filesystem CRM data is ephemeral |
| **Docker** | See root `Dockerfile` + volume on `apps/web/data` |

Minimal production env:

```bash
NEXT_PUBLIC_APP_URL=https://your-domain.com
APP_URL=https://your-domain.com
OPENROUTER_API_KEY=           # optional
OPENROUTER_HTTP_REFERER=https://your-domain.com
```

---

## Command bar

Type, paste, or **tap mic → hold the input** to dictate.

| Command | Result |
|---------|--------|
| Paste a recruiter email | Classify → company / job / stage |
| `start scrape software engineer` | Free scrapers + ATS boards |
| `service status` | Per-scraper / LLM status |
| `task: follow up Stripe` | Add todo |
| `complete: follow up` | Mark todo done |
| `list tasks` | Open todos |
| `who do I know at Linear` | Contact lookup |
| `morning briefing` | Focus + deadlines |

---

## Optional API keys

| Variable | Purpose |
|----------|---------|
| `OPENROUTER_API_KEY` | Better email parse / drafts |
| `FIRECRAWL_API_KEY` | Company site scrape |
| `EXA_API_KEY` | Semantic people / project search |
| `HUNTER_API_KEY` | Domain email search |
| `RESEND_API_KEY` | Optional in-app cold send |

See [`.env.example`](.env.example).

---

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/DEPLOY.md](docs/DEPLOY.md) | Host online (Railway, Vercel, Docker) |
| [docs/PRODUCT.md](docs/PRODUCT.md) | Product rules |
| [docs/EMAIL_CRM.md](docs/EMAIL_CRM.md) | CRM APIs |
| [docs/FREE_STACK.md](docs/FREE_STACK.md) | Free data sources |
| [docs/OAUTH_SETUP.md](docs/OAUTH_SETUP.md) | Optional OAuth |

---

## License

Private / personal use unless a license is added.
