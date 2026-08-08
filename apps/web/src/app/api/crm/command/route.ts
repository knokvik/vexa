import { NextResponse } from "next/server";
import {
  parseCommand,
  parseCommandSmart,
  liveSuggestions,
} from "@/lib/crm/command";
import { executeIntent } from "@/lib/crm/execute-intent";

/** Job search + boards need headroom on Hobby/Pro */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Chatbot-style command bar: understand intent, run the tool, reply.
 * Prefer /api/crm/chat for multi-turn sessions.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (typeof body.suggest === "string") {
      return NextResponse.json({
        ok: true,
        suggestions: liveSuggestions(body.suggest),
        parse: parseCommand(body.suggest),
      });
    }

    const text = String(body.text || body.raw || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const parsed = await parseCommandSmart(text);
    const out = await executeIntent(parsed, text);

    return NextResponse.json({
      ok: out.ok,
      intent: out.intent,
      reply: out.reply,
      working: out.working,
      suggestions: parsed.suggestions,
      result: out.result,
      navigate: out.navigate,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "command failed",
        reply: e instanceof Error ? e.message : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
