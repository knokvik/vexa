/**
 * Build an Obsidian-style knowledge graph from task memory records.
 */

export type GraphNode = {
  id: string;
  label: string;
  group: string;
  size: number;
};

export type GraphLink = {
  source: string;
  target: string;
};

export type GraphPayload = {
  nodes: GraphNode[];
  links: GraphLink[];
  groups: Array<{ id: string; label: string; color: string }>;
};

type TaskLike = {
  id: string;
  type: string;
  status: string;
  steps: Array<{ name: string; status: string; modelUsed?: string }>;
  memoryNotes: string[];
  meta?: Record<string, unknown>;
};

export const GROUP_COLORS: Record<string, string> = {
  type: "#a78bfa", // purple — task types
  task: "#34d399", // green — task instances
  step: "#60a5fa", // blue — pipeline steps
  status: "#fbbf24", // yellow — status tags
  model: "#f472b6", // pink — LLM models
  note: "#94a3b8", // slate — memory notes
  meta: "#fb923c", // orange — meta tags
};

export function buildMemoryGraph(tasks: TaskLike[]): GraphPayload {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const linkSet = new Set<string>();

  const addNode = (
    id: string,
    label: string,
    group: string,
    size = 8
  ) => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, label, group, size });
    } else {
      const n = nodes.get(id)!;
      n.size = Math.min(22, n.size + 0.6);
    }
  };

  const addLink = (a: string, b: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (linkSet.has(key)) return;
    linkSet.add(key);
    links.push({ source: a, target: b });
  };

  for (const t of tasks) {
    const typeId = `type:${t.type}`;
    const taskId = `task:${t.id}`;
    const statusId = `status:${t.status}`;

    addNode(typeId, t.type, "type", 14);
    addNode(taskId, t.id.slice(0, 8), "task", 10);
    addNode(statusId, t.status, "status", 9);

    addLink(taskId, typeId);
    addLink(taskId, statusId);

    for (const s of t.steps || []) {
      const stepId = `step:${s.name}`;
      addNode(stepId, s.name, "step", 9);
      addLink(taskId, stepId);
      addLink(stepId, typeId);

      if (s.modelUsed) {
        const mid = `model:${s.modelUsed}`;
        addNode(mid, s.modelUsed.split("/").pop() || s.modelUsed, "model", 8);
        addLink(taskId, mid);
        addLink(stepId, mid);
      }
    }

    // Meta keywords (company, query, etc.)
    if (t.meta) {
      for (const [k, v] of Object.entries(t.meta)) {
        if (v == null) continue;
        const label = String(v).slice(0, 28);
        if (!label || label.length < 2) continue;
        const mid = `meta:${k}:${label.toLowerCase()}`;
        addNode(mid, label, "meta", 7);
        addLink(taskId, mid);
      }
    }

    // Short note tokens
    for (const note of (t.memoryNotes || []).slice(0, 3)) {
      const token = note.split(/[:\s]/)[0]?.slice(0, 20);
      if (!token || token.length < 3) continue;
      const nid = `note:${token.toLowerCase()}`;
      addNode(nid, token, "note", 6);
      addLink(taskId, nid);
    }
  }

  const groups = [
    { id: "type", label: "TASK TYPES", color: GROUP_COLORS.type },
    { id: "task", label: "TASKS", color: GROUP_COLORS.task },
    { id: "step", label: "STEPS", color: GROUP_COLORS.step },
    { id: "status", label: "STATUS", color: GROUP_COLORS.status },
    { id: "model", label: "MODELS", color: GROUP_COLORS.model },
    { id: "meta", label: "META", color: GROUP_COLORS.meta },
    { id: "note", label: "NOTES", color: GROUP_COLORS.note },
  ];

  return {
    nodes: [...nodes.values()],
    links,
    groups,
  };
}
