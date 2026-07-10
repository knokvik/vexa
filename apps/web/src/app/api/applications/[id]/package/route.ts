import { NextResponse } from "next/server";
import { store } from "@/lib/store";

/**
 * Apply package for Chrome extension.
 * autoSubmit is always false — extension only prefills.
 * Runs platform sync first if data is stale.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const pkg = await store.getApplyPackage(id);
  if (!pkg) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (pkg.autoSubmit !== false) {
    return NextResponse.json(
      { error: "Illegal package: autoSubmit must be false" },
      { status: 500 }
    );
  }
  return NextResponse.json({ package: pkg });
}
