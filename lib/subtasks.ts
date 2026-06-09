import type { Subtask } from "@/types";

export const SUBTASKS_STORAGE_KEY = "gantt:subtasks";

/** Read subtasks from localStorage (SSR-safe; defaults to empty). */
export function loadSubtasks(): Subtask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SUBTASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Subtask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist subtasks. No-op during SSR. */
export function saveSubtasks(subtasks: Subtask[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUBTASKS_STORAGE_KEY, JSON.stringify(subtasks));
  } catch {
    /* storage full / disabled — ignore */
  }
}

/** Subtasks for a given task on a given day, in insertion order. */
export function subtasksFor(subs: Subtask[], taskId: string, dateISO: string): Subtask[] {
  return subs.filter((s) => s.taskId === taskId && s.date === dateISO);
}
