"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DateRange, Event, Subtask, SwimLane, WeeklyInteraction } from "@/types";
import { daysInRange, isWithinRange, placeEvent, toISODate } from "@/lib/dates";
import { fillFor } from "@/lib/colors";
import { subtasksFor } from "@/lib/subtasks";
import { useRowHeightDrag } from "@/lib/useRowHeightDrag";
import SubtaskItem from "./SubtaskItem";
import SubtaskChecklist from "./SubtaskChecklist";
import DayColumns from "./DayColumns";
import { CalendarIcon, GripIcon } from "./icons";

interface TaskSubLaneProps {
  task: Event;
  lane: SwimLane;
  range: DateRange;
  subtasks: Subtask[];
  interaction: WeeklyInteraction;
  columnWidth: number;
  /** Register this row's element for reorder/move hit-testing. */
  registerTask: (taskId: string, el: HTMLElement | null) => void;
  /** Begin a reorder/move drag from the row grip. */
  onTaskPointerDown: (task: Event, e: ReactPointerEvent) => void;
  /** Begin a drag from the task bar (reschedule / reorder / select). */
  onBarPointerDown: (task: Event, e: ReactPointerEvent) => void;
  /** Live horizontal offset (px) while this task's bar is being dragged. */
  barOffset: number;
  onToggleSubtask: (subtaskId: string) => void;
  dragging: boolean;
}

/** Combined left-column width (notes + label), driven by the `--sb-w` CSS var. */
const SIDEBAR_WIDTH = "var(--sb-w, 316px)";

/**
 * One task row. The task's date span is drawn as a colored bar (with the title
 * inside) on its own line; below it sit the per-day subtask cells. The left
 * column accumulates the task's whole subtask checklist.
 *
 * Manual tasks: click the bar to select (recolor), drag it sideways to
 * reschedule, double-click it to add a subtask, and use the ⠿ grip to reorder /
 * move it to another lane. GCal (Life) tasks are read-only — just a bar, no
 * subtasks — so they read the same as the main view.
 */
