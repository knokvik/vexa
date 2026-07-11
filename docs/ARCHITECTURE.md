# Architecture (internal single-user)

## Decision (pragmatic vs full master stack)

| Master prompt | This build |
|---------------|------------|
| Next.js + FastAPI + PG + Mongo + Redis + ES | **Keep Next.js only** for now |
| Multi-user NextAuth | **Single operator** — no multi-tenant |
| Postgres/Mongo required day one | **File task memory + in-memory store** until needed |
| GPT-4o / Claude direct | **OpenRouter free multi-model pool** + local heuristics fallback |
| Chrome one-tap | Prefill form; **you** click Submit (no ban-seeking auto-submit) |

**When to add a real DB:** when job history/resumes must survive restarts long-term, or you go multi-user. Not required for internal use.

## Flow

```
Discover (Firecrawl + Exa, optional Bright Data)
  → Job list (memory)
  → Prepare draft task:
       tailor (local ATS/shortlist) 
       → humanize (OpenRouter free OR heuristic if rate-limited)
       → package (apply payload autoSubmit:false)
  → Draft Inbox → Apply → Chrome extension prefills → YOU submit
```

## Task memory (model-switch safe)

- Path: `apps/web/data/tasks/*.json`
- Optional Obsidian dump: `memory/tasks/*.md`
- Steps are idempotent: completed steps are not re-run if a free model fails mid-pipeline.

## Token thrift

- Default `max_tokens` 128 (health check uses 8)
- Failover max 3 models × 12s timeout
- Skip LLM humanize when heuristic score already high
- Discover limited to 3 results per source

## Chrome “one-tap” (plain English)

Vexa does **not** apply for you from the cloud.  
It opens the job page and fills fields. You press Submit once in your browser. That keeps accounts safer.
