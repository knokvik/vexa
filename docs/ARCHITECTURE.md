# Architecture (MVP)

```
apps/web (Next.js)
  ├─ UI: Dashboard, Profile, Jobs, Draft Inbox, Resumes, Settings
  ├─ API: profile, jobs, applications, automation, resumes
  └─ lib/store (memory) → Postgres later

packages/shared
  └─ domain types + volume caps + templates

packages/intelligence
  ├─ humanize
  ├─ ats
  ├─ shortlist
  └─ resume-builder

apps/extension
  └─ prefill only (user submits)
```

## Event pipeline

`job.discovered` → resume.generated → humanized → ATS → shortlist → application.ready → user one-tap → submitted|failed

## Hard rule

No server path submits to LinkedIn/Indeed/Workday.
