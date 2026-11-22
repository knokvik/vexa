/**
 * Email-native CRM store (JSON durable).
 * Graph + pipeline tables under data/durable/crm.json
 */

import { promises as fs } from "fs";
import type {
  CrmAction,
  CrmApplication,
  CrmCompany,
  CrmContact,
  CrmEmail,
  CrmEvent,
  CrmJob,
  CrmRelationship,
  CrmSnapshot,
  CrmUserTask,
  GraphNodeLayout,
} from "@vexa/shared";
import { dataPath } from "@/lib/data-root";

const DATA_DIR = dataPath("durable");
const CRM_PATH = dataPath("durable", "crm.json");

function empty(): CrmSnapshot {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    companies: [],
    contacts: [],
    jobs: [],
    applications: [],
    emails: [],
    events: [],
    relationships: [],
    actions: [],
    userTasks: [],
    graphLayout: {},
  };
}

let cache: CrmSnapshot | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function loadCrm(): Promise<CrmSnapshot> {
  if (cache) return cache;
  await ensureDir();
  try {
    const raw = await fs.readFile(CRM_PATH, "utf8");
    cache = { ...empty(), ...JSON.parse(raw) } as CrmSnapshot;
  } catch {
    cache = empty();
  }
  return cache;
}

export async function saveCrm(
  mutator: (db: CrmSnapshot) => void
): Promise<CrmSnapshot> {
  writeQueue = writeQueue.then(async () => {
    const db = await loadCrm();
    mutator(db);
    db.updatedAt = new Date().toISOString();
    // caps
    db.emails = db.emails.slice(0, 2000);
    db.actions = db.actions.slice(0, 500);
    db.events = db.events.slice(0, 500);
    db.applications = db.applications.slice(0, 1000);
    cache = db;
    // Soft-fail disk: keep memory cache even if FS is read-only
    try {
      await ensureDir();
      const tmp = `${CRM_PATH}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
      await fs.rename(tmp, CRM_PATH);
    } catch {
      /* Vercel cold disk / race — cache still holds state for this instance */
    }
  });
  await writeQueue;
  return cache!;
}

export function getCrmPath() {
  return CRM_PATH;
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Companies ─────────────────────────────────────────

export async function upsertCompany(
  partial: Partial<CrmCompany> & { name: string }
): Promise<CrmCompany> {
  const now = new Date().toISOString();
  let result: CrmCompany | null = null;
  await saveCrm((db) => {
    const domain = partial.domain?.toLowerCase();
    const nameKey = partial.name.trim().toLowerCase();
    let existing = db.companies.find(
      (c) =>
        (domain && c.domain === domain) ||
        c.name.trim().toLowerCase() === nameKey ||
        (partial.id && c.id === partial.id)
    );
    if (existing) {
      existing = {
        ...existing,
        ...partial,
        name: partial.name || existing.name,
        updatedAt: now,
      };
      const i = db.companies.findIndex((c) => c.id === existing!.id);
      db.companies[i] = existing;
      result = existing;
    } else {
      const row: CrmCompany = {
        id: partial.id || newId("co"),
        name: partial.name,
        domain: partial.domain,
        industry: partial.industry,
        size: partial.size,
        careerPageUrl: partial.careerPageUrl,
        notes: partial.notes,
        healthSignals: partial.healthSignals || [],
        createdAt: now,
        updatedAt: now,
      };
      db.companies.unshift(row);
      result = row;
    }
  });
  return result!;
}

export async function listCompanies() {
  return (await loadCrm()).companies;
}

export async function deleteCompany(id: string): Promise<boolean> {
  let ok = false;
  await saveCrm((db) => {
    const before = db.companies.length;
    db.companies = db.companies.filter((c) => c.id !== id);
    ok = db.companies.length < before;
  });
  return ok;
}

// ── Contacts ──────────────────────────────────────────

export async function upsertContact(
  partial: Partial<CrmContact> & { email: string; name: string }
): Promise<CrmContact> {
  const now = new Date().toISOString();
  let result: CrmContact | null = null;
  await saveCrm((db) => {
    const email = partial.email.trim().toLowerCase();
    let existing = db.contacts.find(
      (c) =>
        c.email.toLowerCase() === email ||
        (partial.id && c.id === partial.id)
    );
    if (existing) {
      existing = {
        ...existing,
        ...partial,
        email,
        name: partial.name || existing.name,
        strength: Math.max(existing.strength, partial.strength ?? 0),
        updatedAt: now,
      };
      const i = db.contacts.findIndex((c) => c.id === existing!.id);
      db.contacts[i] = existing;
      result = existing;
    } else {
      const row: CrmContact = {
        id: partial.id || newId("ct"),
        name: partial.name,
        email,
        title: partial.title,
        companyId: partial.companyId,
        companyName: partial.companyName,
        linkedinUrl: partial.linkedinUrl,
        roleType: partial.roleType || "other",
        strength: partial.strength ?? 1,
        notes: partial.notes,
        createdAt: now,
        updatedAt: now,
      };
      db.contacts.unshift(row);
      result = row;
    }
  });
  return result!;
}

export async function listContacts() {
  return (await loadCrm()).contacts;
}

export async function deleteContact(id: string): Promise<boolean> {
  let ok = false;
  await saveCrm((db) => {
    const before = db.contacts.length;
    db.contacts = db.contacts.filter((c) => c.id !== id);
    ok = db.contacts.length < before;
  });
  return ok;
}

// ── Jobs ──────────────────────────────────────────────

export async function upsertCrmJob(
  partial: Partial<CrmJob> & {
    companyId: string;
    companyName: string;
    title: string;
  }
): Promise<CrmJob> {
  const now = new Date().toISOString();
  let result: CrmJob | null = null;
  await saveCrm((db) => {
    const titleKey = partial.title.trim().toLowerCase();
    let existing = db.jobs.find(
      (j) =>
        (partial.id && j.id === partial.id) ||
        (j.companyId === partial.companyId &&
          j.title.trim().toLowerCase() === titleKey)
    );
    if (existing) {
      existing = { ...existing, ...partial, updatedAt: now };
      const i = db.jobs.findIndex((j) => j.id === existing!.id);
      db.jobs[i] = existing;
      result = existing;
    } else {
      const row: CrmJob = {
        id: partial.id || newId("job"),
        companyId: partial.companyId,
        companyName: partial.companyName,
        title: partial.title,
        department: partial.department,
        location: partial.location,
        salaryRange: partial.salaryRange,
        postingDate: partial.postingDate,
        sourceUrl: partial.sourceUrl,
        requirements: partial.requirements || [],
        createdAt: now,
        updatedAt: now,
      };
      db.jobs.unshift(row);
      result = row;
    }
  });
  return result!;
}

export async function listCrmJobs() {
  return (await loadCrm()).jobs;
}

export async function deleteCrmJob(id: string): Promise<boolean> {
  let ok = false;
  await saveCrm((db) => {
    const before = db.jobs.length;
    db.jobs = db.jobs.filter((j) => j.id !== id);
    ok = db.jobs.length < before;
  });
  return ok;
}

// ── Applications ──────────────────────────────────────

export async function upsertApplication(
  partial: Partial<CrmApplication> & {
    jobId: string;
    companyId: string;
    companyName: string;
    jobTitle: string;
    stage: CrmApplication["stage"];
  }
): Promise<CrmApplication> {
  const now = new Date().toISOString();
  let result: CrmApplication | null = null;
  await saveCrm((db) => {
    let existing = db.applications.find(
      (a) =>
        (partial.id && a.id === partial.id) ||
        (a.jobId === partial.jobId && a.status === "active")
    );
    if (existing) {
      existing = {
        ...existing,
        ...partial,
        contactIds: [
          ...new Set([
            ...(existing.contactIds || []),
            ...(partial.contactIds || []),
          ]),
        ],
        emailIds: [
          ...new Set([
            ...(existing.emailIds || []),
            ...(partial.emailIds || []),
          ]),
        ],
        eventIds: [
          ...new Set([
            ...(existing.eventIds || []),
            ...(partial.eventIds || []),
          ]),
        ],
        lastTouchAt: partial.lastTouchAt || now,
        updatedAt: now,
      };
      const i = db.applications.findIndex((a) => a.id === existing!.id);
      db.applications[i] = existing;
      result = existing;
    } else {
      const row: CrmApplication = {
        id: partial.id || newId("app"),
        jobId: partial.jobId,
        companyId: partial.companyId,
        companyName: partial.companyName,
        jobTitle: partial.jobTitle,
        stage: partial.stage,
        appliedAt: partial.appliedAt,
        lastTouchAt: partial.lastTouchAt || now,
        source: partial.source || "email",
        status: partial.status || "active",
        rejectionReason: partial.rejectionReason,
        notes: partial.notes,
        contactIds: partial.contactIds || [],
        emailIds: partial.emailIds || [],
        eventIds: partial.eventIds || [],
        createdAt: now,
        updatedAt: now,
      };
      db.applications.unshift(row);
      result = row;
    }
  });
  return result!;
}

export async function listApplications() {
  return (await loadCrm()).applications;
}

export async function getApplication(id: string) {
  return (await loadCrm()).applications.find((a) => a.id === id) ?? null;
}

export async function deleteApplication(id: string): Promise<boolean> {
  let ok = false;
  await saveCrm((db) => {
    const before = db.applications.length;
    db.applications = db.applications.filter((a) => a.id !== id);
    ok = db.applications.length < before;
  });
  return ok;
}

// ── Emails ────────────────────────────────────────────

export async function insertEmail(row: CrmEmail) {
  await saveCrm((db) => {
    if (row.messageId && db.emails.some((e) => e.messageId === row.messageId)) {
      return;
    }
    db.emails.unshift(row);
  });
  return row;
}

export async function listEmails(limit = 100) {
  return (await loadCrm()).emails.slice(0, limit);
}

// ── Events ────────────────────────────────────────────

export async function upsertEvent(
  partial: Partial<CrmEvent> & { type: CrmEvent["type"]; title: string }
): Promise<CrmEvent> {
  const now = new Date().toISOString();
  let result: CrmEvent | null = null;
  await saveCrm((db) => {
    if (partial.id) {
      const i = db.events.findIndex((e) => e.id === partial.id);
      if (i >= 0) {
        db.events[i] = { ...db.events[i], ...partial, updatedAt: now };
        result = db.events[i];
        return;
      }
    }
    const row: CrmEvent = {
      id: partial.id || newId("ev"),
      type: partial.type,
      title: partial.title,
      datetime: partial.datetime,
      endDatetime: partial.endDatetime,
      applicationId: partial.applicationId,
      companyId: partial.companyId,
      contactIds: partial.contactIds || [],
      prepNotes: partial.prepNotes,
      done: partial.done ?? false,
      createdAt: now,
      updatedAt: now,
    };
    db.events.unshift(row);
    result = row;
  });
  return result!;
}

export async function listEvents() {
  return (await loadCrm()).events;
}

// ── Relationships ─────────────────────────────────────

export async function addRelationship(
  partial: Omit<CrmRelationship, "id" | "createdAt"> & { id?: string }
): Promise<CrmRelationship> {
  const now = new Date().toISOString();
  let result: CrmRelationship | null = null;
  await saveCrm((db) => {
    const existing = db.relationships.find(
      (r) =>
        r.fromContactId === partial.fromContactId &&
        r.toContactId === partial.toContactId &&
        r.type === partial.type
    );
    if (existing) {
      existing.strength = Math.max(existing.strength, partial.strength);
      if (partial.note) existing.note = partial.note;
      result = existing;
      return;
    }
    const row: CrmRelationship = {
      id: partial.id || newId("rel"),
      fromContactId: partial.fromContactId,
      toContactId: partial.toContactId,
      type: partial.type,
      strength: partial.strength,
      note: partial.note,
      createdAt: now,
    };
    db.relationships.unshift(row);
    result = row;
  });
  return result!;
}

export async function listRelationships() {
  return (await loadCrm()).relationships;
}

// ── Actions ───────────────────────────────────────────

export async function upsertAction(
  partial: Partial<CrmAction> & {
    kind: CrmAction["kind"];
    title: string;
    priority: CrmAction["priority"];
  }
): Promise<CrmAction> {
  const now = new Date().toISOString();
  let result: CrmAction | null = null;
  await saveCrm((db) => {
    // de-dupe open actions by title+app
    const open = db.actions.find(
      (a) =>
        !a.done &&
        a.title === partial.title &&
        a.applicationId === partial.applicationId
    );
    if (open) {
      result = open;
      return;
    }
    const row: CrmAction = {
      id: partial.id || newId("act"),
      kind: partial.kind,
      title: partial.title,
      detail: partial.detail,
      dueAt: partial.dueAt,
      applicationId: partial.applicationId,
      companyId: partial.companyId,
      contactId: partial.contactId,
      priority: partial.priority,
      done: partial.done ?? false,
      createdAt: now,
    };
    db.actions.unshift(row);
    result = row;
  });
  return result!;
}

export async function listActions(includeDone = false) {
  const acts = (await loadCrm()).actions;
  return includeDone ? acts : acts.filter((a) => !a.done);
}

export async function markActionDone(id: string) {
  await saveCrm((db) => {
    const a = db.actions.find((x) => x.id === id);
    if (a) a.done = true;
  });
}

// ── User tasks (jobs, conferences, personal, college, interview prep) ──────────

function defaultSeedTasks(): CrmUserTask[] {
  const now = new Date();
  const formatIsoHours = (hoursAhead: number) => {
    return new Date(now.getTime() + hoursAhead * 3600 * 1000).toISOString();
  };

  return [
    {
      id: "task_personal_unicorn_rc",
      title: "Unicorn Bike RC (Registration Certificate)",
      kind: "personal",
      quadrant: "q1",
      urgent: true,
      important: true,
      dueAt: formatIsoHours(24),
      notes: "Honda Unicorn bike RC transfer / renewal, check Parivahan Sewa portal and RTO status.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_personal_icici_fd",
      title: "ICICI Bank FD (Fixed Deposit)",
      kind: "personal",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(48),
      notes: "Review ICICI Bank fixed deposit interest rates, tenure options, and manage FD renewal/investment.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_hack_1",
      title: "BVDCU HackNova Hackathon PPT & Demo Deck",
      kind: "project_prep",
      quadrant: "q1",
      urgent: true,
      important: true,
      dueAt: formatIsoHours(8),
      notes: "BVDCU HackNova Hackathon presentation slides, system architecture, live demo prototype.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_hack_2",
      title: "WeMakeDevs Festive Hacks 2026 Submission",
      kind: "project_prep",
      quadrant: "q1",
      urgent: true,
      important: true,
      dueAt: formatIsoHours(14),
      notes: "WeMakeDevs Festive Hacks 2026 project development, GitHub repo readme, video pitch.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_hack_3",
      title: "QNH 27 Hackathon Project & Prototype",
      kind: "project_prep",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(48),
      notes: "QNH 27 hackathon problem statement selection, backend APIs and agent integration.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_hack_4",
      title: "Indradhanu PCCOE Hackathon Presentation",
      kind: "college",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(60),
      notes: "PCCOE Indradhanu hackathon round submission & presentation deck.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_hack_5",
      title: "K J Somaiya Agri-Tech Hackathon Solution",
      kind: "college",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(72),
      notes: "K J Somaiya agricultural tech hackathon problem statement & prototype implementation.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_1",
      title: "Major Radar Review",
      kind: "college",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(36),
      notes: "Major Radar college review & submission documentation.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_2",
      title: "Linux & CI Project Review",
      kind: "college",
      quadrant: "q1",
      urgent: true,
      important: true,
      dueAt: formatIsoHours(18),
      notes: "Linux lab evaluation and CI/CD project review.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_3",
      title: "FHT Project & Documentation",
      kind: "college",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(54),
      notes: "FHT project report, diagrams and documentation.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_4",
      title: "CLD Soc Activity ( Sada )",
      kind: "college",
      quadrant: "q3",
      urgent: true,
      important: false,
      dueAt: formatIsoHours(10),
      notes: "CLD Soc Activity submission.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_5",
      title: "Linux Overdue Activity & CS Overdued Activity",
      kind: "college",
      quadrant: "q1",
      urgent: true,
      important: true,
      dueAt: formatIsoHours(6),
      notes: "Clear pending Linux lab and CS assignments.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_6",
      title: "Biomedical Industry Visit Report",
      kind: "college",
      quadrant: "q3",
      urgent: true,
      important: false,
      dueAt: formatIsoHours(24),
      notes: "Draft and submit industrial visit reflection report.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_7",
      title: "Scholarship MAHADBT Verification",
      kind: "personal",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(96),
      notes: "Upload income certificate, marksheet and college fee receipt to MahaDBT portal.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_8",
      title: "Cummins Follow Up",
      kind: "interview",
      quadrant: "q3",
      urgent: true,
      important: false,
      dueAt: formatIsoHours(12),
      notes: "Follow up regarding Cummins hiring / interview process.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_9",
      title: "Photo PD Transfer",
      kind: "personal",
      quadrant: "q4",
      urgent: false,
      important: false,
      dueAt: formatIsoHours(30),
      notes: "Pen drive / pendrive data & photo backup transfer.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_google_10",
      title: "Reimbursement Form and Process",
      kind: "personal",
      quadrant: "q3",
      urgent: true,
      important: false,
      dueAt: formatIsoHours(16),
      notes: "Submit bills, invoices and college reimbursement form.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_seed_1",
      title: "Optimize C++ LOB Matching Engine (benchmark cache misses & lock-free queue)",
      kind: "project_prep",
      quadrant: "q1",
      urgent: true,
      important: true,
      dueAt: formatIsoHours(6),
      notes: "Profile with perf / Valgrind. Target sub-microsecond tick-to-trade latency.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_seed_2",
      title: "Submit Distributed Systems Assignment: Raft Consensus implementation",
      kind: "college",
      quadrant: "q1",
      urgent: true,
      important: true,
      dueAt: formatIsoHours(12),
      notes: "Upload lab PDF and GitHub repo link to college portal before deadline.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_seed_3",
      title: "System Design Prep: High-Throughput Market Data Feed Handler & RocksDB",
      kind: "interview",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(48),
      notes: "Practice order book reconstruction, sequence numbering, and replay buffers.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_seed_4",
      title: "Deep Dive into USearch Vector Hybrid Search & SIMD Acceleration",
      kind: "project_prep",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(72),
      notes: "Benchmark AVX-512 vs NEON distance kernels on Apple Silicon.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_seed_5",
      title: "Study for Compiler Design Midterm: LR(1) Parsers & AST Optimizations",
      kind: "college",
      quadrant: "q2",
      urgent: false,
      important: true,
      dueAt: formatIsoHours(96),
      notes: "Solve last 3 years university question papers.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_seed_6",
      title: "Evening Gym Session: Deadlifts & Upper Body Hypertrophy",
      kind: "personal",
      quadrant: "q3",
      urgent: true,
      important: false,
      dueAt: formatIsoHours(4),
      notes: "Hit 5 sets heavy deadlifts + mobility work.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_seed_7",
      title: "Reply to College Project Group Chat regarding presentation slides",
      kind: "college",
      quadrant: "q3",
      urgent: true,
      important: false,
      dueAt: formatIsoHours(2),
      notes: "Confirm slide deck template and speaking order.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_seed_8",
      title: "Meal Prep & Grocery: High Protein Groceries for the Week",
      kind: "personal",
      quadrant: "q4",
      urgent: false,
      important: false,
      dueAt: formatIsoHours(40),
      notes: "Eggs, chicken breast, oats, greek yogurt, peanut butter.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      id: "task_seed_9",
      title: "Read Paper: 'Flash Boys & Fast Quotes: Latency in Modern Markets'",
      kind: "interview",
      quadrant: "q4",
      urgent: false,
      important: false,
      dueAt: formatIsoHours(120),
      notes: "Annotate key findings on queue position and adverse selection.",
      done: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];
}

export async function listUserTasks(includeDone = false) {
  const db = await loadCrm();
  const seed = defaultSeedTasks();

  if (!db.userTasks || db.userTasks.length === 0) {
    db.userTasks = seed;
  } else {
    // Merge any missing seed tasks (e.g. newly deployed hackathons & personal tasks)
    const existingTitles = new Set(
      db.userTasks.map((t) => t.title.toLowerCase().trim())
    );
    const missingSeedTasks = seed.filter(
      (s) => !existingTitles.has(s.title.toLowerCase().trim())
    );
    if (missingSeedTasks.length > 0) {
      db.userTasks = [...missingSeedTasks, ...db.userTasks];
    }
  }

  const tasks = db.userTasks || [];
  return includeDone ? tasks : tasks.filter((t) => !t.done);
}

export async function deleteUserTask(id: string): Promise<boolean> {
  let ok = false;
  await saveCrm((db) => {
    if (!db.userTasks) return;
    const before = db.userTasks.length;
    db.userTasks = db.userTasks.filter((t) => t.id !== id);
    ok = db.userTasks.length < before;
  });
  return ok;
}

export async function findTasksByTitle(query: string) {
  const q = query.trim().toLowerCase();
  const tasks = await listUserTasks(true);
  return tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.companyName?.toLowerCase().includes(q)
  );
}

export async function upsertUserTask(
  partial: Partial<CrmUserTask> & { title: string; kind: CrmUserTask["kind"] }
): Promise<CrmUserTask> {
  const now = new Date().toISOString();
  let result: CrmUserTask | null = null;
  await saveCrm((db) => {
    if (!db.userTasks) db.userTasks = [];
    if (partial.id) {
      const i = db.userTasks.findIndex((t) => t.id === partial.id);
      if (i >= 0) {
        db.userTasks[i] = {
          ...db.userTasks[i],
          ...partial,
          updatedAt: now,
        };
        result = db.userTasks[i];
        return;
      }
    }
    const row: CrmUserTask = {
      id: partial.id || newId("task"),
      title: partial.title,
      kind: partial.kind,
      companyId: partial.companyId,
      companyName: partial.companyName,
      applicationId: partial.applicationId,
      dueAt: partial.dueAt,
      notes: partial.notes,
      done: partial.done ?? false,
      quadrant: partial.quadrant || (partial.urgent && partial.important ? "q1" : !partial.urgent && partial.important ? "q2" : partial.urgent && !partial.important ? "q3" : "q4"),
      urgent: partial.urgent,
      important: partial.important,
      createdAt: now,
      updatedAt: now,
    };
    db.userTasks.unshift(row);
    result = row;
  });
  return result!;
}

export async function saveGraphLayout(layout: GraphNodeLayout) {
  await saveCrm((db) => {
    db.graphLayout = { ...(db.graphLayout || {}), ...layout };
  });
}

export async function getGraphLayout(): Promise<GraphNodeLayout> {
  return (await loadCrm()).graphLayout || {};
}
