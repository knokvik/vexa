/**
 * Long-lived application memory (single-user).
 * Stores companies applied, jobs queued/submitted, searches, intel scans —
 * for Obsidian vault + graph view.
 */

import { promises as fs } from "fs";
import path from "path";

export type MemoryEventType =
  | "search"
  | "discovered"
  | "intel_scan"
  | "apply_later"
  | "draft_prepared"
  | "submitted"
  | "company";

export type MemoryEvent = {
  id: string;
  type: MemoryEventType;
  at: string;
  company?: string;
  title?: string;
  jobId?: string;
  url?: string;
  query?: string;
  status?: string;
  note?: string;
  meta?: Record<string, unknown>;
};

export type CompanyMemory = {
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  appliedCount: number;
  queuedCount: number;
  submittedCount: number;
  jobs: Array<{
    jobId: string;
    title: string;
    url?: string;
    status: string;
    at: string;
  }>;
};

export type AppMemoryStore = {
  updatedAt: string;
  events: MemoryEvent[];
  companies: Record<string, CompanyMemory>;
  searches: string[];
};

const DATA_DIR = path.join(process.cwd(), "data", "memory");
const STORE_PATH = path.join(DATA_DIR, "app-memory.json");
const MD_PATH = path.join(DATA_DIR, "APP_MEMORY.md");
const VAULT_MD = path.join(
  process.cwd(),
  "..",
  "..",
  "memory",
  "APP_MEMORY.md"
);

function companyKey(name: string) {
  return name.trim().toLowerCase() || "unknown";
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.mkdir(path.dirname(VAULT_MD), { recursive: true });
  } catch {
    /* ignore */
  }
}

export async function loadAppMemory(): Promise<AppMemoryStore> {
  await ensureDir();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as AppMemoryStore;
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      events: [],
      companies: {},
      searches: [],
    };
  }
}

async function writeMarkdown(store: AppMemoryStore) {
  const companies = Object.values(store.companies).sort(
    (a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)
  );
  const lines = [
    `# Vexa application memory`,
    ``,
    `Updated: ${store.updatedAt}`,
    ``,
    `## Companies`,
    ``,
    ...companies.flatMap((c) => [
      `### ${c.name}`,
      `- first seen: ${c.firstSeenAt}`,
      `- last seen: ${c.lastSeenAt}`,
      `- queued: ${c.queuedCount} · prepared: ${c.appliedCount} · submitted: ${c.submittedCount}`,
      ...c.jobs.slice(0, 12).map(
        (j) =>
          `  - [${j.status}] **${j.title}** (\`${j.jobId.slice(0, 8)}\`)${j.url ? ` — ${j.url}` : ""}`
      ),
      ``,
    ]),
    `## Recent searches`,
    ``,
    ...store.searches.slice(0, 30).map((q) => `- ${q}`),
    ``,
    `## Event log`,
    ``,
    ...store.events.slice(0, 80).map(
      (e) =>
        `- **${e.type}** ${e.at.slice(0, 19)} ${e.company ? `· ${e.company}` : ""}${e.title ? ` · ${e.title}` : ""}${e.query ? ` · “${e.query}”` : ""}${e.note ? ` — ${e.note}` : ""}`
    ),
    ``,
  ];
  const md = lines.join("\n");
  await fs.writeFile(MD_PATH, md, "utf8");
  try {
    await fs.writeFile(VAULT_MD, md, "utf8");
  } catch {
    /* ignore */
  }
}

export async function saveAppMemory(store: AppMemoryStore): Promise<void> {
  await ensureDir();
  store.updatedAt = new Date().toISOString();
  // keep tails bounded
  store.events = store.events.slice(0, 500);
  store.searches = store.searches.slice(0, 100);
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  await writeMarkdown(store);
}

function touchCompany(
  store: AppMemoryStore,
  company: string,
  job: { jobId: string; title: string; url?: string; status: string }
) {
  const key = companyKey(company);
  const now = new Date().toISOString();
  let c = store.companies[key];
  if (!c) {
    c = {
      name: company,
      firstSeenAt: now,
      lastSeenAt: now,
      appliedCount: 0,
      queuedCount: 0,
      submittedCount: 0,
      jobs: [],
    };
    store.companies[key] = c;
  }
  c.lastSeenAt = now;
  const prev = c.jobs.find((j) => j.jobId === job.jobId);
  c.jobs = [
    { ...job, at: now },
    ...c.jobs.filter((j) => j.jobId !== job.jobId),
  ].slice(0, 40);
  // Count only on first time we see this status for the job
  if (prev?.status === job.status) return;
  if (job.status === "apply_later" || job.status === "queued") c.queuedCount += 1;
  if (job.status === "draft_prepared" || job.status === "prepared")
    c.appliedCount += 1;
  if (job.status === "submitted") c.submittedCount += 1;
}

export async function rememberEvent(
  partial: Omit<MemoryEvent, "id" | "at"> & { id?: string }
): Promise<AppMemoryStore> {
  const store = await loadAppMemory();
  const event: MemoryEvent = {
    id: partial.id || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...partial,
  };
  store.events.unshift(event);

  if (partial.query) {
    store.searches = [
      partial.query,
      ...store.searches.filter((q) => q !== partial.query),
    ].slice(0, 100);
  }

  if (partial.company && partial.jobId) {
    touchCompany(store, partial.company, {
      jobId: partial.jobId,
      title: partial.title || "Role",
      url: partial.url,
      status:
        partial.type === "submitted"
          ? "submitted"
          : partial.type === "apply_later"
            ? "apply_later"
            : partial.type === "draft_prepared"
              ? "draft_prepared"
              : partial.type,
    });
  } else if (partial.company && partial.type === "company") {
    touchCompany(store, partial.company, {
      jobId: partial.jobId || `co_${companyKey(partial.company)}`,
      title: partial.title || "—",
      url: partial.url,
      status: "seen",
    });
  }

  await saveAppMemory(store);
  return store;
}

/** Graph-friendly nodes from app memory */
export function appMemoryToGraphParts(store: AppMemoryStore): {
  nodes: Array<{ id: string; label: string; group: string; size: number }>;
  links: Array<{ source: string; target: string }>;
} {
  const nodes: Array<{ id: string; label: string; group: string; size: number }> =
    [];
  const links: Array<{ source: string; target: string }> = [];
  const seen = new Set<string>();

  const add = (id: string, label: string, group: string, size: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, label, group, size });
  };

  add("hub:companies", "companies", "type", 16);
  add("hub:applied", "applied", "status", 12);
  add("hub:queued", "queued", "status", 12);
  add("hub:searches", "searches", "type", 12);

  for (const c of Object.values(store.companies)) {
    const cid = `company:${c.name.toLowerCase()}`;
    add(cid, c.name, "company", 10 + Math.min(8, c.submittedCount + c.queuedCount));
    links.push({ source: "hub:companies", target: cid });
    if (c.submittedCount > 0) links.push({ source: cid, target: "hub:applied" });
    if (c.queuedCount > 0) links.push({ source: cid, target: "hub:queued" });
    for (const j of c.jobs.slice(0, 6)) {
      const jid = `jobmem:${j.jobId}`;
      add(jid, j.title.slice(0, 24), "task", 8);
      links.push({ source: cid, target: jid });
    }
  }

  for (const q of store.searches.slice(0, 15)) {
    const qid = `search:${q.toLowerCase().slice(0, 40)}`;
    add(qid, q.slice(0, 28), "note", 7);
    links.push({ source: "hub:searches", target: qid });
  }

  return { nodes, links };
}
