"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { addDays } from "date-fns";
import type { DateRange, Event, Subtask, SwimLane, WeeklyInteraction } from "@/types";
import { isLifeLane, pinLifeLast } from "@/lib/lanes";
import { fromISODate, isWithinRange, placeEvent, toISODate } from "@/lib/dates";
import { startDrag } from "@/lib/drag";
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

const DRAG_THRESHOLD = 4;

/**
 * Two-week day-planning surface. Owns two cross-row drags: reordering swim lanes
 * (grip on the lane header) and moving a task to a different lane (grip on the
 * task row). Subtask editing lives in TaskSubLane.
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
  // laneId -> lane group element, for pointer hit-testing.
  const laneRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerLane = useCallback((laneId: string, el: HTMLElement | null) => {
    if (el) laneRefs.current.set(laneId, el);
    else laneRefs.current.delete(laneId);
  }, []);

  // taskId -> task row element, for reorder/move hit-testing.
  const taskRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerTask = useCallback((taskId: string, el: HTMLElement | null) => {
    if (el) taskRefs.current.set(taskId, el);
    else taskRefs.current.delete(taskId);
  }, []);

  // Lane reorder drag.
  const [laneDragId, setLaneDragId] = useState<string | null>(null);
  const [lanePreview, setLanePreview] = useState<string[] | null>(null);
  const lanePreviewRef = useRef<string[] | null>(null);
  lanePreviewRef.current = lanePreview;

  // Task move/reorder drag (the bar or the grip). `taskDragId` is the row being
  // dragged (for styling); `taskDrop` is the live vertical target (lane + the
  // task to insert before); `barDx` is the live horizontal offset for the bar.
  const [taskDragId, setTaskDragId] = useState<string | null>(null);
  const [barDx, setBarDx] = useState<{ taskId: string; px: number } | null>(null);
  const taskDropRef = useRef<{ laneId: string; beforeTaskId: string | null } | null>(null);

  /** Non-Life lane whose group contains clientY. */
  const laneAtY = (clientY: number): SwimLane | null => {
    for (const lane of lanes) {
      if (isLifeLane(lane)) continue;
      const el = laneRefs.current.get(lane.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) return lane;
    }
    return null;
  };

  // ---- Lane reorder ----
  const orderForLaneDrag = (dragId: string, clientY: number): string[] => {
    const others = lanes.filter((l) => l.id !== dragId);
    let insert = others.length;
    for (let i = 0; i < others.length; i++) {
      const el = laneRefs.current.get(others[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        insert = i;
        break;
      }
    }
    const dragged = lanes.find((l) => l.id === dragId)!;
    const next = [...others];
    next.splice(insert, 0, dragged);
    return pinLifeLast(next).map((l) => l.id);
  };

  const handleLanePointerDown = (laneId: string, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const lane = lanes.find((l) => l.id === laneId);
    if (!lane || isLifeLane(lane)) return;
    startDrag(e, {
      threshold: DRAG_THRESHOLD,
      onActivate: () => setLaneDragId(laneId),
      onMove: (ev) => setLanePreview(orderForLaneDrag(laneId, ev.clientY)),
      onUp: (_ev, activated) => {
        const order = lanePreviewRef.current;
        if (activated && order) {
          const from = lanes.findIndex((l) => l.id === laneId);
          const to = order.indexOf(laneId);
          if (from !== -1 && to !== -1 && from !== to) onReorderLanes(from, to);
        }
        setLaneDragId(null);
        setLanePreview(null);
      },
    });
  };

  // ---- Task reorder / move between lanes (grip) ----
  // Resolve the drop target under the cursor: the (non-Life) lane and the task
  // we'd insert ahead of within it (null = append to that lane).
  const dropTargetFor = (
    dragId: string,
    clientY: number,
  ): { laneId: string; beforeTaskId: string | null } => {
    const lane = laneAtY(clientY);
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
    });
  };

  // Grip: vertical reorder / move only. Bar: also reschedule, and select on click.
  const handleTaskPointerDown = (task: Event, e: ReactPointerEvent) =>
    startTaskDrag(task, e, { reschedule: false, selectOnClick: false });
  const handleBarPointerDown = (task: Event, e: ReactPointerEvent) =>
    startTaskDrag(task, e, { reschedule: true, selectOnClick: true });

  // Apply the lane-reorder preview (task moves commit on drop, no live preview),
  // then optionally drop lanes that are empty this fortnight.
  const orderedLanes: SwimLane[] = (
    lanePreview
      ? (lanePreview.map((id) => lanes.find((l) => l.id === id)).filter(Boolean) as SwimLane[])
      : lanes
  ).filter((lane) => !hideEmptyLanes || laneHasContent(lane));

  return (
    <div className="gantt-scroll h-full overflow-auto border border-neutral-300">
      <div className="w-max min-w-full">
        <DateHeader
          range={range}
          columnWidth={columnWidth}
          onColumnWidthChange={onColumnWidthChange}
          sidebarNotesWidth={sidebarNotesWidth}
          sidebarLabelWidth={sidebarLabelWidth}
          onResizeSidebar={onResizeSidebar}
        />
        {orderedLanes.map((lane) => (
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
            onLanePointerDown={handleLanePointerDown}
            onTaskPointerDown={handleTaskPointerDown}
            onBarPointerDown={handleBarPointerDown}
            barDx={barDx}
            laneDragging={laneDragId === lane.id}
            draggingTaskId={taskDragId}
            selected={selectedLaneId === lane.id}
            onSelectLane={onSelectLane}
            onToggleSubtask={onToggleSubtask}
            onDeleteLane={onDeleteLane}
          />
        ))}

        {/* Add-lane footer row (sticky to the left like the lane headers). */}
        <div className="flex border-b border-neutral-300">
          <button
            type="button"
            onClick={onAddLane}
            style={{ width: "var(--sb-w, 316px)" }}
            className="fs-11 sticky left-0 z-10 shrink-0 bg-white py-1.5 pl-7 text-left text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
          >
            + Add lane
          </button>
        </div>
      </div>
    </div>
  );
}
