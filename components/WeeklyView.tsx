"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { addDays } from "date-fns";
import type { DateRange, Event, Subtask, SwimLane, WeeklyInteraction } from "@/types";
import { fromISODate, isWithinRange, placeEvent, toISODate } from "@/lib/dates";
import { startDrag } from "@/lib/drag";
import { DRAG_THRESHOLD, useLaneReorder } from "@/lib/useLaneReorder";
import DateHeader from "./DateHeader";
import WeeklyLane from "./WeeklyLane";

interface WeeklyViewProps {
  lanes: SwimLane[];
  events: Event[];
  range: DateRange;
  subtasks: Subtask[];
  interaction: WeeklyInteraction;
  columnWidth: number;
  /** Resize the day-column width (dragging a column edge in the header). */
  onColumnWidthChange: (width: number) => void;
  /** Left-column widths + resize handler (dragging the sidebar edges). */
  sidebarNotesWidth: number;
  sidebarLabelWidth: number;
  onResizeSidebar: (part: "notes" | "label", width: number) => void;
  onReorderLanes: (from: number, to: number) => void;
  /** Move a task to a lane + vertical position (insert before `beforeTaskId`,
      or append when null) and date span, in one update. */
  onMoveTask: (
    taskId: string,
    laneId: string,
    beforeTaskId: string | null,
    startISO: string,
    endISO: string,
  ) => void;
  selectedLaneId: string | null;
  onSelectLane: (laneId: string | null) => void;
  onToggleSubtask: (subtaskId: string) => void;
  /** Hide lanes with no task/event in the visible fortnight. */
  hideEmptyLanes: boolean;
  /** Append a new swim lane. */
  onAddLane: () => void;
  /** Delete a lane and its events (Life lane is locked). */
  onDeleteLane: (id: string) => void;
}

/**
 * Two-week day-planning surface. Lane reordering is the shared useLaneReorder
 * hook (grip on the lane header); this component owns the task drag — moving a
 * task to a different lane/position and rescheduling its dates. Subtask
 * editing lives in TaskSubLane.
 */
