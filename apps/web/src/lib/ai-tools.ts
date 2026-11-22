import {
  listUserTasks,
  upsertUserTask,
  deleteUserTask,
  listApplications,
  upsertApplication,
  deleteApplication,
  listCompanies,
  upsertCompany,
  deleteCompany,
  listContacts,
  upsertContact,
  deleteContact,
  listCrmJobs,
  upsertCrmJob,
  deleteCrmJob,
  loadCrm,
  newId,
} from "@/lib/crm/db";
import type { CrmUserTask, EisenhowerQuadrant, UserTaskKind } from "@vexa/shared";

export type TaskCategory = "personal" | "college" | "interview" | "other";

export function normalizeCategory(cat?: string): UserTaskKind {
  if (!cat) return "personal";
  const c = cat.toLowerCase().trim();
  if (c === "personal") return "personal";
  if (c === "college") return "college";
  if (c === "interview" || c === "prep" || c === "project" || c === "project_prep") return "project_prep";
  if (c === "career" || c === "job") return "job";
  return "other";
}

export function normalizeQuadrant(q?: string, urgent?: boolean, important?: boolean): EisenhowerQuadrant {
  if (q) {
    const lower = q.toLowerCase().trim();
    if (["q1", "q2", "q3", "q4"].includes(lower)) {
      return lower as EisenhowerQuadrant;
    }
  }
  if (urgent && important) return "q1";
  if (!urgent && important) return "q2";
  if (urgent && !important) return "q3";
  if (!urgent && !important) return "q4";
  return "q2"; // Default to Q2 (Important Deep Work)
}

// ── Tasks ──────────────────────────────────────────────

export async function executeListTasks(params: {
  quadrant?: string;
  category?: string;
  status?: "all" | "open" | "completed";
  search?: string;
}) {
  const includeAll = params.status === "all" || params.status === "completed";
  let tasks = await listUserTasks(includeAll);

  if (params.status === "completed") {
    tasks = tasks.filter((t) => t.done);
  } else if (params.status === "open") {
    tasks = tasks.filter((t) => !t.done);
  }

  if (params.quadrant) {
    const q = params.quadrant.toLowerCase().trim();
    tasks = tasks.filter((t) => (t.quadrant || "q2").toLowerCase() === q);
  }

  if (params.category) {
    const cat = params.category.toLowerCase().trim();
    tasks = tasks.filter((t) => {
      const kind = (t.kind || "").toLowerCase();
      if (cat === "personal") return kind === "personal";
      if (cat === "college") return kind === "college";
      if (cat === "interview" || cat === "prep" || cat === "project") {
        return kind.includes("interview") || kind.includes("prep") || kind.includes("project");
      }
      return kind === "other" || kind === "job" || kind === "career";
    });
  }

  if (params.search) {
    const s = params.search.toLowerCase().trim();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(s) ||
        (t.notes && t.notes.toLowerCase().includes(s))
    );
  }

  return {
    ok: true,
    count: tasks.length,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      category: t.kind,
      quadrant: t.quadrant || "q2",
      done: Boolean(t.done),
      dueAt: t.dueAt || null,
      notes: t.notes || "",
      urgent: Boolean(t.urgent),
      important: Boolean(t.important),
    })),
  };
}

export async function executeAddTask(params: {
  title: string;
  category: "personal" | "college" | "interview" | "other" | string;
  quadrant?: "q1" | "q2" | "q3" | "q4" | string;
  dueAt?: string;
  notes?: string;
  urgent?: boolean;
  important?: boolean;
}) {
  if (!params.title || !params.title.trim()) {
    throw new Error("Task title is required");
  }

  const kind = normalizeCategory(params.category);
  const quadrant = normalizeQuadrant(params.quadrant, params.urgent, params.important);

  const urgent = quadrant === "q1" || quadrant === "q3" || Boolean(params.urgent);
  const important = quadrant === "q1" || quadrant === "q2" || Boolean(params.important);

  const task = await upsertUserTask({
    title: params.title.trim(),
    kind,
    quadrant,
    urgent,
    important,
    dueAt: params.dueAt || undefined,
    notes: params.notes || undefined,
    done: false,
  });

  return {
    ok: true,
    message: `Task "${task.title}" added to ${task.quadrant?.toUpperCase()} (${task.kind})`,
    task,
  };
}

