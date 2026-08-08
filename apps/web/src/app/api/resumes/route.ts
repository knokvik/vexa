import { NextResponse } from "next/server";
import {
  ATS_FORMATTING_RULES,
  DEFAULT_TEMPLATES,
  type JobListing,
} from "@vexa/shared";
import {
  buildResume,
  listPrimaryTemplates,
  listTemplates,
} from "@vexa/intelligence";
import { store } from "@/lib/store";

/**
 * GET /api/resumes
 * Generated versions + Ivy/ATS template catalog + live preview of preferred template.
 */
export async function GET() {
  const profile = store.getProfile();
  const preferred =
    profile.templatePriorities?.[0] || DEFAULT_TEMPLATES[0]?.id || "tpl-harvard";
  const preview = buildResume(profile, null, {
    templateId: preferred,
    humanize: false,
  });

  const resumes = store.listResumes().map((r) => {
    const job = r.jobListingId ? store.getJob(r.jobListingId) : null;
    const draft = store
      .listDrafts()
      .find((d) => d.resumeVersionId === r.id);
    return {
      ...r,
      job: job
        ? {
            id: job.id,
            company: job.company,
            title: job.title,
            externalUrl: job.externalUrl,
          }
        : null,
      applicationId: draft?.id ?? null,
      applicationStatus: draft?.status ?? null,
      shortlistProbability: draft?.shortlistProbability ?? null,
    };
  });

  // Job packages that have resume text but may not appear in listResumes yet
  const draftPackages = store.listDrafts().map((d) => {
    const job = store.getJob(d.jobListingId);
    const resume = store.listResumes().find((r) => r.id === d.resumeVersionId);
    return {
      applicationId: d.id,
      status: d.status,
      shortlistProbability: d.shortlistProbability,
      matchScore: d.matchScore,
      createdAt: d.createdAt,
      job: job
        ? {
            id: job.id,
            company: job.company,
            title: job.title,
            externalUrl: job.externalUrl,
          }
        : null,
      resume: resume
        ? {
            id: resume.id,
            templateId: resume.templateId,
            plainText: resume.plainText,
            atsScore: resume.atsScore,
            humanizedScore: resume.humanizedScore,
            content: resume.content,
            createdAt: resume.createdAt,
          }
        : null,
    };
  });

  return NextResponse.json({
    resumes,
    draftPackages,
    templates: listPrimaryTemplates(),
    allTemplates: listTemplates(),
    preferredTemplateId: preferred,
    atsRules: ATS_FORMATTING_RULES,
    preview: {
      templateId: preview.templateId,
      templateName: preview.templateName,
      plainText: preview.plainText,
      atsScore: preview.atsScore,
      formatScore: preview.formatScore,
      humanizedScore: preview.humanizedScore,
      checklist: preview.atsChecklist,
      content: preview.content,
    },
  });
}

/**
 * POST /api/resumes
 * body:
 *  { action: "preview", templateId?, jobId? }
 *  { action: "setTemplate", templateId }
 *  { action: "buildBase", templateId? }  — save a base resume version
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "preview");
    const profile = store.getProfile();

    if (action === "setTemplate") {
      const templateId = String(body.templateId || "");
      if (!templateId) {
        return NextResponse.json(
          { error: "templateId required" },
          { status: 400 }
        );
      }
      const next = [
        templateId,
        ...profile.templatePriorities.filter((id) => id !== templateId),
      ];
      const updated = store.updateProfile({ templatePriorities: next });
      const preview = buildResume(updated, null, {
        templateId,
        humanize: false,
      });
      return NextResponse.json({
        ok: true,
        profile: updated,
        preferredTemplateId: templateId,
        preview: {
          templateId: preview.templateId,
          templateName: preview.templateName,
          plainText: preview.plainText,
          atsScore: preview.atsScore,
          formatScore: preview.formatScore,
          checklist: preview.atsChecklist,
          content: preview.content,
        },
      });
    }

    if (action === "preview" || action === "buildBase") {
      const templateId =
        body.templateId ||
        profile.templatePriorities?.[0] ||
        "tpl-harvard";
      let job: JobListing | null = null;
      if (body.jobId) {
        const found = store.getJob(String(body.jobId));
        if (!found) {
          return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }
        job = found;
      }

      const built = buildResume(profile, job, {
        templateId: String(templateId),
        humanize: Boolean(job),
      });

      if (action === "buildBase") {
        const now = new Date().toISOString();
        const version = store.addResume({
          id: `rv_base_${Date.now()}`,
          userId: profile.userId,
          jobListingId: job?.id ?? null,
          templateId: built.templateId,
          content: built.content,
          plainText: built.plainText,
          atsScore: built.atsScore,
          humanizedScore: built.humanizedScore,
          createdAt: now,
        });
        return NextResponse.json({
          ok: true,
          resume: version,
          checklist: built.atsChecklist,
          formatScore: built.formatScore,
          templateName: built.templateName,
        });
      }

      return NextResponse.json({
        ok: true,
        templateId: built.templateId,
        templateName: built.templateName,
        plainText: built.plainText,
        content: built.content,
        atsScore: built.atsScore,
        formatScore: built.formatScore,
        humanizedScore: built.humanizedScore,
        checklist: built.atsChecklist,
        missingKeywords: built.missingKeywords,
        suggestions: built.atsSuggestions,
        shortlistProbability: built.shortlistProbability,
        recommendation: built.recommendation,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "resume failed" },
      { status: 500 }
    );
  }
}
