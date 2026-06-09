import type { Subtask } from "@/types";
import { loadJSON, saveJSON } from "./storage";

export const SUBTASKS_STORAGE_KEY = "gantt:subtasks";

/** Read subtasks from localStorage (SSR-safe; defaults to empty). */
export function loadSubtasks(): Subtask[] {
  const parsed = loadJSON<Subtask[] | null>(SUBTASKS_STORAGE_KEY, null);
  return Array.isArray(parsed) ? parsed : [];
}

/** Persist subtasks. No-op during SSR. */
export function saveSubtasks(subtasks: Subtask[]): void {
  saveJSON(SUBTASKS_STORAGE_KEY, subtasks);
}

/** Subtasks for a given task on a given day, in insertion order. */
export function subtasksFor(subs: Subtask[], taskId: string, dateISO: string): Subtask[] {
  return subs.filter((s) => s.taskId === taskId && s.date === dateISO);
}
