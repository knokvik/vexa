import { NextResponse } from "next/server";
import { getAiActivity, recordAiActivity, type AiProvider } from "@/lib/ai-activity";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** GET /api/ai/activity — polled by the frontend AI indicator */
export async function GET() {
  const activity = getAiActivity();
  return NextResponse.json({ activity }, { headers: CORS_HEADERS });
}

/** POST /api/ai/activity — report activity or simulate test ping */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const provider: AiProvider = body.provider || "chatgpt";
    const action = body.action || "add_task";
    const detail = body.detail || body.title || "";
    recordAiActivity(provider, action, detail);
    return NextResponse.json(
      { ok: true, activity: getAiActivity() },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to record" },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
