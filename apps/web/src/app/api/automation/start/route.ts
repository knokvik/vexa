import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST() {
  const { results } = store.startAutomation();
  const prepared = results.filter((r) => !("error" in r)).length;
  const errors = results
    .filter((r): r is { error: string } => "error" in r)
    .map((r) => r.error);

  return NextResponse.json({
    enabled: true,
    prepared,
    errors,
    message:
      "Drafts prepared with humanized resumes. Open Draft Inbox for one-tap apply. Server never auto-submits.",
  });
}
