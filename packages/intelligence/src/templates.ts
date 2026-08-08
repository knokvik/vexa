/**
 * Ivy League–style ATS resume templates.
 * Single column, standard fonts, action-verb bullets — no tables/graphics.
 */

import {
  DEFAULT_TEMPLATES,
  ATS_FORMATTING_RULES,
  type ResumeTemplate,
  type ResumeSectionType,
} from "@vexa/shared";

export type TemplateId =
  | "tpl-harvard"
  | "tpl-princeton"
  | "tpl-yale"
  | "tpl-mit"
  | "tpl-penn"
  | "tpl-modern"
  | "tpl-classic"
  | "tpl-technical";

/** Alias legacy IDs → canonical Ivy layouts */
const ALIAS: Record<string, TemplateId> = {
  "tpl-modern": "tpl-harvard",
  "tpl-classic": "tpl-penn",
  "tpl-technical": "tpl-mit",
};

export const TEMPLATE_CATALOG: ResumeTemplate[] = DEFAULT_TEMPLATES.map(
  (t) => ({ ...t, sectionOrder: [...(t.sectionOrder || [])] as ResumeSectionType[] })
);

export function resolveTemplateId(id?: string | null): TemplateId {
  if (!id) return "tpl-harvard";
  const aliased = ALIAS[id] || id;
  const known = TEMPLATE_CATALOG.some((t) => t.id === aliased || t.id === id);
  if (known) {
    return (ALIAS[id] || id) as TemplateId;
  }
  return "tpl-harvard";
}

export function getTemplate(id?: string | null): ResumeTemplate {
  const resolved = resolveTemplateId(id);
  // Prefer exact catalog entry for display; fall back to resolved canonical
  const exact = TEMPLATE_CATALOG.find((t) => t.id === id);
  if (exact) return exact;
  return (
    TEMPLATE_CATALOG.find((t) => t.id === resolved) || TEMPLATE_CATALOG[0]
  );
}

export function listTemplates(): ResumeTemplate[] {
  // Primary Ivy set first (hide pure aliases from picker UI callers can filter)
  return TEMPLATE_CATALOG;
}

export function listPrimaryTemplates(): ResumeTemplate[] {
  return TEMPLATE_CATALOG.filter((t) =>
    ["tpl-harvard", "tpl-princeton", "tpl-yale", "tpl-mit", "tpl-penn"].includes(
      t.id
    )
  );
}

export function pickTemplateId(priorities: string[] | undefined): TemplateId {
  if (priorities?.length) {
    for (const p of priorities) {
      if (TEMPLATE_CATALOG.some((t) => t.id === p || ALIAS[p])) {
        return resolveTemplateId(p);
      }
    }
  }
  return "tpl-harvard";
}

/** Section titles — title case (sample resume style), never dashed underlines */
export function sectionTitle(
  type: ResumeSectionType,
  templateId: TemplateId
): string {
  const t = resolveTemplateId(templateId);
  if (type === "experience") {
    if (t === "tpl-princeton") return "Experience";
    if (t === "tpl-penn") return "Experience";
    return "Experience";
  }
  if (type === "leadership") {
    if (t === "tpl-harvard") return "Leadership";
    if (t === "tpl-yale") return "Leadership";
    if (t === "tpl-princeton") return "Activities";
    return "Leadership";
  }
  if (type === "education") return "Education";
  if (type === "skills") {
    if (t === "tpl-penn") return "Skills";
    return "Skills";
  }
  if (type === "projects") {
    if (t === "tpl-princeton") return "Projects";
    return "Projects";
  }
  if (type === "additional") {
    if (t === "tpl-yale") return "Personal Details";
    if (t === "tpl-princeton") return "Personal Details";
    return "Personal Details";
  }
  if (type === "summary") return "Summary";
  if (type === "objective") return "Objective";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Whether this template includes an objective/summary block */
export function usesObjective(templateId: TemplateId): boolean {
  // Stanford-style optional objective only on MIT when no education depth
  return resolveTemplateId(templateId) === "tpl-mit";
}

export function usesSummary(templateId: TemplateId): boolean {
  // Harvard/Yale/Princeton/Penn career centers generally skip professional summaries
  // for student/early career; we only inject a short objective for MIT STEM.
  void templateId;
  return false;
}

export { ATS_FORMATTING_RULES };
