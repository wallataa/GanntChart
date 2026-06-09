"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Event, GridInteraction, Subtask, SwimLane } from "@/types";
import { confirmDeleteLane, isLifeLane } from "@/lib/lanes";
import { fillFor } from "@/lib/colors";
import SubtaskChecklist from "./SubtaskChecklist";

interface SidebarProps {
  lane: SwimLane;
  interaction: GridInteraction;
  /** Begin a lane reorder drag (from the grip handle). */
  onLanePointerDown: (laneId: string, e: ReactPointerEvent) => void;
  /** This lane's tasks (events) — for the accumulated to-do list. */
  tasks: Event[];
  subtasks: Subtask[];
  onToggleSubtask: (subtaskId: string) => void;
  /** Fixed row height in px (matches the track); content taller scrolls. */
  maxHeight?: number;
}

/**
 * The two sticky left columns for a single lane row. Both are editable in place
 * (spreadsheet-style):
 *  - Column A: bullet notes — click to edit as a multi-line list (one per line)
 *  - Column B: the lane label — click to rename
 */
export default function Sidebar({
  lane,
  interaction,
  onLanePointerDown,
  tasks,
  subtasks,
  onToggleSubtask,
  maxHeight,
}: SidebarProps) {
  const life = isLifeLane(lane);

  // Which task to-do groups are collapsed (disclosure toggle).
  const [collapsedTodos, setCollapsedTodos] = useState<Set<string>>(new Set());
  const toggleTodo = (taskId: string) =>
    setCollapsedTodos((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  // Local draft state so typing doesn't thrash localStorage on every keystroke;
  // we commit on blur.
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(lane.label);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(lane.notes.join("\n"));
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Keep drafts in sync when the lane changes underneath us (e.g. reorder).
  useEffect(() => {
    if (!editingLabel) setLabelDraft(lane.label);
  }, [lane.label, editingLabel]);
  useEffect(() => {
    if (!editingNotes) setNotesDraft(lane.notes.join("\n"));
  }, [lane.notes, editingNotes]);

  const commitLabel = () => {
    setEditingLabel(false);
    const next = labelDraft.trim();
    if (next && next !== lane.label) interaction.onRenameLane(lane.id, next);
    else setLabelDraft(lane.label);
  };

  const commitNotes = () => {
    setEditingNotes(false);
    const notes = notesDraft
      .split("\n")
      .map((n) => n.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
    interaction.onSetLaneNotes(lane.id, notes);
  };

  // Accumulated to-do list: this lane's tasks that have subtasks, grouped.
  const taskGroups = tasks
    .map((task) => ({ task, subs: subtasks.filter((s) => s.taskId === task.id) }))
    .filter((g) => g.subs.length > 0);

  return (
    <div
      className="sticky left-0 z-10 flex shrink-0 border-b border-neutral-200 bg-white"
      style={{
        width: "var(--sb-w, 316px)",
        // Lane-color tint composited over the opaque white base so the sticky
        // sidebar still masks horizontally-scrolled content (no bleed-through).
        backgroundImage: `linear-gradient(${fillFor(lane.color)}22, ${fillFor(lane.color)}22)`,
        ...(maxHeight ? { maxHeight, overflowY: "auto", overflowX: "hidden" } : null),
      }}
    >
      {/* Drag handle — grab to reorder the whole lane (Life lane is locked) */}
      {life ? (
        <div
          className="absolute left-0 top-0 z-10 flex h-full w-4 items-center justify-center text-[10px] text-neutral-300"
          title="Life lane is locked"
        >
          🔒
        </div>
      ) : (
        <div
          onPointerDown={(e) => onLanePointerDown(lane.id, e)}
          title="Drag to move lane"
          className="absolute left-0 top-0 z-10 flex h-full w-4 cursor-grab select-none items-center justify-center text-neutral-300 hover:bg-neutral-100 hover:text-neutral-500 active:cursor-grabbing"
        >
          ⠿
        </div>
      )}

      {/* Column A — notes */}
      <div
        className="fs-11 shrink-0 py-1.5 pl-5 pr-2 leading-snug text-neutral-700"
        style={{ width: "var(--sb-notes, 196px)" }}
      >
        {editingNotes ? (
          <textarea
            ref={notesRef}
            autoFocus
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={commitNotes}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setNotesDraft(lane.notes.join("\n"));
                setEditingNotes(false);
              }
            }}
            placeholder="One note per line"
            rows={Math.max(2, notesDraft.split("\n").length)}
            className="fs-11 w-full resize-none rounded border border-blue-300 p-1 outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingNotes(true)}
            className="block w-full cursor-text rounded text-left hover:bg-neutral-50"
            aria-label={`Edit notes for ${lane.label}`}
          >
            {lane.notes.length > 0 ? (
              <ul className="space-y-0.5">
                {lane.notes.map((n, i) => (
                  <li key={i}>- {n}</li>
                ))}
              </ul>
            ) : (
              <span className="text-neutral-300">+ notes</span>
            )}
          </button>
        )}

        {/* Accumulated to-do list (subtasks from the weekly view), grouped by task */}
        {taskGroups.length > 0 && (
          <div className="mt-2 space-y-1 border-t border-neutral-100 pt-1.5">
            {taskGroups.map(({ task, subs }) => {
              const open = !collapsedTodos.has(task.id);
              return (
              <div key={task.id}>
                <button
                  type="button"
                  onClick={() => toggleTodo(task.id)}
                  className="fs-10 flex w-full items-center gap-1 text-left font-semibold text-neutral-500 hover:text-neutral-700"
                  aria-expanded={open}
                >
                  <span className="w-2 shrink-0 text-[8px] leading-none text-neutral-400">
                    {open ? "▼" : "▶"}
                  </span>
                  <span className="truncate">{task.title}</span>
                  <span className="shrink-0 text-neutral-400">
                    {subs.filter((s) => s.done).length}/{subs.length}
                  </span>
                </button>
                {open && (
                  <SubtaskChecklist subtasks={subs} onToggle={onToggleSubtask} className="pl-3" />
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Column B — lane label. Click selects the lane (so the Fill swatches
          recolor it); double-click renames. */}
      <div
        className={[
          "group/label relative flex shrink-0 items-center justify-center border-l px-1 text-center",
          interaction.selectedLaneId === lane.id
            ? "border-blue-500 ring-2 ring-inset ring-blue-400"
            : "border-neutral-200",
        ].join(" ")}
        style={{
          width: "var(--sb-label, 120px)",
          backgroundImage: `linear-gradient(${fillFor(lane.color)}55, ${fillFor(lane.color)}55)`,
        }}
      >
        {/* Delete this lane (and its events). Hidden on the locked Life lane;
            revealed on hover. Confirms when the lane still has events. */}
        {!life && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirmDeleteLane(lane.label, tasks.length)) {
                interaction.onDeleteLane(lane.id);
              }
            }}
            title={`Delete ${lane.label}`}
            aria-label={`Delete ${lane.label}`}
            className="absolute right-0.5 top-0.5 z-10 rounded px-1 text-[11px] leading-none text-neutral-400 opacity-0 hover:bg-white/60 hover:text-red-600 focus:opacity-100 group-hover/label:opacity-100"
          >
            ✕
          </button>
        )}
        {editingLabel ? (
          <input
            autoFocus
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLabel();
              else if (e.key === "Escape") {
                setLabelDraft(lane.label);
                setEditingLabel(false);
              }
            }}
            className="fs-14 w-full rounded border border-blue-300 px-1 py-0.5 text-center outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => interaction.onSelectLane(lane.id)}
            onDoubleClick={() => setEditingLabel(true)}
            title="Click to select (recolor); double-click to rename"
            className={[
              "fs-14 flex w-full items-center justify-center gap-1 rounded py-1 font-medium hover:bg-black/5",
              life ? "text-teal-800" : "text-neutral-800",
            ].join(" ")}
          >
            {life && <span aria-hidden>🗓️</span>}
            {lane.label}
          </button>
        )}
      </div>
    </div>
  );
}