export default function TaskSubLane({
  task,
  lane,
  range,
  subtasks,
  interaction,
  columnWidth,
  registerTask,
  onTaskPointerDown,
  onBarPointerDown,
  barOffset,
  onToggleSubtask,
  dragging,
}: TaskSubLaneProps) {
  const days = daysInRange(range);
  const columns = `repeat(${days.length}, ${columnWidth}px)`;

  const manual = task.source === "manual";
  const allSubs = subtasks.filter((s) => s.taskId === task.id);
  const inWindow = allSubs.filter((s) => isWithinRange(s.date, range));
  const doneCount = inWindow.filter((s) => s.done).length;

  const accent = fillFor(task.color ?? lane.color);
  const placement = placeEvent(task.start, task.end, range);
  const selected = interaction.selectedTaskId === task.id;

  const adding =
    interaction.editing?.kind === "new" && interaction.editing.taskId === task.id;
  // The day grid (and the always-present add affordance) only exists for manual
  // tasks that have subtasks in view or are being added to — so empty tasks
  // (including every Life/GCal event) stay a single bar row.
  const showGrid = manual && (inWindow.length > 0 || adding);

  const trackRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  // Disclosure toggle for the accumulated to-do list.
  const [todosOpen, setTodosOpen] = useState(true);

  // Row-height drag (drag the task row's bottom edge). The committed value
  // lives on `task.rowHeight`. When set, the left and right columns cap at
  // this height and scroll.
  const { effHeight, onResizeRow } = useRowHeightDrag(
    task.rowHeight,
    () => rowRef.current?.offsetHeight ?? 40,
    (h) => interaction.onSetTaskHeight(task.id, h),
    28,
  );

  // Map a clientX to an ISO day within the task's visible span (for double-click
  // → add a subtask on the clicked day).
  const dayFromClientX = (clientX: number): string => {
    const el = trackRef.current;
    if (!el || !placement) return task.start;
    const rel = Math.floor((clientX - el.getBoundingClientRect().left) / columnWidth);
    const idx = Math.max(
      placement.colStart,
      Math.min(placement.colStart + placement.span - 1, rel),
    );
    return toISODate(days[idx]);
  };

  return (
    <div
      ref={(el) => {
        rowRef.current = el;
        registerTask(task.id, el);
      }}
      className={[
        "relative flex border-b border-neutral-100 dark:border-neutral-900",
        dragging ? "z-20 bg-white opacity-90 shadow dark:bg-neutral-950" : "",
      ].join(" ")}
    >
      {/* Left: grip + title (fallback) + the accumulated subtask checklist */}
      <div
        className="row-cap sticky left-0 z-10 flex shrink-0 flex-col gap-0.5 bg-white py-1 pl-1 pr-2 dark:bg-neutral-950"
        style={{ width: SIDEBAR_WIDTH, maxHeight: effHeight }}
      >
        <div className="flex items-start gap-1">
          {manual ? (
            <span
              onPointerDown={(e) => onTaskPointerDown(task, e)}
              title="Drag to reorder / move to another lane"
              className="mt-[2px] flex w-3 shrink-0 cursor-grab touch-none select-none justify-center text-neutral-300 hover:text-neutral-500 active:cursor-grabbing dark:text-neutral-600 dark:hover:text-neutral-400"
            >
              <GripIcon className="h-3 w-3" />
            </span>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <span
            className="mt-[3px] inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10"
            style={{ backgroundColor: accent }}
          />
          {/* Title heading — a disclosure toggle for the to-do list when it has any. */}
          {manual && allSubs.length > 0 ? (
            <button
              type="button"
              onClick={() => setTodosOpen((o) => !o)}
              className="fs-12 flex min-w-0 flex-1 items-center gap-1 text-left font-medium leading-snug text-neutral-800 dark:text-neutral-200"
              aria-expanded={todosOpen}
            >
              <span className="w-2 shrink-0 text-[8px] leading-none text-neutral-400">
                {todosOpen ? "▼" : "▶"}
              </span>
              <span className={["truncate", task.done ? "line-through opacity-60" : ""].join(" ")}>
                {task.title}
              </span>
            </button>
          ) : (
            <span
              className={[
                "fs-12 min-w-0 flex-1 font-medium leading-snug text-neutral-800 dark:text-neutral-200",
                task.done ? "line-through opacity-60" : "",
              ].join(" ")}
            >
              {task.title}
            </span>
          )}
          {manual && inWindow.length > 0 && (
            <span className="fs-10 shrink-0 text-neutral-400">
              {doneCount}/{inWindow.length}
            </span>
          )}
        </div>

        {/* Accumulated to-do list for this task (live checkboxes). */}
        {manual && allSubs.length > 0 && todosOpen && (
          <SubtaskChecklist subtasks={allSubs} onToggle={onToggleSubtask} className="pl-4" />
        )}
      </div>

      {/* Right: title bar on its own line, then per-day subtasks below it */}
      <div ref={trackRef} className="relative flex-1">
        <DayColumns range={range} columnWidth={columnWidth} />

        {/* Foreground (scrolls within the row height; backgrounds stay full) */}
        <div className="row-cap relative" style={{ maxHeight: effHeight }}>
        {/* Title bar row */}
        {placement && (
          <div className="relative grid py-[2px]" style={{ gridTemplateColumns: columns }}>
            <div
              onPointerDown={manual ? (e) => onBarPointerDown(task, e) : undefined}
              onDoubleClick={
                manual ? (e) => interaction.onStartNew(task.id, dayFromClientX(e.clientX)) : undefined
              }
              title={
                manual
                  ? "Click to select · drag to move/reschedule · double-click to add a subtask"
                  : undefined
              }
              className={[
                "flex items-center overflow-hidden rounded-[3px] border px-1.5 py-px text-left select-none",
                manual ? "cursor-grab touch-none active:cursor-grabbing" : "",
                selected ? "border-blue-500 ring-2 ring-blue-400" : "border-black/10",
                task.done ? "opacity-50 saturate-50" : "",
              ].join(" ")}
              style={{
                gridColumn: `${placement.colStart + 1} / span ${placement.span}`,
                backgroundColor: `${accent}99`,
                transform: barOffset ? `translateX(${barOffset}px)` : undefined,
              }}
            >
              <span
                className={[
                  "fs-11 truncate font-medium text-neutral-900 dark:text-neutral-50",
                  task.done ? "line-through" : "",
                ].join(" ")}
              >
                {task.title}
              </span>
              {task.pushed && (
                <span
                  className="ml-auto shrink-0 pl-1 text-neutral-700/70 dark:text-neutral-300/70"
                  title="Synced to Google Calendar"
                >
                  <CalendarIcon className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
          </div>
        )}

        {/* Subtask rows (manual tasks with subtasks in view / being added) */}
        {showGrid && (
          <div className="relative grid" style={{ gridTemplateColumns: columns }}>
            {days.map((d) => {
              const iso = toISODate(d);
              const subs = subtasksFor(subtasks, task.id, iso);
              const addingHere =
                interaction.editing?.kind === "new" &&
                interaction.editing.taskId === task.id &&
                interaction.editing.date === iso;
              return (
                <div
                  key={iso}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) interaction.onStartNew(task.id, iso);
                  }}
                  className="relative min-h-[18px] cursor-text"
                >
                  {subs.map((s) => (
                    <SubtaskItem
                      key={s.id}
                      subtask={s}
                      editing={
                        interaction.editing?.kind === "sub" &&
                        interaction.editing.subtaskId === s.id
                      }
                      interaction={interaction}
                    />
                  ))}

                  {addingHere && (
                    <input
                      key={`${task.id}:${iso}`}
                      autoFocus
                      defaultValue=""
                      placeholder="Subtask…"
                      className="fs-10 w-full bg-transparent px-1 py-0.5 leading-tight outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          // Commit and immediately start the next one in this cell.
                          interaction.onAddSubtask(task.id, iso, e.currentTarget.value);
                          e.currentTarget.value = "";
                        } else if (e.key === "Escape") {
                          interaction.onCancelEdit();
                        }
                      }}
                      onBlur={(e) => interaction.onCommitNew(task.id, iso, e.currentTarget.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Bottom-edge handle: drag to set this task's row height; double-click resets. */}
      <div
        onPointerDown={onResizeRow}
        onDoubleClick={() => interaction.onSetTaskHeight(task.id, 0)}
        title="Drag to resize row height · double-click to reset"
        className="absolute bottom-0 left-0 right-0 z-20 h-1.5 cursor-row-resize touch-none coarse:h-3"
      />
    </div>
  );
}
