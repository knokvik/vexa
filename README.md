# Vexa

**Email-native job search CRM** — quality over volume. Never auto-apply.

Command bar (type or hold-to-talk) → free job boards + email ingest → tables, tasks, timelines, scraper status. You still submit applications yourself.

## Principles

- **Never server-side auto-submit** to LinkedIn / Indeed / Workday  
- Email + free boards as the stable signal  
- Relationship / pipeline graph over blind resume spam  
- Host PIN gate for personal deploy (default `2580`)  

## Monorepo

```
apps/web          Next.js dashboard + API
apps/extension    Chrome MV3 one-tap prefill (optional)
packages/shared   Types, CRM models, constants
packages/intelligence  Match / ATS helpers
```

## Quick start (local)

```bash
pnpm install
pnpm dev
# http://127.0.0.1:5173
# Unlock with PIN: 2580
```

Optional env: copy `.env.example` → `apps/web/.env.local` (OpenRouter, Firecrawl, Exa, Hunter).

## Deploy online

**Full guide:** [`docs/DEPLOY.md`](docs/DEPLOY.md)

Short path (Railway / VPS):

```bash
pnpm install
pnpm build
pnpm --filter @vexa/web start
```

Set `NEXT_PUBLIC_APP_URL` to your public HTTPS URL.

## Command bar cheatsheet

| Command | Effect |
|---------|--------|
| Paste recruiter email | Classify → company / job / stage |
| `start scrape software engineer` | Free scrapers + ATS boards |
| `service status` | Live scraper / LLM status |
| `task: follow up Stripe` | Add todo |
| `complete: follow up` | Mark todo done |
| `list tasks` | Open todos |
| `who do I know at Linear` | Contact graph |
| `morning briefing` | Focus + deadlines |

## Docs

- [`docs/DEPLOY.md`](docs/DEPLOY.md) — host online  
- [`docs/PRODUCT.md`](docs/PRODUCT.md) — product rules  
- [`docs/EMAIL_CRM.md`](docs/EMAIL_CRM.md) — CRM APIs  
- [`docs/FREE_STACK.md`](docs/FREE_STACK.md) — free data sources  
- [`docs/OAUTH_SETUP.md`](docs/OAUTH_SETUP.md) — optional OAuth  

## License

Private / personal use unless you add a license.