export async function executeUpdateTask(params: {
  id: string;
  title?: string;
  done?: boolean;
  quadrant?: "q1" | "q2" | "q3" | "q4" | string;
  category?: string;
  dueAt?: string;
  notes?: string;
}) {
  if (!params.id) {
    throw new Error("Task id is required");
  }

  const tasks = await listUserTasks(true);
  const existing = tasks.find((t) => t.id === params.id);
  if (!existing) {
    throw new Error(`Task with id "${params.id}" not found`);
  }

  const kind = params.category ? normalizeCategory(params.category) : existing.kind;
  const quadrant = params.quadrant
    ? normalizeQuadrant(params.quadrant)
    : (existing.quadrant || "q2");

  const task = await upsertUserTask({
    id: params.id,
    title: params.title !== undefined ? params.title.trim() : existing.title,
    kind,
    quadrant,
    done: params.done !== undefined ? params.done : existing.done,
    dueAt: params.dueAt !== undefined ? params.dueAt : existing.dueAt,
    notes: params.notes !== undefined ? params.notes : existing.notes,
  });

  return {
    ok: true,
    message: `Task "${task.title}" updated`,
    task,
  };
}

export async function executeDeleteTask(params: { id: string }) {
  if (!params.id) {
    throw new Error("Task id is required");
  }

  const deleted = await deleteUserTask(params.id);
  if (!deleted) {
    throw new Error(`Task with id "${params.id}" not found or could not be deleted`);
  }

  return {
    ok: true,
    message: `Task "${params.id}" deleted successfully`,
  };
}

// ── Tables ─────────────────────────────────────────────

export async function executeListTables() {
  const db = await loadCrm();
  const tasks = await listUserTasks(true);

  return {
    ok: true,
    tables: {
      tasks: {
        count: tasks.length,
        description: "Eisenhower matrix tasks across Personal, College, Prep/Projects, and Career",
        sample: tasks.slice(0, 5),
      },
      applications: {
        count: db.applications.length,
        description: "Job applications pipeline (stages: draft, applied, screen, technical, onsite, offer, rejected)",
        sample: db.applications.slice(0, 5),
      },
      companies: {
        count: db.companies.length,
        description: "Target companies and prospective employers",
        sample: db.companies.slice(0, 5),
      },
      contacts: {
        count: db.contacts.length,
        description: "Professional network, recruiters, engineers, and mentors",
        sample: db.contacts.slice(0, 5),
      },
      jobs: {
        count: db.jobs.length,
        description: "Discovered job listings and opportunities",
        sample: db.jobs.slice(0, 5),
      },
    },
  };
}

