/**
 * Cross-boundary activity bus (server + client).
 * Client HUD subscribes; API routes emit when possible via returning activity
 * payloads — for client-driven flows, call reportActivity from the browser.
 */

export type ActivityEvent = {
  id: string;
  tool: string;
  model?: string;
  action: string;
  status: "running" | "done" | "error";
  at: number;
};

type Listener = (e: ActivityEvent | null) => void;

const g = globalThis as unknown as {
  __vexaActivityListeners?: Set<Listener>;
  __vexaActivityCurrent?: ActivityEvent | null;
};

function listeners() {
  if (!g.__vexaActivityListeners) g.__vexaActivityListeners = new Set();
  return g.__vexaActivityListeners;
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
