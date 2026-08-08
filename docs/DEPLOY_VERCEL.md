# Deploy Vexa on Vercel

Step-by-step guide for the monorepo at [github.com/knokvik/vexa](https://github.com/knokvik/vexa).

After deploy: open your URL → enter PIN **`2580`**.

---

## Before you start

| You need | Why |
|----------|-----|
| GitHub account | Repo is already on GitHub |
| [Vercel](https://vercel.com) account | Free hobby plan is enough |
| Optional API keys | Free job boards work without keys |

**Important (Vercel filesystem):**  
CRM data is stored as JSON under `apps/web/data/`. On Vercel this is **ephemeral** (can reset on redeploy / cold starts). Fine for personal use and demos. For permanent storage later, use Railway/VPS with a volume, or plug in a real DB.

---

## Step 1 — Confirm the repo is on GitHub

```bash
# Already done if you pushed earlier
git remote -v
# origin  https://github.com/knokvik/vexa.git
```

Repo: **https://github.com/knokvik/vexa**

---

## Step 2 — Import project on Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Click **Import** next to **knokvik/vexa**  
   (or **Add GitHub Account** / grant access if you don’t see it)
3. Configure the project:

| Setting | Value |
|---------|--------|
| **Project Name** | `vexa` (or any name) |
| **Framework Preset** | **Next.js** |
| **Root Directory** | **.** (repository root — leave default) |
| **Build Command** | `pnpm install && pnpm --filter @vexa/web build` |
| **Output Directory** | *(leave empty — Next.js handles this)* |
| **Install Command** | `pnpm install` |
| **Node.js Version** | **20.x** (Project Settings → General) |

### Why root is not `apps/web`

This is a **pnpm workspace**. Packages `@vexa/shared` and `@vexa/intelligence` live at the monorepo root. Installing only inside `apps/web` breaks the build.

---

## Step 3 — Environment variables

In Vercel project → **Settings → Environment Variables**, add for **Production** (and Preview if you want):

### Required for a correct public URL

After the first deploy you’ll get a URL like `https://vexa-xxx.vercel.app`.  
Then set (or update):

| Name | Value | Environments |
|------|--------|----------------|
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` | Production |
| `APP_URL` | `https://YOUR-PROJECT.vercel.app` | Production |

Use your real Vercel domain (or custom domain later).

### Optional (recommended)

| Name | Value | Notes |
|------|--------|--------|
| `OPENROUTER_API_KEY` | `sk-or-v1-…` | Better email parse / AI features |
| `OPENROUTER_HTTP_REFERER` | same as `NEXT_PUBLIC_APP_URL` | OpenRouter referer |
| `OPENROUTER_APP_TITLE` | `Vexa` | |
| `FIRECRAWL_API_KEY` | optional | Deeper company scrape |
| `EXA_API_KEY` | optional | People / project research |
| `HUNTER_API_KEY` | optional | Contact emails |
| `RESEND_API_KEY` | optional | Send cold email from app |
| `COLD_EMAIL_FROM` | optional | Verified sender for Resend |

**Free boards** (Remotive, Jobicy, Himalayas, WWR, Arbeitnow, RemoteOK) work with **no keys**.

Do **not** upload `.env.local` — only set vars in the Vercel UI.

---

## Step 4 — Deploy

1. Click **Deploy**
2. Wait for the build log to finish green  
3. Open the deployment URL  
4. Enter PIN **`2580`**

### If the build fails

| Error | Fix |
|-------|-----|
| `pnpm: command not found` | Set Install Command to `corepack enable && pnpm install` or enable pnpm in Vercel (auto with `packageManager` field — already set) |
| Cannot find `@vexa/shared` | Root Directory must be monorepo root; Build must use `pnpm --filter @vexa/web build` |
| Node version too old | Settings → General → Node.js **20.x** |
| Out of memory | Retry; Hobby is usually enough for this app |

---

## Step 5 — Custom domain (optional)

1. Vercel → Project → **Settings → Domains**  
2. Add `yourdomain.com`  
3. Follow DNS instructions  
4. Update env:

```text
NEXT_PUBLIC_APP_URL=https://yourdomain.com
APP_URL=https://yourdomain.com
OPENROUTER_HTTP_REFERER=https://yourdomain.com
```

5. **Redeploy** so `NEXT_PUBLIC_*` is baked into the client bundle.

---

## Step 6 — Redeploy after env changes

Public env vars (`NEXT_PUBLIC_*`) need a new deploy:

- **Deployments** → ⋮ on latest → **Redeploy**  
- Or push a commit to `main` (auto-deploy if Git is connected)

---

## After go-live checklist

1. Open site → PIN **`2580`**
2. **Settings** → fill profile  
3. Home → type `service status` → confirm free boards show **ready**  
4. `start scrape software engineer`  
5. Paste a recruiter email → open **Tables** / **Timeline**  
6. **Jobs** → pick a role → Research people & projects  

---

## Mic / voice on production

- Site must be **HTTPS** (Vercel provides this)  
- Allow **microphone** in the browser when prompted  
- Prefer **Chrome** for Web Speech API  

---

## PIN security note

PIN `2580` is a **browser session gate** (not real multi-user auth).  
Anyone who knows the PIN can open the app.

Change it before sharing widely:

```text
apps/web/src/components/PinGate.tsx  →  const PIN = "2580";
```

Then commit, push, and redeploy.

---

## Vercel project settings (copy-paste)

```text
Framework Preset:     Next.js
Root Directory:       ./
Install Command:      pnpm install
Build Command:        pnpm install && pnpm --filter @vexa/web build
Output Directory:     (default / empty)
Node.js Version:      20.x
```

### Minimum env

```text
NEXT_PUBLIC_APP_URL=https://<your-project>.vercel.app
APP_URL=https://<your-project>.vercel.app
```

### Recommended extra

```text
OPENROUTER_API_KEY=...
OPENROUTER_HTTP_REFERER=https://<your-project>.vercel.app
OPENROUTER_APP_TITLE=Vexa
```

---

## Continuous deploy

With Git connected:

```bash
git add .
git commit -m "your message"
git push origin main
```

Vercel rebuilds automatically on every push to `main`.

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [DEPLOY.md](./DEPLOY.md) | Railway, Docker, Fly, general |
| [PRODUCT.md](./PRODUCT.md) | Product rules |
| [FREE_STACK.md](./FREE_STACK.md) | Free scrapers |
| [../.env.example](../.env.example) | Full env list |

---

## Quick reference

| Item | Value |
|------|--------|
| Repo | https://github.com/knokvik/vexa |
| PIN | `2580` |
| Local dev | `pnpm dev` → http://127.0.0.1:5173 |
| Prod start (VPS) | `pnpm --filter @vexa/web start` |
