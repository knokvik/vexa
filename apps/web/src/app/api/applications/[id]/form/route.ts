import { NextResponse } from "next/server";
import { store } from "@/lib/store";

/**
 * GET  /api/applications/:id/form — form answers + eval for this draft
 * POST /api/applications/:id/form — rebuild form answers from profile + job
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  await store.ensureHydrated();
  const d = store.getDraft(id);
  if (!d) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Ensure package rebuild fills missing form data
  const pkg = await store.getApplyPackage(id);
  return NextResponse.json({
    applicationId: id,
    surface: pkg?.formSurface || d.formSurface,
    answers: pkg?.formAnswers || d.formAnswers || [],
    eval: pkg?.formEval || d.formEval,
    filledFormData: pkg?.filledFormData || d.filledFormData || {},
    autoSubmit: false,
  });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const result = await store.rebuildFormAnswers(id);
  if ("error" in result) {
    return NextResponse.json(result, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    surface: result.form.surface,
    answers: result.form.answers,
    eval: result.form.eval,
    filledFormData: result.form.filledFormData,
    draft: {
      id: result.draft.id,
      status: result.draft.status,
      formSurface: result.draft.formSurface,
      formEval: result.draft.formEval,
    },
  });
}
