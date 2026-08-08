import { NextResponse } from "next/server";
import { runChatAgent, type ChatTurnMessage } from "@/lib/crm/chat-agent";
import { liveSuggestions } from "@/lib/crm/command";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * POST /api/crm/chat
 * Multi-turn CRM chat — plans & runs 1..N tools with table context.
 *
 * Body: { text, history?: [{role, content}] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (typeof body.suggest === "string") {
      return NextResponse.json({
        ok: true,
        suggestions: liveSuggestions(body.suggest),
      });
    }

    const text = String(body.text || body.message || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }

    const history = (
      Array.isArray(body.history) ? body.history : []
    ) as ChatTurnMessage[];
    const cleanHistory = history
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
      .slice(-12)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: String(m.content).slice(0, 2000),
      }));

    const result = await runChatAgent(text, cleanHistory);

    return NextResponse.json({
      ok: result.ok,
      reply: result.reply,
      working: result.working,
      steps: result.steps,
      result: result.result,
      suggestions: result.suggestions,
      navigate: result.navigate,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "chat failed",
        reply: e instanceof Error ? e.message : "Something went wrong.",
      },
      { status: 500 }
    );
  }
}
