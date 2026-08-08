/**
 * Build graph nodes + edges for the draggable canvas.
 * email → job → company ; contact → company ; application stage as output
 */

import type {
  CrmApplication,
  CrmCompany,
  CrmContact,
  CrmEmail,
  CrmJob,
  GraphNodeLayout,
} from "@vexa/shared";
import { loadCrm, getGraphLayout } from "./db";

export type GraphNodeKind =
  | "email"
  | "job"
  | "company"
  | "contact"
  | "application";

export type GraphNode = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  meta: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
};

export type GraphModel = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    emails: number;
    jobs: number;
    companies: number;
    contacts: number;
    applications: number;
  };
};

function defaultPos(
  kind: GraphNodeKind,
  index: number,
  layout: GraphNodeLayout,
  id: string
): { x: number; y: number } {
  if (layout[id]) return layout[id];
  const col =
    kind === "email"
      ? 0
      : kind === "job"
        ? 1
        : kind === "application"
          ? 2
          : kind === "company"
            ? 3
            : 4;
  const row = index % 12;
  return {
    x: 40 + col * 220,
    y: 40 + row * 100,
  };
}

export async function buildGraphModel(limitEmails = 40): Promise<GraphModel> {
  const db = await loadCrm();
  const layout = await getGraphLayout();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const companies = db.companies;
  const jobs = db.jobs;
  const emails = db.emails.slice(0, limitEmails);
  const contacts = db.contacts;
  const apps = db.applications;

  companies.forEach((c, i) => {
    const id = `company:${c.id}`;
    seen.add(id);
    const pos = defaultPos("company", i, layout, id);
    nodes.push({
      id,
      kind: "company",
      label: c.name,
      sublabel: c.domain || "company",
      x: pos.x,
      y: pos.y,
      meta: { companyId: c.id, domain: c.domain },
    });
  });

  jobs.forEach((j, i) => {
    const id = `job:${j.id}`;
    seen.add(id);
    const pos = defaultPos("job", i, layout, id);
    nodes.push({
      id,
      kind: "job",
      label: j.title,
      sublabel: j.companyName,
      x: pos.x,
      y: pos.y,
      meta: { jobId: j.id, companyId: j.companyId },
    });
    const cid = `company:${j.companyId}`;
    if (seen.has(cid)) {
      edges.push({
        id: `e-${id}-${cid}`,
        from: id,
        to: cid,
        label: "at",
      });
    }
  });

  apps.forEach((a, i) => {
    const id = `app:${a.id}`;
    seen.add(id);
    const pos = defaultPos("application", i, layout, id);
    nodes.push({
      id,
      kind: "application",
      label: a.stage.toUpperCase(),
      sublabel: `${a.jobTitle} · ${a.companyName}`,
      x: pos.x,
      y: pos.y,
      meta: {
        applicationId: a.id,
        stage: a.stage,
        jobId: a.jobId,
        companyId: a.companyId,
        status: a.status,
      },
    });
    const jid = `job:${a.jobId}`;
    if (seen.has(jid)) {
      edges.push({
        id: `e-${jid}-${id}`,
        from: jid,
        to: id,
        label: "stage",
      });
    }
  });

  emails.forEach((e, i) => {
    const id = `email:${e.id}`;
    seen.add(id);
    const pos = defaultPos("email", i, layout, id);
    nodes.push({
      id,
      kind: "email",
      label: e.subject.slice(0, 48) || "(no subject)",
      sublabel: `${e.classification} · ${e.fromName || e.fromEmail}`,
      x: pos.x,
      y: pos.y,
      meta: {
        emailId: e.id,
        classification: e.classification,
        applicationId: e.applicationId,
        jobId: e.jobId,
        companyId: e.companyId,
        contactId: e.contactId,
        extracted: e.extracted,
      },
    });
    if (e.jobId && seen.has(`job:${e.jobId}`)) {
      edges.push({
        id: `e-${id}-job:${e.jobId}`,
        from: id,
        to: `job:${e.jobId}`,
        label: "about",
      });
    } else if (e.companyId && seen.has(`company:${e.companyId}`)) {
      edges.push({
        id: `e-${id}-company:${e.companyId}`,
        from: id,
        to: `company:${e.companyId}`,
        label: "from",
      });
    }
    if (e.applicationId && seen.has(`app:${e.applicationId}`)) {
      edges.push({
        id: `e-${id}-app:${e.applicationId}`,
        from: id,
        to: `app:${e.applicationId}`,
        label: "updates",
      });
    }
  });

  contacts.forEach((c, i) => {
    const id = `contact:${c.id}`;
    seen.add(id);
    const pos = defaultPos("contact", i, layout, id);
    nodes.push({
      id,
      kind: "contact",
      label: c.name,
      sublabel: c.email,
      x: pos.x,
      y: pos.y,
      meta: {
        contactId: c.id,
        roleType: c.roleType,
        companyId: c.companyId,
        companyName: c.companyName,
      },
    });
    if (c.companyId && seen.has(`company:${c.companyId}`)) {
      edges.push({
        id: `e-${id}-company:${c.companyId}`,
        from: id,
        to: `company:${c.companyId}`,
        label: "works at",
      });
    }
  });

  return {
    nodes,
    edges,
    stats: {
      emails: db.emails.length,
      jobs: db.jobs.length,
      companies: db.companies.length,
      contacts: db.contacts.length,
      applications: db.applications.length,
    },
  };
}

/** Connected component ids from a seed node */
export function connectedIds(
  seedId: string,
  edges: GraphEdge[]
): Set<string> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push(e.to);
    adj.get(e.to)!.push(e.from);
  }
  const out = new Set<string>();
  const stack = [seedId];
  while (stack.length) {
    const n = stack.pop()!;
    if (out.has(n)) continue;
    out.add(n);
    for (const m of adj.get(n) || []) stack.push(m);
  }
  return out;
}

export type FocusBundle = {
  node: GraphNode;
  connected: GraphNode[];
  edges: GraphEdge[];
  application?: CrmApplication;
  company?: CrmCompany;
  job?: CrmJob;
  email?: CrmEmail;
  contact?: CrmContact;
};

export async function focusNode(nodeId: string): Promise<FocusBundle | null> {
  const model = await buildGraphModel(80);
  const node = model.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const ids = connectedIds(nodeId, model.edges);
  const connected = model.nodes.filter((n) => ids.has(n.id));
  const edges = model.edges.filter(
    (e) => ids.has(e.from) && ids.has(e.to)
  );
  const db = await loadCrm();
  const meta = node.meta;
  return {
    node,
    connected,
    edges,
    application: meta.applicationId
      ? db.applications.find((a) => a.id === meta.applicationId)
      : undefined,
    company: meta.companyId
      ? db.companies.find((c) => c.id === meta.companyId)
      : undefined,
    job: meta.jobId ? db.jobs.find((j) => j.id === meta.jobId) : undefined,
    email: meta.emailId
      ? db.emails.find((e) => e.id === meta.emailId)
      : undefined,
    contact: meta.contactId
      ? db.contacts.find((c) => c.id === meta.contactId)
      : undefined,
  };
}
