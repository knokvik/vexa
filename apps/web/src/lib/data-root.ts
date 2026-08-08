/**
 * Writable data root for CRM / durable / memory JSON.
 *
 * Local: apps/web/data
 * Vercel/serverless: /tmp/vexa-data (only writable path; ephemeral across
 * instances and cold starts — use a real DB later for permanence).
 */

import { promises as fs } from "fs";
import path from "path";
import os from "os";

export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV
  );
}

export function getDataRoot(): string {
  const override = (process.env.VEXA_DATA_DIR || "").trim();
  if (override) return path.resolve(override);
  if (isServerlessRuntime()) {
    return path.join(os.tmpdir(), "vexa-data");
  }
  return path.join(process.cwd(), "data");
}

export function dataPath(...parts: string[]): string {
  return path.join(getDataRoot(), ...parts);
}

export function isEphemeralStorage(): boolean {
  const root = getDataRoot();
  return (
    isServerlessRuntime() ||
    root.startsWith(os.tmpdir()) ||
    root.includes(`${path.sep}tmp${path.sep}`) ||
    root.endsWith(`${path.sep}tmp`)
  );
}

/** Probe whether we can create dirs + write under the data root */
export async function probeDataWritable(): Promise<{
  ok: boolean;
  root: string;
  ephemeral: boolean;
  error?: string;
}> {
  const root = getDataRoot();
  const ephemeral = isEphemeralStorage();
  try {
    await fs.mkdir(root, { recursive: true });
    const probe = path.join(root, `.write-probe-${process.pid}`);
    await fs.writeFile(probe, "ok", "utf8");
    await fs.unlink(probe).catch(() => null);
    return { ok: true, root, ephemeral };
  } catch (e) {
    return {
      ok: false,
      root,
      ephemeral,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
