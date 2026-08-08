# Email-native Job Search CRM

Architecture: **graph + pipeline**, not spreadsheet + auto-apply.

## Entities

Company → Jobs → Applications → Emails / Events  
Company → Contacts → Relationships (graph edges)

## Ingest

```
POST /api/crm/emails/ingest
{ "raw": "From: …\nSubject: …\n\nBody…" }
// or structured: subject, bodyText, fromEmail, fromName
// or { "batch": true, "raw": "…" }
```

Classifier types: `APPLICATION_CONFIRMED`, `REJECTION`, `SCREEN_INVITE`, `TECHNICAL_INVITE`, `ONSITE_INVITE`, `OFFER_RECEIVED`, `RECRUITER_OUTREACH`, `REFERRAL_REQUEST`, `FOLLOW_UP`, `GENERIC`.

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/crm/emails/ingest` | Classify + link graph |
| GET/PATCH | `/api/crm/pipeline` | Kanban + stage moves |
| GET/POST | `/api/crm/network` | Who do I know / add contact |
| GET | `/api/crm/timeline` | Activity feed |
| GET/PATCH | `/api/crm/briefing` | Morning actions |

## UI

- `/pipeline` — drop email + kanban
- `/network` — warm paths
- `/timeline` — feed

## Explicitly removed

- Resume tailor automation path
- Auto-apply / full_copilot draft packages
- `find_draft` mode (HTTP 410)

## Code

`apps/web/src/lib/crm/*` · `packages/shared/src/types/crm.ts` · `data/durable/crm.json`
