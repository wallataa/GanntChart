"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { DateRange, Event, Subtask, SwimLane, WeeklyInteraction } from "@/types";
import {
  daysInRange,
  isToday,
  isWeekend,
  isWithinRange,
  placeEvent,
  toISODate,
} from "@/lib/dates";
import { fillFor, textOn } from "@/lib/colors";
import { confirmDeleteLane, isLifeLane } from "@/lib/lanes";
import { packEvents } from "@/lib/events";
import TaskSubLane from "./TaskSubLane";
import DayColumns from "./DayColumns";
import { CalendarIcon, GripIcon, LockIcon, XIcon } from "./icons";

interface WeeklyLaneProps {
  lane: SwimLane;
  /** All events (filtered to this lane internally). */
  events: Event[];
  range: DateRange;
  subtasks: Subtask[];
  interaction: WeeklyInteraction;
  columnWidth: number;
  registerLane: (laneId: string, el: HTMLElement | null) => void;
  registerTask: (taskId: string, el: HTMLElement | null) => void;
  onLanePointerDown: (laneId: string, e: ReactPointerEvent) => void;
  onTaskPointerDown: (task: Event, e: ReactPointerEvent) => void;
  /** Begin a drag from the task bar (reschedule / reorder / select). */
  onBarPointerDown: (task: Event, e: ReactPointerEvent) => void;
  /** Live horizontal offset of the bar being dragged, if any. */
  barDx: { taskId: string; px: number } | null;
  laneDragging: boolean;
  draggingTaskId: string | null;
  /** True when this lane is selected (for recolor via the toolbar Fill). */
  selected: boolean;
  onSelectLane: (laneId: string | null) => void;
  onToggleSubtask: (subtaskId: string) => void;
  /** Delete this lane and its events (Life lane is locked). */
  onDeleteLane: (id: string) => void;
}

/**
 * The task rows' left column. On ≥sm the lane label has its own column (like
 * the main view), so task cells take the remaining sidebar width and stick
 * after it; on phones the label is a band above the rows and task cells get
 * the full sidebar width. Keep in sync with TaskSubLane's matching classes.
 */
const CELL_W =
  "w-[var(--sb-w,316px)] sm:w-[calc(var(--sb-w,316px)_-_var(--sb-label,120px))]";
const CELL_LEFT = "left-0 sm:left-[var(--sb-label,120px)]";

/** A project group: a lane-label column (main-view style) beside its task
 *  sub-lanes — or, on phones, a label band above them. */
