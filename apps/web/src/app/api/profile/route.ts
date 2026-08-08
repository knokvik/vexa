import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  await store.ensureHydrated();
  return NextResponse.json({ profile: store.getProfile() });
}

export async function PUT(request: Request) {
  await store.ensureHydrated();
  const body = await request.json();
  const profile = store.updateProfile(body);
  return NextResponse.json({ profile });
}
