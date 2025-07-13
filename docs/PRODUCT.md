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

## Moats

1. Humanization engine
2. Shortlisting predictor (factor breakdown)
3. Template priority
4. Full loop with error transparency
5. Account safety (volume caps, health monitor)