export async function executeGetTableRows(params: {
  table: "applications" | "jobs" | "companies" | "contacts" | "tasks" | string;
  limit?: number;
  search?: string;
}) {
  const tableName = params.table.toLowerCase().trim();
  const limit = params.limit || 50;
  const s = params.search ? params.search.toLowerCase().trim() : "";

  if (tableName === "tasks") {
    let rows = await listUserTasks(true);
    if (s) rows = rows.filter((r) => r.title.toLowerCase().includes(s));
    return { ok: true, table: "tasks", count: rows.length, rows: rows.slice(0, limit) };
  }

  if (tableName === "applications") {
    let rows = await listApplications();
    if (s) {
      rows = rows.filter(
        (r) =>
          r.companyName.toLowerCase().includes(s) ||
          r.jobTitle.toLowerCase().includes(s) ||
          r.stage.includes(s)
      );
    }
    return { ok: true, table: "applications", count: rows.length, rows: rows.slice(0, limit) };
  }

  if (tableName === "companies") {
    let rows = await listCompanies();
    if (s) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          (r.domain && r.domain.toLowerCase().includes(s))
      );
    }
    return { ok: true, table: "companies", count: rows.length, rows: rows.slice(0, limit) };
  }

  if (tableName === "contacts") {
    let rows = await listContacts();
    if (s) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(s) ||
          r.email.toLowerCase().includes(s) ||
          (r.companyName && r.companyName.toLowerCase().includes(s))
      );
    }
    return { ok: true, table: "contacts", count: rows.length, rows: rows.slice(0, limit) };
  }

  if (tableName === "jobs") {
    let rows = await listCrmJobs();
    if (s) {
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(s) ||
          r.companyName.toLowerCase().includes(s)
      );
    }
    return { ok: true, table: "jobs", count: rows.length, rows: rows.slice(0, limit) };
  }

  throw new Error(`Unknown table "${params.table}". Available: applications, jobs, companies, contacts, tasks`);
}

export async function executeAddTableRow(params: {
  table: "applications" | "jobs" | "companies" | "contacts" | "tasks" | string;
  data: Record<string, any>;
}) {
  const tableName = params.table.toLowerCase().trim();
  const d = params.data || {};

  if (tableName === "tasks") {
    return executeAddTask({
      title: d.title || d.name,
      category: d.category || d.kind || "personal",
      quadrant: d.quadrant || "q2",
      dueAt: d.dueAt,
      notes: d.notes,
      urgent: d.urgent,
      important: d.important,
    });
  }

  if (tableName === "applications") {
    const app = await upsertApplication({
      id: d.id,
      companyName: d.companyName || d.company || "Unknown Company",
      jobTitle: d.jobTitle || d.role || "Software Engineer",
      stage: d.stage || "applied",
      status: d.status || "active",
      source: d.source || "ai_agent",
      notes: d.notes,
      jobId: d.jobId || newId("job"),
      companyId: d.companyId || newId("co"),
      appliedAt: d.appliedAt || new Date().toISOString(),
    });
    return { ok: true, message: `Application for ${app.companyName} added`, row: app };
  }

  if (tableName === "companies") {
    const co = await upsertCompany({
      id: d.id,
      name: d.name || d.companyName || "New Company",
      domain: d.domain,
      industry: d.industry,
      size: d.size,
      careerPageUrl: d.careerPageUrl || d.url,
      notes: d.notes,
    });
    return { ok: true, message: `Company ${co.name} added`, row: co };
  }

  if (tableName === "contacts") {
    const ct = await upsertContact({
      id: d.id,
      name: d.name || "Contact",
      email: d.email || `${d.name?.toLowerCase().replace(/\s+/g, ".") || "contact"}@example.com`,
      companyName: d.companyName || d.company,
      title: d.title || d.role,
      roleType: d.roleType || "recruiter",
      linkedinUrl: d.linkedinUrl,
      notes: d.notes,
      strength: d.strength || 1,
    });
    return { ok: true, message: `Contact ${ct.name} added`, row: ct };
  }

  if (tableName === "jobs") {
    const job = await upsertCrmJob({
      id: d.id,
      title: d.title || "Job Listing",
      companyName: d.companyName || d.company || "Company",
      companyId: d.companyId || newId("co"),
      location: d.location,
      salaryRange: d.salaryRange || d.salary,
      sourceUrl: d.sourceUrl || d.url,
      requirements: Array.isArray(d.requirements) ? d.requirements : [],
    });
    return { ok: true, message: `Job ${job.title} at ${job.companyName} added`, row: job };
  }

  throw new Error(`Unknown table "${params.table}". Available: applications, jobs, companies, contacts, tasks`);
}

