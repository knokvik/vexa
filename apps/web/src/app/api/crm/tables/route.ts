import { NextResponse } from "next/server";
import { loadCrm, listUserTasks } from "@/lib/crm/db";

/**
 * GET /api/crm/tables
 * Supabase-style table dumps + contribution heatmap + side tools.
 */
export async function GET() {
  const db = await loadCrm();
  const tasks = await listUserTasks(true);

  const emails = db.emails.slice(0, 40).map((e) => ({
    id: e.id,
    classification: e.classification,
    subject: e.subject.slice(0, 80),
    from: e.fromEmail,
    company: e.extracted.companyName || "—",
    job: e.extracted.jobTitle || "—",
    stage_link: e.applicationId ? "linked" : "—",
    at: e.receivedAt.slice(0, 10),
  }));

  const companies = db.companies.slice(0, 40).map((c) => {
    const apps = db.applications.filter((a) => a.companyId === c.id);
    const applied = apps.some((a) =>
      ["applied", "screen", "technical", "onsite", "offer", "accepted"].includes(
        a.stage
      )
    );
    return {
      id: c.id,
      name: c.name,
      domain: c.domain || "—",
      applied: applied ? "yes" : "no",
      apps: apps.length,
      contacts: db.contacts.filter((x) => x.companyId === c.id).length,
    };
  });

  const applications = db.applications.slice(0, 40).map((a) => ({
    id: a.id,
    company: a.companyName,
    role: a.jobTitle,
    stage: a.stage,
    source: a.source,
    status: a.status,
    last_touch: a.lastTouchAt.slice(0, 10),
  }));

  const jobs = db.jobs.slice(0, 40).map((j) => ({
    id: j.id,
    title: j.title,
    company: j.companyName,
    location: j.location || "—",
    salary: j.salaryRange || "—",
  }));

  const contacts = db.contacts.slice(0, 40).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    role: c.roleType,
    title: c.title || "—",
    company: c.companyName || "—",
    strength: c.strength,
  }));

  // Side tools from user tasks
  const conferences = tasks.filter(
    (t) => t.kind === "conference" || /conference|meetup|summit/i.test(t.title)
  );
  const scholarships = tasks.filter((t) =>
    /scholar|grant|fellowship/i.test(t.title + (t.notes || ""))
  );
  const hackathons = tasks.filter((t) =>
    /hackathon|hack day|code jam|coding competition/i.test(
      t.title + (t.notes || "")
    )
  );
  const other = tasks.filter(
    (t) =>
      !conferences.includes(t) &&
      !scholarships.includes(t) &&
      !hackathons.includes(t) &&
      t.kind !== "job"
  );

  // Contribution heatmap: full year using local dates (avoid UTC day shift)
  const localKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const days: Record<string, number> = {};
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days[localKey(d)] = 0;
  }
  const bump = (iso?: string, n = 1) => {
    if (!iso) return;
    // Prefer local calendar day from ISO
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return;
    const key = localKey(parsed);
    if (key in days) days[key] += n;
  };
  for (const e of db.emails) bump(e.receivedAt, 2);
  for (const a of db.applications) bump(a.updatedAt || a.createdAt, 1);
  for (const t of tasks) bump(t.updatedAt || t.createdAt, 1);
  for (const ev of db.events) bump(ev.createdAt, 1);
  for (const act of db.actions) bump(act.createdAt, 1);

  const contribution = Object.entries(days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return NextResponse.json({
    ok: true,
    tables: {
      emails: { name: "emails", columns: Object.keys(emails[0] || { id: "", subject: "", from: "", classification: "", company: "", at: "" }), rows: emails },
      companies: {
        name: "companies",
        columns: ["id", "name", "domain", "applied", "apps", "contacts"],
        rows: companies,
      },
      applications: {
        name: "applications",
        columns: ["id", "company", "role", "stage", "source", "status", "last_touch"],
        rows: applications,
      },
      jobs: {
        name: "jobs",
        columns: ["id", "title", "company", "location", "salary"],
        rows: jobs,
      },
      contacts: {
        name: "contacts",
        columns: ["id", "name", "email", "role", "title", "company", "strength"],
        rows: contacts,
      },
    },
    side: {
      conferences: conferences.map((t) => ({
        id: t.id,
        title: t.title,
        due: t.dueAt?.slice(0, 10),
        done: t.done,
      })),
      scholarships: scholarships.map((t) => ({
        id: t.id,
        title: t.title,
        due: t.dueAt?.slice(0, 10),
        done: t.done,
      })),
      hackathons: hackathons.map((t) => ({
        id: t.id,
        title: t.title,
        due: t.dueAt?.slice(0, 10),
        done: t.done,
      })),
      other: other.slice(0, 20).map((t) => ({
        id: t.id,
        title: t.title,
        kind: t.kind,
        done: t.done,
      })),
    },
    contribution,
    counts: {
      emails: db.emails.length,
      companies: db.companies.length,
      applications: db.applications.length,
      jobs: db.jobs.length,
      contacts: db.contacts.length,
    },
  });
}
