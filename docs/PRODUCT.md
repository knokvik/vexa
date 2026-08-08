# Product context — Email-native Job Search CRM

## Pitch

Email is the universal API of job searching. Vexa is a **relationship graph** that tracks companies, contacts, jobs, and applications from your inbox — not a brittle auto-apply bot.

## Hard rules

1. **Never auto-apply.** You click Submit on the employer site.
2. **Never auto-send** cold email without explicit confirm (copy-to-Gmail is default).
3. **No resume tailor engine** as a product path — upload your materials; apply strategically with graph intel.
4. Server packages that request `autoSubmit: true` are rejected.

## Canonical flow

```
Drop / sync job emails
  → Classify (confirmation, rejection, screen, technical, onsite, offer, outreach…)
  → Extract company, contact, job, dates
  → Upsert graph nodes + edges
  → Advance application pipeline stage
  → Action engine (follow-ups, prep, offer timers)
  → Pipeline / Network / Timeline UI
  → You apply & reply with context
```

## Surfaces

| Route | Role |
|-------|------|
| `/pipeline` | Kanban + email drop |
| `/network` | Who do I know at X? |
| `/timeline` | Activity feed |
| Find jobs | Optional free-board discovery |
| `/outreach` | Cold email drafts (human send) |
| `/resumes` | Profile + upload only |

## Why this wins over auto-apply

| Auto-apply | Email-native CRM |
|------------|------------------|
| Breaks on DOM changes | Email formats stable for decades |
| ToS / ban risk | Read + paste / OAuth read-only |
| Blind volume | Full audit trail + warm paths |
| Resume spam | Strategic manual apply |

## Optional discovery

Free boards (Remotive, Jobicy, Himalayas, WWR, …) still help find roles. They do **not** auto-submit.
