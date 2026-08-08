# Deploy Vexa online

Single-user **email-native job CRM** (Next.js monorepo).

## What you get

| Surface | Path | Purpose |
|---------|------|---------|
| PIN gate | all pages | Unlock with **2580** (session) |
| Home | `/` | Command bar, voice, contribution graph, history |
| Tables | `/workspace` | Applications / jobs / companies + conf / scholar / hack |
| Jobs | `/jobs` | List + research people & projects |
| Timeline | `/timeline` | Tasks, deadlines, activity log |
| Services | `/services` | Live scrapers / LLM status |
| Settings | `/settings` | Profile + preferences |

**PIN:** `2580` (client session gate — not bank-grade; change in `apps/web/src/components/PinGate.tsx` if needed).

**Never auto-applies.** Server never submits applications for you.

---

## Stack

- **Node** ≥ 20  
- **pnpm** 10.x  
- **Next.js 15** app: `apps/web`  
- Packages: `@vexa/shared`, `@vexa/intelligence`  

Local data lives under `apps/web/data/` (JSON durable store). On pure serverless (Vercel) that storage is **ephemeral** per instance — fine for a personal trial; for always-on state prefer **Railway / Fly / VPS / Docker volume**.

---

## 1. Env vars (production)

Copy from `.env.example` and set:

```bash
# Required for correct links / OAuth later
NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN
APP_URL=https://YOUR_DOMAIN

# Optional but recommended
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_HTTP_REFERER=https://YOUR_DOMAIN
OPENROUTER_APP_TITLE=Vexa

# Optional job discovery quality
FIRECRAWL_API_KEY=
EXA_API_KEY=
HUNTER_API_KEY=

# Optional cold email send
RESEND_API_KEY=
COLD_EMAIL_FROM=

# Force no LLM (heuristics only)
# VEXA_HEURISTIC_ONLY=true
```

Free boards (Remotive, Jobicy, Himalayas, WWR, Arbeitnow, RemoteOK) work **without keys**.

---

## 2. Build & run (VPS / Docker / local prod)

```bash
git clone <your-repo-url> vexa
cd vexa
pnpm install
pnpm build
# run the Next app
pnpm --filter @vexa/web start
# default Next port 3000 unless you set PORT=
```

Dev:

```bash
pnpm install
pnpm dev
# http://127.0.0.1:5173
```

---

## 3. Deploy options

### A) Railway (recommended personal host)

1. New project → Deploy from GitHub (push this repo first).  
2. Root directory: monorepo root.  
3. Build command:

   ```bash
   pnpm install && pnpm --filter @vexa/web build
   ```

4. Start command:

   ```bash
   pnpm --filter @vexa/web start
   ```

5. Set env vars above.  
6. Optional: add a **volume** mounted at `/app/apps/web/data` so CRM JSON survives restarts.  
7. Generate domain → open site → enter PIN **2580**.

### B) Vercel

1. Import GitHub repo.  
2. **Root Directory:** leave monorepo root, or set framework to Next and:

   - Install: `pnpm install`  
   - Build: `pnpm --filter @vexa/web build`  
   - Output: Next (framework preset) — set **Root Directory** to `apps/web` **only if** you also configure monorepo install from parent (pnpm workspaces need root install).

   Practical Vercel setup:

   - Root Directory: **repository root**  
   - Build Command: `pnpm install && pnpm --filter @vexa/web build`  
   - Output Directory: leave default for Next  
   - Install Command: `pnpm install`  

3. Env vars in project settings.  
4. **Note:** filesystem `data/` is ephemeral on Vercel. CRM data may reset between deploys/cold starts.

### C) Fly.io

```bash
# install flyctl, then from repo root after Dockerfile (or use fly launch)
fly launch
fly secrets set OPENROUTER_API_KEY=... NEXT_PUBLIC_APP_URL=https://....fly.dev
fly deploy
```

Attach a volume for `apps/web/data` if you want durable CRM JSON.

### D) Docker (generic)

```dockerfile
# Example Dockerfile (repo root)
FROM node:22-bookworm-slim
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vexa/web build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "--filter", "@vexa/web", "start"]
```

```bash
docker build -t vexa .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_APP_URL=https://YOUR_DOMAIN \
  -e OPENROUTER_API_KEY=... \
  -v vexa-data:/app/apps/web/data \
  vexa
```

---

## 4. Post-deploy checklist

1. Open `https://YOUR_DOMAIN` → PIN **2580**  
2. Settings → fill profile  
3. Home → `service status` (see free boards)  
4. `start scrape software engineer`  
5. Drop a recruiter email → Tables / Timeline update  
6. Jobs → research people & projects (better with `EXA_API_KEY` / `FIRECRAWL_API_KEY`)  
7. Chrome: load `apps/extension` unpacked if you use prefill  

---

## 5. Security notes (honest)

| Control | Reality |
|---------|---------|
| PIN 2580 | Session gate in browser only — **not** real auth. Change PIN in code before public share. |
| No multi-user accounts | Single-user product assumption |
| Secrets | Never commit `.env.local` |
| Auto-apply | Disabled by design |

To change PIN: edit `PIN` in `apps/web/src/components/PinGate.tsx`.

---

## 6. Useful commands

```bash
pnpm typecheck
pnpm --filter @vexa/web build
pnpm e2e                 # if server running
```

Docs:

- `docs/PRODUCT.md` — product rules  
- `docs/EMAIL_CRM.md` — CRM APIs  
- `docs/FREE_STACK.md` — free job/contact stack  
- `docs/OAUTH_SETUP.md` — optional OAuth  

---

## 7. GitHub push (first time)

```bash
# create empty repo on GitHub, then:
cd /path/to/vexa
git remote add origin https://github.com/YOU/vexa.git
git push -u origin main
```

Then connect that repo to Railway/Vercel.
