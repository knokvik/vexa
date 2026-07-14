"use client";

/**
 * Engine activity toast — disabled.
 * Re-export reportActivity so callers still compile.
 */
export function ActivityHud() {
  return null;
}

export { reportActivity } from "@/lib/activity-bus";
