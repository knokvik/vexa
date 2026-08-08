import { NextResponse } from "next/server";
import { store } from "@/lib/store";

/** GET /api/stats/weekly — outcome × score-band learning view */
export async function GET() {
  await store.ensureHydrated();
  const stats = await store.weeklyStats();
  return NextResponse.json({ ok: true, stats });
}
