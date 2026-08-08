/**
 * Client-side stacked command history (iPhone-style card stack).
 */

export type HistoryEntry = {
  id: string;
  at: number;
  prompt: string;
  summary: string;
  intent?: string;
  ok: boolean;
  /** Full working log from the run */
  working?: string[];
  /** Structured result snapshot */
  result?: Record<string, unknown>;
};

const KEY = "vexa_command_history_v1";
const MAX = 30;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function pushHistory(
  entry: Omit<HistoryEntry, "id" | "at"> & { id?: string }
): HistoryEntry[] {
  const next: HistoryEntry = {
    id: entry.id || `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    prompt: entry.prompt,
    summary: entry.summary,
    intent: entry.intent,
    ok: entry.ok,
    working: entry.working?.slice(0, 40),
    result: entry.result
      ? JSON.parse(JSON.stringify(entry.result, (_k, v) =>
          typeof v === "string" && v.length > 400 ? v.slice(0, 400) + "…" : v
        ))
      : undefined,
  };
  const prev = loadHistory().filter(
    (h) => !(h.prompt === entry.prompt && h.at > Date.now() - 2000)
  );
  const list = [next, ...prev].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota */
  }
  return list;
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
