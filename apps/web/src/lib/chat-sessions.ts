/**
 * Client-side multi-turn chat sessions (localStorage).
 * Home → new session; click a session → resume.
 */

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: number;
  working?: string[];
  intents?: string[];
  ok?: boolean;
  result?: Record<string, unknown>;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMsg[];
};

const KEY = "vexa_chat_sessions_v1";
const MAX_SESSIONS = 40;
const MAX_MSGS = 80;

function uid(prefix = "s") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as ChatSession[];
    return Array.isArray(list)
      ? list.sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch {
    return [];
  }
}

function saveSessions(list: ChatSession[]) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(list.slice(0, MAX_SESSIONS))
    );
  } catch {
    /* quota */
  }
}

export function getSession(id: string): ChatSession | null {
  return loadSessions().find((s) => s.id === id) || null;
}

export function createSession(seedTitle?: string): ChatSession {
  const now = Date.now();
  const session: ChatSession = {
    id: uid("chat"),
    title: (seedTitle || "New chat").slice(0, 80),
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  const list = [session, ...loadSessions().filter((s) => s.id !== session.id)];
  saveSessions(list);
  return session;
}

export function upsertSession(session: ChatSession): ChatSession {
  const next = { ...session, updatedAt: Date.now() };
  if (next.messages.length > MAX_MSGS) {
    next.messages = next.messages.slice(-MAX_MSGS);
  }
  // Title from first user message
  const firstUser = next.messages.find((m) => m.role === "user");
  if (firstUser && (next.title === "New chat" || !next.title)) {
    next.title = firstUser.content.slice(0, 72);
  }
  const list = [
    next,
    ...loadSessions().filter((s) => s.id !== next.id),
  ].slice(0, MAX_SESSIONS);
  saveSessions(list);
  return next;
}

export function appendMessage(
  sessionId: string,
  msg: Omit<ChatMsg, "id" | "at"> & { id?: string; at?: number }
): ChatSession | null {
  const s = getSession(sessionId);
  if (!s) return null;
  const entry: ChatMsg = {
    id: msg.id || uid("m"),
    at: msg.at || Date.now(),
    role: msg.role,
    content: msg.content,
    working: msg.working?.slice(0, 40),
    intents: msg.intents,
    ok: msg.ok,
    result: msg.result
      ? JSON.parse(
          JSON.stringify(msg.result, (_k, v) =>
            typeof v === "string" && v.length > 500
              ? v.slice(0, 500) + "…"
              : v
          )
        )
      : undefined,
  };
  s.messages = [...s.messages, entry];
  return upsertSession(s);
}

export function deleteSession(id: string) {
  saveSessions(loadSessions().filter((s) => s.id !== id));
}

export function titleFromPrompt(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 64 ? t.slice(0, 64) + "…" : t || "New chat";
}
