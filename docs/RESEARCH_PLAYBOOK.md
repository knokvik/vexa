# Vexa research playbook — what matters & how we build

Distilled from ATS/shortlist research + competitive landscape (2026).  
**Principle:** quality + account safety beat volume.

## How ATS & shortlisting actually work

1. **Parse first, judge second** — multi-column / tables / graphics often become garbage text. Single-column plain structure wins.
2. **Matching is semantic + exact phrases** — related titles map; exact tool names & certs (acronym + full) still matter more than keyword stuffing.
3. **Recruiter skim ~6–7 seconds** — top of resume + first role bullets matter most.
4. **Employers also use AI to filter** — “AI doom loop”: more auto-apps → more AI filters → more tailoring. Blind volume converts poorly (~0.5% interview rates reported in blast tools).
5. **Legal friction rising** — CAPTCHAs, video screens, consent rules for AI interview analysis.

**Pay attention here (resume):** parsing safety + exact phrase weave + quantified real bullets — not prettier templates.

## Competitive reality

| Stage | Reality |
|-------|---------|
| Discovery | Easy; public Greenhouse/Lever APIs exist |
| Matching | Easy-ish; commercial tools claim thousands of matches |
| Tailoring | Medium; **invention/fabrication risk** is real |
| **Submit** | Hard; CAPTCHA, shadow DOM, silent “success” lies |
| LinkedIn auto | **High ban risk** — ToS bars bots; behavioral detection |

**Vexa stance (hard rule):** server never auto-submits. Extension prefills only. You click Submit.

## Apply risk tiers

| Tier | Surface | Confidence | Behavior |
|------|---------|------------|----------|
| 1 | Direct ATS (Greenhouse/Lever/company) | ≥ 0.85 | Semi-auto **prefill package** after you approve class; daily caps; you still confirm submit |
| 2 | Direct ATS | 0.60–0.85 | Draft inbox → one-click open + prefill |
| 3 | LinkedIn / Indeed / social | any | **Draft only** — you always open & submit |

Never engineer around CAPTCHA. Treat as stop + flag.

## Where to invest engineering time (priority)

1. **Profile / achievement blocks** (truth source) + memory vault  
2. **Job intake** — Greenhouse/Lever public JSON first; Firecrawl/Exa fallback  
3. **Two-stage score** — cheap local filter → optional LLM judge note  
4. **Resume tailor** — templates as shells; **no invention** verifier; ATS linter  
5. **Cold email** — high leverage, low ban risk vs Easy Apply spam  
6. **Semi-auto prefill** — Playwright/extension on **your** browser; confirm page/email  
7. **Outcome loop** — log interview/reject vs score bands  

## Cold email design

- Triggered by high-confidence job or manual “mail this person”
- Inputs: email, name/role optional, company, job link, your note
- Output: short personalized draft (LLM + profile) → **you review** → optional SMTP send
- Cap: few per company; not a blast list

## LLM vs local (Vexa)

| Local (no LLM) | LLM (OpenRouter free pool) |
|----------------|----------------------------|
| ATS score, match %, template layout | Resume humanize |
| Discovery ranking heuristics | Shortlist note, cold email draft |
| Parse-safety linter | — |

## Architecture shape

```
[Intake: GH/Lever API → Firecrawl/Exa]
  → [Score & tier]
  → [Tailor + invention check + ATS linter]
  → [Route: inbox | cold email | (never silent LinkedIn submit)]
  → [You submit / you send]
  → [Log outcome → adjust thresholds]
```

Obsidian markdown = human memory. JSON on disk = machine events.  
OpenRouter multi-model failover already in place.
