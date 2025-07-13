# Vexa

**AI job application copilot** — quality over volume.

Discover jobs → generate unique humanized resumes → ATS + shortlist scores → **Draft Inbox** → Chrome Extension prefills → **you** submit.

## Principles

- **Never server-side auto-submit** to LinkedIn / Indeed / Workday
- One-tap draft model: extension prefills, user clicks Submit
- ~10 tailored applications/day max (quality caps)
- Transparent errors and account safety

## Monorepo

```
apps/web          Next.js dashboard + API
apps/extension    Chrome MV3 one-tap prefill
packages/shared   Types, schemas, constants
packages/intelligence  Humanize / ATS / shortlist
```

## Quick start

```bash
pnpm install
pnpm dev
```

See `docs/` for product context and architecture.