export default function WeeklyView({
  lanes,
  events,
  range,
  subtasks,
  interaction,
  columnWidth,
  onColumnWidthChange,
  sidebarNotesWidth,
  sidebarLabelWidth,
  onResizeSidebar,
  onReorderLanes,
  onMoveTask,
  selectedLaneId,
  onSelectLane,
  onToggleSubtask,
  hideEmptyLanes,
  onAddLane,
  onDeleteLane,
}: WeeklyViewProps) {
  // A lane has content this fortnight if any of its events overlap the window or
  // carry a subtask landing in it.
  const laneHasContent = (lane: SwimLane): boolean =>
    events.some(
      (e) =>
        e.laneId === lane.id &&
        (placeEvent(e.start, e.end, range) !== null ||
          subtasks.some((s) => s.taskId === e.id && isWithinRange(s.date, range))),
    );

  // The scrollable surface, for edge auto-scroll during drags.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const getScroll = useCallback(() => scrollRef.current, []);

  const { registerLane, onLanePointerDown, orderedLanes, draggingLaneId, laneAtY } =
    useLaneReorder(lanes, onReorderLanes, getScroll);

  // taskId -> task row element, for reorder/move hit-testing.
  const taskRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerTask = useCallback((taskId: string, el: HTMLElement | null) => {
    if (el) taskRefs.current.set(taskId, el);
    else taskRefs.current.delete(taskId);
  }, []);

  // Task move/reorder drag (the bar or the grip). `taskDragId` is the row being
  // dragged (for styling); `taskDrop` is the live vertical target (lane + the
  // task to insert before); `barDx` is the live horizontal offset for the bar.
  const [taskDragId, setTaskDragId] = useState<string | null>(null);
  const [barDx, setBarDx] = useState<{ taskId: string; px: number } | null>(null);
  const taskDropRef = useRef<{ laneId: string; beforeTaskId: string | null } | null>(null);

  // Resolve the drop target under the cursor: the (non-Life) lane and the task
  // we'd insert ahead of within it (null = append to that lane).
  const dropTargetFor = (
    dragId: string,
    clientY: number,
  ): { laneId: string; beforeTaskId: string | null } => {
    const lane = laneAtY(clientY)?.lane;
    const dragged = events.find((e) => e.id === dragId);
    if (!lane) return { laneId: dragged?.laneId ?? "", beforeTaskId: null };
    const laneTasks = events.filter((e) => e.laneId === lane.id && e.id !== dragId);
    for (const t of laneTasks) {
      const el = taskRefs.current.get(t.id);
      if (!el) continue; // task not rendered this fortnight — skip
      const r = el.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return { laneId: lane.id, beforeTaskId: t.id };
    }
    return { laneId: lane.id, beforeTaskId: null };
  };

  // Shared drag for both the grip and the bar. Vertical movement reorders /
  // moves the task between lanes; horizontal movement reschedules its dates
  // (bar only). A click with no movement selects (bar only).
  const startTaskDrag = (
    task: Event,
    e: ReactPointerEvent,
    opts: { reschedule: boolean; selectOnClick: boolean },
  ) => {
    if (e.button !== 0 || task.source !== "manual") return;
    const startX = e.clientX;
    startDrag(e, {
      threshold: DRAG_THRESHOLD,
      scrollContainer: getScroll,
      onActivate: () => setTaskDragId(task.id),
      onMove: (ev) => {
        taskDropRef.current = dropTargetFor(task.id, ev.clientY);
        if (opts.reschedule) setBarDx({ taskId: task.id, px: ev.clientX - startX });
      },
      onUp: (ev, activated) => {
        const drop = taskDropRef.current;
        if (activated && drop && drop.laneId) {
          const dxCols = opts.reschedule ? Math.round((ev.clientX - startX) / columnWidth) : 0;
          const start = dxCols ? toISODate(addDays(fromISODate(task.start), dxCols)) : task.start;
          const end = dxCols ? toISODate(addDays(fromISODate(task.end), dxCols)) : task.end;
          onMoveTask(task.id, drop.laneId, drop.beforeTaskId, start, end);
        } else if (!activated && opts.selectOnClick) {
          interaction.onSelectTask(task.id);
        }
        setTaskDragId(null);
        setBarDx(null);
        taskDropRef.current = null;
      },
      onCancel: () => {
        setTaskDragId(null);
        setBarDx(null);
        taskDropRef.current = null;
      },
    });
  };

  // Grip: vertical reorder / move only. Bar: also reschedule, and select on click.
  const handleTaskPointerDown = (task: Event, e: ReactPointerEvent) =>
    startTaskDrag(task, e, { reschedule: false, selectOnClick: false });
  const handleBarPointerDown = (task: Event, e: ReactPointerEvent) =>
    startTaskDrag(task, e, { reschedule: true, selectOnClick: true });

  // Apply the lane-reorder preview (task moves commit on drop, no live preview),
  // then optionally drop lanes that are empty this fortnight.
  const visibleLanes = orderedLanes.filter((lane) => !hideEmptyLanes || laneHasContent(lane));

  return (
    <div
      ref={scrollRef}
      className="gantt-scroll h-full overflow-auto border border-neutral-300 dark:border-neutral-700"
    >
      <div className="w-max min-w-full">
        <DateHeader
          range={range}
          columnWidth={columnWidth}
          onColumnWidthChange={onColumnWidthChange}
          sidebarNotesWidth={sidebarNotesWidth}
          sidebarLabelWidth={sidebarLabelWidth}
          onResizeSidebar={onResizeSidebar}
        />
        {visibleLanes.map((lane) => (
          <WeeklyLane
            key={lane.id}
            lane={lane}
            events={events}
            range={range}
            subtasks={subtasks}
            interaction={interaction}
            columnWidth={columnWidth}
            registerLane={registerLane}
            registerTask={registerTask}
            onLanePointerDown={onLanePointerDown}
            onTaskPointerDown={handleTaskPointerDown}
            onBarPointerDown={handleBarPointerDown}
            barDx={barDx}
            laneDragging={draggingLaneId === lane.id}
            draggingTaskId={taskDragId}
            selected={selectedLaneId === lane.id}
            onSelectLane={onSelectLane}
            onToggleSubtask={onToggleSubtask}
            onDeleteLane={onDeleteLane}
          />
        ))}

        {/* Add-lane footer row (sticky to the left like the lane headers). */}
        <div className="flex border-b border-neutral-300 dark:border-neutral-700">
          <button
            type="button"
            onClick={onAddLane}
            style={{ width: "var(--sb-w, 316px)" }}
            className="fs-11 sticky left-0 z-10 shrink-0 bg-white py-1.5 pl-7 text-left text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700 dark:bg-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            + Add lane
          </button>
        </div>
      </div>
    </div>
  );
}
