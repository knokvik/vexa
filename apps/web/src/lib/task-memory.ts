/**
 * Durable task memory (single-user).
 * Survives free-model switches: completed steps are not redone.
 * Files: apps/web/data/tasks/{taskId}.json
 * Optional human dump: memory/tasks/{taskId}.md (Obsidian-friendly)
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type TaskStep = {
  name: string;
  status: StepStatus;
  modelUsed?: string;
  inputHash?: string;
  output?: unknown;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  notes?: string;
};

export type TaskRecord = {
  id: string;
  type: string;
  status: "pending" | "running" | "done" | "failed";
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, unknown>;
  steps: TaskStep[];
  memoryNotes: string[];
};

const DATA_DIR = path.join(process.cwd(), "data", "tasks");
const MEMORY_DIR = path.join(process.cwd(), "..", "..", "memory", "tasks");

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  } catch {
    /* monorepo path may differ in some deploys */
  }
}

function taskPath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

export async function createTask(
  type: string,
  stepNames: string[],
  meta?: Record<string, unknown>
): Promise<TaskRecord> {
  await ensureDirs();
  const now = new Date().toISOString();
  const task: TaskRecord = {
    id: randomUUID(),
    type,
    status: "running",
    createdAt: now,
    updatedAt: now,
    meta,
    steps: stepNames.map((name) => ({ name, status: "pending" })),
    memoryNotes: [],
  };
  await saveTask(task);
  return task;
}

export async function loadTask(id: string): Promise<TaskRecord | null> {
  try {
    const raw = await fs.readFile(taskPath(id), "utf8");
    return JSON.parse(raw) as TaskRecord;
  } catch {
    return null;
  }
}

export async function saveTask(task: TaskRecord): Promise<void> {
  await ensureDirs();
  task.updatedAt = new Date().toISOString();
  await fs.writeFile(taskPath(task.id), JSON.stringify(task, null, 2), "utf8");
  // Obsidian-friendly dump (best effort)
  try {
    const md = [
      `# Task ${task.id}`,
      ``,
      `- type: ${task.type}`,
      `- status: ${task.status}`,
      `- updated: ${task.updatedAt}`,
      ``,
      `## Steps`,
      ...task.steps.map(
        (s) =>
          `- [${s.status}] **${s.name}** ${s.modelUsed ? `(${s.modelUsed})` : ""}${s.error ? ` — ${s.error}` : ""}`
      ),
      ``,
      `## Memory notes`,
      ...task.memoryNotes.map((n) => `- ${n}`),
      ``,
    ].join("\n");
    await fs.writeFile(path.join(MEMORY_DIR, `${task.id}.md`), md, "utf8");
  } catch {
    /* ignore */
  }
}

export async function runStep<T>(
  task: TaskRecord,
  stepName: string,
  fn: () => Promise<{ output: T; modelUsed?: string; notes?: string }>
): Promise<T> {
  const step = task.steps.find((s) => s.name === stepName);
  if (!step) throw new Error(`Unknown step ${stepName}`);

  // Idempotent: if already done, reuse output
  if (step.status === "done" && step.output !== undefined) {
    return step.output as T;
  }

  step.status = "running";
  step.startedAt = new Date().toISOString();
  step.error = undefined;
  await saveTask(task);

  try {
    const result = await fn();
    step.status = "done";
    step.output = result.output;
    step.modelUsed = result.modelUsed;
    step.finishedAt = new Date().toISOString();
    if (result.notes) {
      step.notes = result.notes;
      task.memoryNotes.push(`${stepName}: ${result.notes}`);
    }
    await saveTask(task);
    return result.output;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    step.status = "failed";
    step.error = msg;
    step.finishedAt = new Date().toISOString();
    task.memoryNotes.push(`${stepName} FAILED: ${msg}`);
    await saveTask(task);
    throw e;
  }
}

export async function completeTask(
  task: TaskRecord,
  status: "done" | "failed" = "done"
): Promise<void> {
  task.status = status;
  await saveTask(task);
}

export async function listRecentTasks(limit = 20): Promise<TaskRecord[]> {
  await ensureDirs();
  try {
    const files = await fs.readdir(DATA_DIR);
    const ids = files.filter((f) => f.endsWith(".json")).slice(0, 100);
    const tasks: TaskRecord[] = [];
    for (const f of ids) {
      const t = await loadTask(f.replace(/\.json$/, ""));
      if (t) tasks.push(t);
    }
    return tasks
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit);
  } catch {
    return [];
  }
}
