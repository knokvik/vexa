/**
 * Interconnection graph queries — who do I know, referral paths.
 */

import type { CrmContact, CrmRelationship, CrmCompany } from "@vexa/shared";
import { loadCrm } from "./db";

export type ContactAtCompany = {
  contact: CrmContact;
  company: CrmCompany | null;
  path: string[];
  hops: number;
};

/** Direct contacts at a company (by id or name) */
export async function whoDoIKnowAt(
  companyQuery: string
): Promise<ContactAtCompany[]> {
  const db = await loadCrm();
  const q = companyQuery.trim().toLowerCase();
  if (!q) return [];

  const companies = db.companies.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.domain?.toLowerCase().includes(q) ||
      c.id === companyQuery
  );
  const companyIds = new Set(companies.map((c) => c.id));
  const companyNames = new Set(companies.map((c) => c.name.toLowerCase()));

  const hits = db.contacts.filter((ct) => {
    if (ct.companyId && companyIds.has(ct.companyId)) return true;
    if (ct.companyName && companyNames.has(ct.companyName.toLowerCase()))
      return true;
    if (ct.companyName?.toLowerCase().includes(q)) return true;
    return false;
  });

  return hits.map((contact) => {
    const company =
      companies.find((c) => c.id === contact.companyId) ||
      db.companies.find(
        (c) =>
          c.name.toLowerCase() === (contact.companyName || "").toLowerCase()
      ) ||
      null;
    return {
      contact,
      company,
      path: [contact.name],
      hops: 1,
    };
  });
}

/** 2nd-degree: contacts who know people at target company */
export async function referralPathsTo(
  companyQuery: string
): Promise<
  Array<{
    bridge: CrmContact;
    target: CrmContact;
    relationship: CrmRelationship;
    companyName: string;
  }>
> {
  const direct = await whoDoIKnowAt(companyQuery);
  const targetIds = new Set(direct.map((d) => d.contact.id));
  if (!targetIds.size) return [];

  const db = await loadCrm();
  const out: Array<{
    bridge: CrmContact;
    target: CrmContact;
    relationship: CrmRelationship;
    companyName: string;
  }> = [];

  for (const rel of db.relationships) {
    const fromIsTarget = targetIds.has(rel.fromContactId);
    const toIsTarget = targetIds.has(rel.toContactId);
    if (fromIsTarget === toIsTarget) continue;

    const targetId = fromIsTarget ? rel.fromContactId : rel.toContactId;
    const bridgeId = fromIsTarget ? rel.toContactId : rel.fromContactId;
    const target = db.contacts.find((c) => c.id === targetId);
    const bridge = db.contacts.find((c) => c.id === bridgeId);
    if (!target || !bridge) continue;
    if (targetIds.has(bridge.id)) continue; // only bridges outside

    out.push({
      bridge,
      target,
      relationship: rel,
      companyName: target.companyName || companyQuery,
    });
  }

  return out.slice(0, 50);
}

/** Network summary for UI */
export async function networkSummary() {
  const db = await loadCrm();
  const byCompany = new Map<string, number>();
  for (const c of db.contacts) {
    const key = c.companyName || "Unknown";
    byCompany.set(key, (byCompany.get(key) || 0) + 1);
  }
  const warmCompanies = [...byCompany.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  return {
    contactCount: db.contacts.length,
    companyCount: db.companies.length,
    relationshipCount: db.relationships.length,
    warmCompanies,
    contacts: db.contacts,
    relationships: db.relationships,
    companies: db.companies,
  };
}

/** Ghost rate by contact (recruiter response intelligence) */
export async function contactResponseStats(contactId: string) {
  const db = await loadCrm();
  const apps = db.applications.filter((a) =>
    a.contactIds.includes(contactId)
  );
  const ghosted = apps.filter((a) => a.stage === "ghosted").length;
  const rejected = apps.filter((a) => a.stage === "rejected").length;
  const advanced = apps.filter((a) =>
    ["screen", "technical", "onsite", "offer", "accepted"].includes(a.stage)
  ).length;
  return {
    applications: apps.length,
    ghosted,
    rejected,
    advanced,
  };
}
