/**
 * Cross-boundary activity bus + continuous log ring buffer for dashboard.
 */

export type ActivityEvent = {
  id: string;
  tool: string;
  model?: string;
  action: string;
  status: "running" | "done" | "error";
  at: number;
};

export type LogLine = {
  id: string;
  at: number;
  kind: string;
  message: string;
  detail?: string;
  status?: "running" | "done" | "error" | "info";
};

type Listener = (e: ActivityEvent | null) => void;
type LogListener = (logs: LogLine[]) => void;

const MAX_LOGS = 80;

const g = globalThis as unknown as {
  __vexaActivityListeners?: Set<Listener>;
  __vexaActivityCurrent?: ActivityEvent | null;
  __vexaLogLines?: LogLine[];
  __vexaLogListeners?: Set<LogListener>;
};

function listeners() {
  if (!g.__vexaActivityListeners) g.__vexaActivityListeners = new Set();
  return g.__vexaActivityListeners;
}

function logStore(): LogLine[] {
  if (!g.__vexaLogLines) g.__vexaLogLines = [];
  return g.__vexaLogLines;
}

function logListeners() {
  if (!g.__vexaLogListeners) g.__vexaLogListeners = new Set();
  return g.__vexaLogListeners;
}

function pushLog(line: LogLine) {
  const arr = logStore();
  arr.unshift(line);
  if (arr.length > MAX_LOGS) arr.length = MAX_LOGS;
  logListeners().forEach((fn) => fn([...arr]));
}

/** Append a free-form log line (dashboard live feed). */
export function appendLog(partial: {
  kind: string;
  message: string;
  detail?: string;
  status?: LogLine["status"];
  id?: string;
}) {
  pushLog({
    id: partial.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    kind: partial.kind,
    message: partial.message,
    detail: partial.detail,
    status: partial.status || "info",
  });
}

export function getLogs(): LogLine[] {
  return [...logStore()];
}

export function subscribeLogs(fn: LogListener): () => void {
  logListeners().add(fn);
  fn(getLogs());
  return () => {
    logListeners().delete(fn);
  };
}

export function reportActivity(
  partial: Omit<ActivityEvent, "id" | "at"> & { id?: string }
) {
  const event: ActivityEvent = {
    id: partial.id || `${Date.now()}`,
    tool: partial.tool,
    model: partial.model,
    action: partial.action,
    status: partial.status,
    at: Date.now(),
  };
  g.__vexaActivityCurrent = event;
  listeners().forEach((fn) => fn(event));

  // Also feed continuous log widget (no toast)
  pushLog({
    id: event.id,
    at: event.at,
    kind: event.tool,
    message: event.action,
    detail: event.model,
    status: event.status,
  });

  if (event.status !== "running") {
    setTimeout(() => {
      if (g.__vexaActivityCurrent?.id === event.id) {
        g.__vexaActivityCurrent = null;
        listeners().forEach((fn) => fn(null));
      }
    }, 4500);
  }
  return event.id;
}

export function subscribeActivity(fn: Listener): () => void {
  listeners().add(fn);
  return () => {
    listeners().delete(fn);
  };
}
