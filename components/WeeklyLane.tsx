"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { DateRange, Event, Subtask, SwimLane, WeeklyInteraction } from "@/types";
import {
  SIDEBAR_LABEL_WIDTH,
  SIDEBAR_NOTES_WIDTH,
  daysInRange,
  isToday,
  isWeekend,
  isWithinRange,
  placeEvent,
  toISODate,
} from "@/lib/dates";
import { fillFor } from "@/lib/colors";
import { isLifeLane } from "@/lib/lanes";
import { packEvents } from "@/lib/events";
import TaskSubLane from "./TaskSubLane";

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
}

const SIDEBAR_WIDTH = SIDEBAR_NOTES_WIDTH + SIDEBAR_LABEL_WIDTH;

/** A project group: a lane header band followed by its task sub-lanes. */
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
}: WeeklyLaneProps) {
  const days = daysInRange(range);
  const columns = `repeat(${days.length}, ${columnWidth}px)`;
  const life = isLifeLane(lane);

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

  return (
    <div
      ref={(el) => registerLane(lane.id, el)}
      className={laneDragging ? "relative z-20 bg-white opacity-90 shadow-md" : ""}
    >
      {/* Lane header band (with reorder grip) */}
      <div className="flex border-b border-neutral-300">
        <div
          className={[
            "fs-14 sticky left-0 z-10 flex shrink-0 items-center gap-1 py-1 pl-1 pr-2 font-semibold text-neutral-800",
            selected ? "ring-2 ring-inset ring-blue-400" : "",
          ].join(" ")}
          style={{
            width: SIDEBAR_WIDTH,
            backgroundColor: life ? "rgba(168,230,208,0.35)" : `${fillFor(lane.color)}66`,
          }}
        >
          {life ? (
            <span className="w-4 text-center text-[10px] text-neutral-400" title="Locked">
              🔒
            </span>
          ) : (
            <span
              onPointerDown={(e) => onLanePointerDown(lane.id, e)}
              title="Drag to reorder lane"
              className="w-4 cursor-grab select-none text-center text-neutral-400 hover:text-neutral-600 active:cursor-grabbing"
            >
              ⠿
            </span>
          )}
          {life && <span aria-hidden>🗓️</span>}
          {/* Click the label to select the lane (recolor via the toolbar Fill). */}
          <button
            type="button"
            onClick={() => onSelectLane(lane.id)}
            title="Click to select this lane (recolor)"
            className="min-w-0 flex-1 truncate text-left hover:text-blue-700"
          >
            {lane.label}
          </button>
        </div>
        <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
          {days.map((d) => {
            const iso = toISODate(d);
            return (
              <div
                key={iso}
                className={[
                  "border-l border-neutral-200",
                  isWeekend(d) ? "bg-neutral-100" : "",
                  isToday(d) ? "bg-blue-50/60" : "",
                ].join(" ")}
              />
            );
          })}
        </div>
      </div>

      {/* Life lane: single stacked band of read-only GCal events (like main view) */}
      {life && lifePack ? (
        <div className="flex border-b border-neutral-100">
          <div
            className="sticky left-0 z-10 shrink-0 bg-white"
            style={{
              width: SIDEBAR_WIDTH,
              backgroundImage: `linear-gradient(${fillFor(lane.color)}22, ${fillFor(lane.color)}22)`,
            }}
          />
          <div className="relative flex-1">
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: columns }}>
              {days.map((d) => (
                <div
                  key={toISODate(d)}
                  className={[
                    "border-l border-neutral-200",
                    isWeekend(d) ? "bg-neutral-50" : "",
                    isToday(d) ? "bg-blue-50/50" : "",
                  ].join(" ")}
                />
              ))}
            </div>
            <div
              className="row-cap relative grid gap-y-px py-px"
              style={{
                gridTemplateColumns: columns,
                gridTemplateRows: `repeat(${lifePack.trackCount}, minmax(22px, auto))`,
              }}
            >
              {lifePack.placed.map((p) => (
                <div
                  key={p.event.id}
                  title={p.event.title}
                  className="fs-11 m-[2px] flex items-center overflow-hidden rounded-[3px] border border-black/10 px-1.5 text-neutral-900"
                  style={{
                    gridColumn: `${p.colStart} / span ${p.span}`,
                    gridRow: p.track,
                    backgroundColor: fillFor(p.event.color ?? lane.color),
                  }}
                >
                  <span className="truncate font-medium">{p.event.title}</span>
                </div>
              ))}
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
        <div className="flex border-b border-neutral-100">
          <div
            className="fs-11 sticky left-0 z-10 shrink-0 bg-white py-1 pl-7 pr-2 italic text-neutral-300"
            style={{ width: SIDEBAR_WIDTH }}
          >
            no tasks this fortnight
          </div>
          <div className="grid flex-1" style={{ gridTemplateColumns: columns }}>
            {days.map((d) => (
              <div
                key={toISODate(d)}
                className={[
                  "min-h-[24px] border-l border-neutral-200",
                  isWeekend(d) ? "bg-neutral-50" : "",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