export default function WeeklyLane({
  lane,
  events,
  range,
  subtasks,
  interaction,
  columnWidth,
  registerLane,
  registerTask,
  onLanePointerDown,
  onTaskPointerDown,
  onBarPointerDown,
  barDx,
  laneDragging,
  draggingTaskId,
  selected,
  onSelectLane,
  onToggleSubtask,
  onDeleteLane,
}: WeeklyLaneProps) {
  const days = daysInRange(range);
  const columns = `repeat(${days.length}, ${columnWidth}px)`;
  const life = isLifeLane(lane);
  const laneEventCount = events.filter((e) => e.laneId === lane.id).length;

  // Show a task if it overlaps the window OR has a subtask landing in the window.
  const tasks = events
    .filter((e) => e.laneId === lane.id)
    .filter(
      (e) =>
        placeEvent(e.start, e.end, range) !== null ||
        subtasks.some((s) => s.taskId === e.id && isWithinRange(s.date, range)),
    );

  // The Life lane renders like the main view: GCal events packed into stacking
  // tracks within a single band (read-only, no subtasks).
  const lifePack = life
    ? packEvents(events.filter((e) => e.laneId === lane.id), range)
    : null;

  const tint = life
    ? "linear-gradient(rgba(168,230,208,0.35), rgba(168,230,208,0.35))"
    : `linear-gradient(${fillFor(lane.color)}66, ${fillFor(lane.color)}66)`;

  const grip = life ? (
    <span className="flex w-4 shrink-0 justify-center text-neutral-400" title="Locked">
      <LockIcon className="h-3 w-3" />
    </span>
  ) : (
    <span
      onPointerDown={(e) => onLanePointerDown(lane.id, e)}
      title="Drag to reorder lane"
      className="flex w-4 shrink-0 cursor-grab touch-none select-none justify-center text-neutral-400 hover:text-neutral-600 active:cursor-grabbing dark:hover:text-neutral-300"
    >
      <GripIcon className="h-3.5 w-3.5" />
    </span>
  );

  const deleteButton = (className: string) =>
    !life && (
      <button
        type="button"
        onClick={() => {
          if (confirmDeleteLane(lane.label, laneEventCount)) onDeleteLane(lane.id);
        }}
        title={`Delete ${lane.label}`}
        aria-label={`Delete ${lane.label}`}
        className={`text-neutral-400 hover:text-red-600 coarse:hidden dark:hover:text-red-400 ${className}`}
      >
        <XIcon className="h-3 w-3" />
      </button>
    );

  return (
    <div
      ref={(el) => registerLane(lane.id, el)}
      className={[
        // The strong line sits BETWEEN lanes. On ≥sm the group is a flex row of
        // [label column | task rows] (like the main view); on phones the label
        // is a band above the rows.
        "border-b border-neutral-300 dark:border-neutral-600 sm:flex",
        laneDragging ? "relative z-20 bg-white opacity-90 shadow-md dark:bg-neutral-950" : "",
      ].join(" ")}
    >
      {/* Phone-only: lane label band above the rows. */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 sm:hidden">
        <div
          className={[
            "fs-14 sticky left-0 z-10 flex w-[var(--sb-w,316px)] shrink-0 items-center gap-1 bg-white py-1 pl-1 pr-2 font-semibold text-neutral-800 coarse:py-2 dark:bg-neutral-950 dark:text-neutral-100",
            selected ? "ring-2 ring-inset ring-blue-400" : "",
          ].join(" ")}
          style={{ backgroundImage: tint }}
        >
          {grip}
          {life && <CalendarIcon className="h-3.5 w-3.5 shrink-0" />}
          <button
            type="button"
            onClick={() => onSelectLane(lane.id)}
            title="Click to select this lane (recolor)"
            className="min-w-0 flex-1 truncate text-left hover:text-blue-700 dark:hover:text-blue-400"
          >
            {lane.label}
          </button>
          {deleteButton("shrink-0 px-1")}
        </div>
        <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
          {days.map((d) => (
            <div
              key={toISODate(d)}
              className={[
                "border-l border-neutral-200 dark:border-neutral-800",
                isWeekend(d) ? "bg-neutral-100 dark:bg-neutral-900" : "",
                isToday(d) ? "bg-blue-50/60 dark:bg-blue-500/10" : "",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      {/* ≥sm: lane label column, like the main view's label cell. */}
      <div
        className={[
          "group/label sticky left-0 z-10 hidden w-[var(--sb-label,120px)] shrink-0 items-center justify-center border-r bg-white px-1 text-center dark:bg-neutral-950 sm:flex",
          selected
            ? "border-blue-500 ring-2 ring-inset ring-blue-400"
            : "border-neutral-200 dark:border-neutral-700",
        ].join(" ")}
        style={{ backgroundImage: tint }}
      >
        {/* Reorder grip / lock, pinned to the column's left edge. */}
        <div className="absolute left-0 top-0 flex h-full items-center">{grip}</div>
        {deleteButton(
          "absolute right-0.5 top-0.5 z-10 rounded p-0.5 opacity-0 hover:bg-white/60 focus:opacity-100 group-hover/label:opacity-100 dark:hover:bg-black/40",
        )}
        <button
          type="button"
          onClick={() => onSelectLane(lane.id)}
          title="Click to select this lane (recolor)"
          className="fs-14 flex w-full min-w-0 items-center justify-center gap-1 rounded py-1 pl-3 font-medium text-neutral-800 hover:bg-black/5 dark:text-neutral-100 dark:hover:bg-white/10"
        >
          {life && <CalendarIcon className="h-3.5 w-3.5 shrink-0" />}
          <span className="min-w-0 break-words">{lane.label}</span>
        </button>
      </div>

      {/* Lane content: the task rows (or the Life band / empty placeholder). */}
      <div className="sm:min-w-0 sm:flex-1">
      {/* Life lane: single stacked band of read-only GCal events (like main view) */}
      {life && lifePack ? (
        <div className="flex">
          <div
            className={`sticky ${CELL_LEFT} ${CELL_W} z-10 shrink-0 bg-white dark:bg-neutral-950`}
            style={{
              backgroundImage: `linear-gradient(${fillFor(lane.color)}22, ${fillFor(lane.color)}22)`,
            }}
          />
          <div className="relative flex-1">
            <DayColumns range={range} columnWidth={columnWidth} />
            <div
              className="row-cap relative grid gap-y-px py-px"
              style={{
                gridTemplateColumns: columns,
                gridTemplateRows: `repeat(${lifePack.trackCount}, minmax(22px, auto))`,
              }}
            >
              {lifePack.placed.map((p) => {
                // GCal events carry their real Google color (may be dark).
                const fill = p.event.gcalColor ?? fillFor(p.event.color ?? lane.color);
                return (
                  <div
                    key={p.event.id}
                    title={p.event.title}
                    className="fs-11 m-[2px] flex items-center overflow-hidden rounded-[3px] border border-black/10 px-1.5 text-neutral-900"
                    style={{
                      gridColumn: `${p.colStart} / span ${p.span}`,
                      gridRow: p.track,
                      backgroundColor: fill,
                      color: p.event.gcalColor ? textOn(fill) : undefined,
                    }}
                  >
                    <span className="truncate font-medium">{p.event.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : tasks.length > 0 ? (
        tasks.map((task) => (
          <TaskSubLane
            key={task.id}
            task={task}
            lane={lane}
            range={range}
            subtasks={subtasks}
            interaction={interaction}
            columnWidth={columnWidth}
            registerTask={registerTask}
            onTaskPointerDown={onTaskPointerDown}
            onBarPointerDown={onBarPointerDown}
            barOffset={barDx?.taskId === task.id ? barDx.px : 0}
            onToggleSubtask={onToggleSubtask}
            dragging={draggingTaskId === task.id}
          />
        ))
      ) : (
        <div className="flex">
          <div
            className={`fs-10 sticky ${CELL_LEFT} ${CELL_W} z-10 shrink-0 bg-white py-0.5 pl-2 pr-2 text-neutral-300 dark:bg-neutral-950 dark:text-neutral-600`}
          >
            no tasks this fortnight
          </div>
          <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
            {days.map((d) => (
              <div
                key={toISODate(d)}
                className={[
                  "min-h-[16px] border-l border-neutral-200 dark:border-neutral-800",
                  isWeekend(d) ? "bg-neutral-50 dark:bg-neutral-900/60" : "",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