export async function executeUpdateTableRow(params: {
  table: "applications" | "jobs" | "companies" | "contacts" | "tasks" | string;
  id: string;
  data: Record<string, any>;
}) {
  if (!params.id) throw new Error("Row id is required");
  const tableName = params.table.toLowerCase().trim();
  const d = params.data || {};

  if (tableName === "tasks") {
    return executeUpdateTask({
      id: params.id,
      title: d.title,
      done: d.done,
      quadrant: d.quadrant,
      category: d.category || d.kind,
      dueAt: d.dueAt,
      notes: d.notes,
    });
  }

  if (tableName === "applications") {
    const apps = await listApplications();
    const existing = apps.find((a) => a.id === params.id);
    if (!existing) throw new Error(`Application with id "${params.id}" not found`);

    const app = await upsertApplication({
      ...existing,
      ...d,
      id: params.id,
      companyName: d.companyName || existing.companyName,
      jobTitle: d.jobTitle || existing.jobTitle,
      stage: d.stage || existing.stage,
      status: d.status || existing.status,
    });
    return { ok: true, message: `Application ${app.id} updated`, row: app };
  }

  if (tableName === "companies") {
    const companies = await listCompanies();
    const existing = companies.find((c) => c.id === params.id);
    if (!existing) throw new Error(`Company with id "${params.id}" not found`);

    const co = await upsertCompany({
      ...existing,
      ...d,
      id: params.id,
      name: d.name || existing.name,
    });
    return { ok: true, message: `Company ${co.name} updated`, row: co };
  }

  if (tableName === "contacts") {
    const contacts = await listContacts();
    const existing = contacts.find((c) => c.id === params.id);
    if (!existing) throw new Error(`Contact with id "${params.id}" not found`);

    const ct = await upsertContact({
      ...existing,
      ...d,
      id: params.id,
      name: d.name || existing.name,
      email: d.email || existing.email,
    });
    return { ok: true, message: `Contact ${ct.name} updated`, row: ct };
  }

  if (tableName === "jobs") {
    const jobs = await listCrmJobs();
    const existing = jobs.find((j) => j.id === params.id);
    if (!existing) throw new Error(`Job with id "${params.id}" not found`);

    const job = await upsertCrmJob({
      ...existing,
      ...d,
      id: params.id,
      title: d.title || existing.title,
      companyName: d.companyName || existing.companyName,
      companyId: existing.companyId,
    });
    return { ok: true, message: `Job ${job.title} updated`, row: job };
  }

  throw new Error(`Unknown table "${params.table}". Available: applications, jobs, companies, contacts, tasks`);
}

export async function executeDeleteTableRow(params: {
  table: "applications" | "jobs" | "companies" | "contacts" | "tasks" | string;
  id: string;
}) {
  if (!params.id) throw new Error("Row id is required");
  const tableName = params.table.toLowerCase().trim();

  if (tableName === "tasks") {
    return executeDeleteTask({ id: params.id });
  }

  if (tableName === "applications") {
    const deleted = await deleteApplication(params.id);
    if (!deleted) throw new Error(`Application with id "${params.id}" not found`);
    return { ok: true, message: `Application ${params.id} deleted` };
  }

  if (tableName === "companies") {
    const deleted = await deleteCompany(params.id);
    if (!deleted) throw new Error(`Company with id "${params.id}" not found`);
    return { ok: true, message: `Company ${params.id} deleted` };
  }

  if (tableName === "contacts") {
    const deleted = await deleteContact(params.id);
    if (!deleted) throw new Error(`Contact with id "${params.id}" not found`);
    return { ok: true, message: `Contact ${params.id} deleted` };
  }

  if (tableName === "jobs") {
    const deleted = await deleteCrmJob(params.id);
    if (!deleted) throw new Error(`Job with id "${params.id}" not found`);
    return { ok: true, message: `Job ${params.id} deleted` };
  }

  throw new Error(`Unknown table "${params.table}". Available: applications, jobs, companies, contacts, tasks`);
}
