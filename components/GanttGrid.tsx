"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { addDays } from "date-fns";
import type { DateRange, Event, GridInteraction, Subtask, SwimLane } from "@/types";
import { columnCount, columnIndex, fromISODate, toISODate } from "@/lib/dates";
import { startDrag } from "@/lib/drag";
import { DRAG_THRESHOLD, useLaneReorder } from "@/lib/useLaneReorder";
import DateHeader from "./DateHeader";
import SwimLaneRow from "./SwimLane";

interface GanttGridProps {
  lanes: SwimLane[];
  events: Event[];
  range: DateRange;
  interaction: GridInteraction;
  columnWidth: number;
  /** Resize the day-column width (dragging a column edge in the header). */
  onColumnWidthChange: (width: number) => void;
  /** Left-column widths + resize handler (dragging the sidebar edges). */
  sidebarNotesWidth: number;
  sidebarLabelWidth: number;
  onResizeSidebar: (part: "notes" | "label", width: number) => void;
  /** Subtasks, for the accumulated per-task to-do list in the sidebar. */
  subtasks: Subtask[];
  onToggleSubtask: (subtaskId: string) => void;
}

interface MovePreview {
  eventId: string;
  laneId: string;
  start: string;
  end: string;
}

/**
 * The scrollable Gantt surface. Owns the cross-lane "move" drag: each lane
 * registers its track element (via useLaneReorder's registry) so we can
 * hit-test the pointer to a (lane, date) and relocate an event by dragging its
 * body. Lane reordering is the shared useLaneReorder hook; resize (single-lane)
 * and inline editing live in SwimLane.
 */
export default function GanttGrid({
  lanes,
  events,
  range,
  interaction,
  columnWidth,
  onColumnWidthChange,
  sidebarNotesWidth,
  sidebarLabelWidth,
  onResizeSidebar,
  subtasks,
  onToggleSubtask,
}: GanttGridProps) {
  const total = columnCount(range);

  const { registerLane, onLanePointerDown, orderedLanes, draggingLaneId, laneAtY } =
    useLaneReorder(lanes, interaction.onReorderLanes);

  const [movePreview, setMovePreview] = useState<MovePreview | null>(null);
  const previewRef = useRef<MovePreview | null>(null);
  previewRef.current = movePreview;

  const handleEventPointerDown = (event: Event, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const origin = laneAtY(e.clientY);
    if (!origin) return;

    const originRect = origin.rect;
    const startCol = columnIndex(fromISODate(event.start), range);
    const duration = columnIndex(fromISODate(event.end), range) - startCol; // in days, >= 0
    const clickedCol = Math.floor((e.clientX - originRect.left) / columnWidth);
    const grabOffset = Math.max(0, clickedCol - startCol); // keep the grab point under the cursor

    startDrag(e, {
      threshold: DRAG_THRESHOLD,
      onMove: (ev) => {
        const hit = laneAtY(ev.clientY);
        const laneId = hit?.lane.id ?? event.laneId;
        const left = hit?.rect.left ?? originRect.left;
        const rawCol = Math.floor((ev.clientX - left) / columnWidth) - grabOffset;
        const startColNew = Math.max(0, Math.min(total - 1, rawCol));
        setMovePreview({
          eventId: event.id,
          laneId,
          start: toISODate(addDays(range.start, startColNew)),
          end: toISODate(addDays(range.start, startColNew + duration)),
        });
      },
      onUp: (_ev, activated) => {
        const p = previewRef.current;
        if (activated && p) interaction.onMoveEvent(p.eventId, p.laneId, p.start, p.end);
        else if (!activated) interaction.onSelect(event.id); // a plain click selects
        setMovePreview(null);
      },
    });
  };

  // Apply the live move preview so the block follows the cursor across lanes.
  const effective: Event[] = movePreview
    ? events.map((e) =>
        e.id === movePreview.eventId
          ? { ...e, laneId: movePreview.laneId, start: movePreview.start, end: movePreview.end }
          : e,
      )
    : events;

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
          <SwimLaneRow
            key={lane.id}
            lane={lane}
            events={effective.filter((e) => e.laneId === lane.id)}
            range={range}
            interaction={interaction}
            columnWidth={columnWidth}
            subtasks={subtasks}
            onToggleSubtask={onToggleSubtask}
            registerTrack={registerLane}
            onEventPointerDown={handleEventPointerDown}
            draggingId={movePreview?.eventId ?? null}
            onLanePointerDown={onLanePointerDown}
            laneDragging={draggingLaneId === lane.id}
          />
        ))}

        {/* Add-lane footer row (sticky to the left like the sidebar). */}
        <div className="flex border-b border-neutral-200">
          <button
            type="button"
            onClick={interaction.onAddLane}
            style={{ width: "var(--sb-w, 316px)" }}
            className="fs-11 sticky left-0 z-10 shrink-0 bg-white py-1.5 pl-5 text-left text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700"
          >
            + Add lane
          </button>
        </div>
      </div>
    </div>
  );
}
