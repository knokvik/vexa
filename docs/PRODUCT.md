# Product context (compressed)

## Pitch

Other tools spray generic applications and get you blacklisted. Vexa builds a unique, human-like resume for every job, predicts shortlisting odds, and gets you one click from submit — while keeping you in control.

## Canonical flow

```
Signup → Profile (skills, experience, interests, template priority)
  → Start automation
  → Job discovery (APIs + Firecrawl/Exa; public listings only)
  → Parse → unified Job schema
  → Resume generate (template priority)
  → Humanize → ATS optimize → Shortlist predict
  → Draft Inbox
  → Extension prefills in user's browser
  → User clicks Submit
  → Track + notify on errors
```

## Hard rule

Server never auto-submits applications. Submission = user device + user click.

## Platform connections + daily sync

Users connect LinkedIn, X, GitHub, Google, Indeed, Wellfound (demo OAuth now; real OAuth later).

- Per-platform **daily sync** toggle
- Global **sync before draft/apply** (default on)
- Stale if last sync &gt; 24h → auto-refresh before resume generation or apply package
- Sync is **read profile data only** — never used to auto-submit on those platforms

## Moats

1. Humanization engine
2. Shortlisting predictor (factor breakdown)
3. Template priority
4. Full loop with error transparency
5. Account safety (volume caps, health monitor)
