"use client";

import type { Subtask } from "@/types";

interface SubtaskChecklistProps {
  subtasks: Subtask[];
  onToggle: (subtaskId: string) => void;
  className?: string;
}

/**
 * A read-only checkbox list of subtasks (live toggles, struck-through when
 * done). Shared by the main-view sidebar and the weekly task rows.
 */
export default function SubtaskChecklist({ subtasks, onToggle, className }: SubtaskChecklistProps) {
  return (
    <ul className={["space-y-0.5", className ?? ""].join(" ")}>
      {subtasks.map((s) => (
        <li key={s.id} className="flex items-start gap-1">
          <input
            type="checkbox"
            checked={s.done}
            onChange={() => onToggle(s.id)}
            className="mt-[2px] h-2.5 w-2.5 shrink-0 cursor-pointer"
            aria-label={s.done ? "Mark not done" : "Mark done"}
          />
          <span
            className={[
              "fs-10 min-w-0 break-words",
              s.done
                ? "text-neutral-400 line-through dark:text-neutral-500"
                : "text-neutral-700 dark:text-neutral-300",
            ].join(" ")}
          >
            {s.title}
          </span>
        </li>
      ))}
    </ul>
  );
}
