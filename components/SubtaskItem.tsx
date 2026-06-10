"use client";

import type { Subtask, WeeklyInteraction } from "@/types";

interface SubtaskItemProps {
  subtask: Subtask;
  editing: boolean;
  interaction: WeeklyInteraction;
}

/** A single checklist subtask: checkbox + label, click label to retype. */
export default function SubtaskItem({ subtask, editing, interaction }: SubtaskItemProps) {
  return (
    <div className="fs-10 flex items-start gap-1 px-1 py-0.5 leading-tight">
      <input
        type="checkbox"
        checked={subtask.done}
        onChange={() => interaction.onToggle(subtask.id)}
        className="mt-[1px] h-3 w-3 shrink-0 cursor-pointer coarse:h-4 coarse:w-4"
        aria-label={subtask.done ? "Mark not done" : "Mark done"}
      />
      {editing ? (
        <input
          autoFocus
          defaultValue={subtask.title}
          className="min-w-0 flex-1 bg-transparent outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              interaction.onCommitEdit(subtask.id, e.currentTarget.value);
              // Continue the chain: open a fresh subtask in the same cell.
              interaction.onStartNew(subtask.taskId, subtask.date);
            } else if (e.key === "Escape") {
              interaction.onCancelEdit();
            }
          }}
          onBlur={(e) => interaction.onCommitEdit(subtask.id, e.currentTarget.value)}
        />
      ) : (
        <button
          type="button"
          onClick={() => interaction.onStartEdit(subtask.id)}
          className={[
            "min-w-0 flex-1 cursor-text break-words text-left",
            subtask.done
              ? "text-neutral-400 line-through dark:text-neutral-500"
              : "text-neutral-800 dark:text-neutral-200",
          ].join(" ")}
        >
          {subtask.title}
        </button>
      )}
    </div>
  );
}
