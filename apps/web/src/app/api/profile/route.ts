import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ profile: store.getProfile() });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const profile = store.updateProfile(body);
  return NextResponse.json({ profile });
}
