# Vexa free-tier stack

Zero-cost layers mapped onto Vexa. Paid APIs stay **optional**. Server never auto-submits applications.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│              VEXA ZERO-COST JOB SEARCH SYSTEM                     │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 1: JOBS          │  LAYER 2: CONTACTS                     │
│  Indeed RSS             │  Pattern emails (always free)          │
│  Remotive API           │  Hunter.io (opt HUNTER_API_KEY)        │
│  Arbeitnow API          │  Browser: GetProspect / Apollo / …     │
│  RemoteOK API           │  POST /api/contacts/find               │
│  Greenhouse/Lever JSON  │                                        │
│  Firecrawl/Exa (opt)    │                                        │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 3: RESUME        │  LAYER 4: APPLY                        │
│  Upload PDF/DOCX        │  ATS form prefill (extension)          │
│  Official Ivy templates │  Cold email drafts → Gmail             │
│  (AI rewrite off)       │  Co-pilot only — never auto-submit     │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 5: TRACKING                                               │
│  Durable JSON + outcomes · Export CSV → Google Sheets/Airtable   │
└──────────────────────────────────────────────────────────────────┘
```

## Layer 1 — Jobs (in Vexa)

| Source | Cost | Notes |
|--------|------|--------|
| **Remotive API** | $0 | Reliable remote roles JSON |
| **Jobicy API** | $0 | Remote jobs by tag |
| **Himalayas API** | $0 | Remote job feed |
| **We Work Remotely RSS** | $0 | Programming category RSS |
| **Arbeitnow API** | $0 | EU-friendly board |
| **RemoteOK API** | $0 | Remote listings |
| **Indeed RSS** | $0 | Best-effort; often 403/404 blocked |
| Greenhouse / Lever public JSON | $0 | Official boards (portal tier) |
| Firecrawl / Exa | Key required | Better company-site quality when set |
| Bright Data | Trial/key | Hard pages only |

**How it runs**

- **Live Search UI**: Free boards → ATS portals → Company sites → LinkedIn
- **Automate / full discover**: same free tier first, then portal/company (LinkedIn skipped by default)

No API keys needed for Free boards. Firecrawl/Exa enrich when configured.

## Layer 2 — Contacts

| Source | Cost | Notes |
|--------|------|--------|
| Pattern emails (`first.last@`, `recruiting@`, …) | $0 | Always available |
| `HUNTER_API_KEY` domain search | Free ~25/mo | Optional env |
| GetProspect / Apollo / Prospeo / Skrapp / Snov | Free tiers | Use in browser; paste into Outreach |

**API:** `POST /api/contacts/find` `{ "company": "Stripe", "fullName": "Jane Doe" }`  
**UI:** Outreach → **Find contacts (free)**

Never auto-sends. ~850+ lookups/mo if you rotate browser free tiers + Vexa patterns.

| Browser tool | Free credits |
|--------------|--------------|
| GetProspect | ~600 emails/mo |
| Apollo.io | ~100/mo |
| Prospeo | ~75/mo |
| Skrapp / Snov / Lusha | ~50 each |
| Hunter.io | ~25 searches |

## Layer 3 — Resume

| Approach | Cost |
|----------|------|
| Upload your PDF/DOCX (as-is preview) | $0 |
| Official Harvard / MIT / Penn / … templates | $0 |
| AI rewrite | Off for now (use ChatGPT/Claude free externally if needed) |

## Layer 4 — Apply

| Step | Cost |
|------|------|
| ATS form answers + Chrome extension prefill | $0 |
| Cold email drafts → copy to Gmail | $0 |
| Optional Resend for in-app send | Paid if used |
| Server never auto-submits | Safety rule |

Suggested mail-merge path outside Vexa: Google Sheets + Yet Another Mail Merge (free daily cap) using exported CSV.

## Layer 5 — Tracking

| Tool | Cost |
|------|------|
| Vexa durable DB + outcomes | $0 |
| `GET /api/export/applications` CSV | $0 → Sheets/Airtable |
| Weekly stats UI | $0 |

CSV columns: Date, Company, Role, Source, Status, Match, Shortlist, Surface, Outcome, URL, Follow-up, Notes.

**Inbox → Export CSV** for weekly Google Sheets import.

Suggested Sheet formulas after import:

- `=IF(TODAY()-A2>7,"FOLLOW UP","OK")` — flag stale apps  
- `=COUNTIF(E:E,"ready_to_submit")` — pipeline counters  

## Suggested free workflow

1. **Search** with role + keywords (+ voice) — Free boards fill first without keys.
2. **Prepare draft** on a strong match → form answers + resume package.
3. **Outreach → Find contacts** for company → pick email → Draft.
4. **Copy** to Gmail (or Resend if configured). Confirm send yourself.
5. **Export CSV** weekly into Google Sheets; log outcomes in Inbox.

## Env (all optional)

```bash
# Better discovery (not required for Free boards)
FIRECRAWL_API_KEY=
EXA_API_KEY=
BRIGHT_DATA_API_KEY=

# Free contact API (~25 searches/mo)
HUNTER_API_KEY=

# Send cold email from app (else copy/paste)
RESEND_API_KEY=
COLD_EMAIL_FROM=
```

## Code map

| Layer | Path |
|-------|------|
| Free job sources | `apps/web/src/lib/free-sources.ts` |
| Discover merge + free tier | `apps/web/src/lib/discover.ts` |
| Search UI free tier | `apps/web/src/components/SearchDialog.tsx` |
| Contacts API | `apps/web/src/app/api/contacts/find/route.ts` |
| CSV export | `apps/web/src/app/api/export/applications/route.ts` |
| Outreach Find contacts | `apps/web/src/app/outreach/OutreachClient.tsx` |

## Limitations & workarounds

| Limitation | Workaround |
|------------|------------|
| Indeed RSS often 403/404 | Jobicy, Himalayas, WWR, Remotive, Arbeitnow, RemoteOK cover free volume |
| Pattern emails unverified | Hunter free tier or browser GetProspect/Apollo |
| No bulk LinkedIn export on free tiers | Manual paste from Chrome extensions |
| 1 resume focus in product | Upload multiple files; use external builders for extra versions |
| No auto-submit (by design) | Extension prefill + you click Submit |
