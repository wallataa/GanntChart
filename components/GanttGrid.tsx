"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { addDays } from "date-fns";
import type { DateRange, Event, GridInteraction, Subtask, SwimLane } from "@/types";
import { columnIndex, daysInRange, fromISODate, toISODate } from "@/lib/dates";
import { isLifeLane, pinLifeLast } from "@/lib/lanes";
import { startDrag } from "@/lib/drag";
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

/** Pixels the pointer must travel before a click becomes a drag. */
const DRAG_THRESHOLD = 4;

/**
 * The scrollable Gantt surface. Owns the cross-lane "move" drag: each lane
 * registers its track element so we can hit-test the pointer to a (lane, date)
 * and relocate an event by dragging its body. Resize (single-lane) and inline
 * editing live in SwimLane.
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
  const days = daysInRange(range);
  const total = days.length;

  // laneId -> track DOM element, for pointer hit-testing.
  const trackRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerTrack = useCallback((laneId: string, el: HTMLElement | null) => {
    if (el) trackRefs.current.set(laneId, el);
    else trackRefs.current.delete(laneId);
  }, []);

  const [movePreview, setMovePreview] = useState<MovePreview | null>(null);
  const previewRef = useRef<MovePreview | null>(null);
  previewRef.current = movePreview;

  // Lane reorder drag. `laneDragId` is the lane being dragged; `lanePreview`
  // is the live id ordering shown while dragging.
  const [laneDragId, setLaneDragId] = useState<string | null>(null);
  const [lanePreview, setLanePreview] = useState<string[] | null>(null);
  const lanePreviewRef = useRef<string[] | null>(null);
  lanePreviewRef.current = lanePreview;

  /** Find the non-Life lane whose track contains clientY. */
  const laneAtY = (clientY: number): { lane: SwimLane; rect: DOMRect } | null => {
    for (const lane of lanes) {
      if (isLifeLane(lane)) continue; // events can't be dropped into the GCal lane
      const el = trackRefs.current.get(lane.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return { lane, rect };
    }
    return null;
  };

  const handleEventPointerDown = (event: Event, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const originEl = trackRefs.current.get(event.laneId);
    if (!originEl) return;

    const originRect = originEl.getBoundingClientRect();
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

  // Build the lane id ordering for a reorder drag: remove the dragged lane and
  // insert it where the cursor sits (before the lane whose midpoint we're above),
  // keeping the locked Life lane pinned last.
  const orderForLaneDrag = (dragId: string, clientY: number): string[] => {
    const others = lanes.filter((l) => l.id !== dragId);
    let insert = others.length;
    for (let i = 0; i < others.length; i++) {
      const el = trackRefs.current.get(others[i].id);
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
    if (!lane || isLifeLane(lane)) return; // Life lane is locked.
    startDrag(e, {
      threshold: DRAG_THRESHOLD,
      onActivate: () => setLaneDragId(laneId),
      onMove: (ev) => setLanePreview(orderForLaneDrag(laneId, ev.clientY)),
      onUp: (_ev, activated) => {
        const order = lanePreviewRef.current;
        if (activated && order) {
          const from = lanes.findIndex((l) => l.id === laneId);
          const to = order.indexOf(laneId);
          if (from !== -1 && to !== -1 && from !== to) interaction.onReorderLanes(from, to);
        }
        setLaneDragId(null);
        setLanePreview(null);
      },
    });
  };

  // Resolve the lane render order (preview order while reordering).
  const orderedLanes: SwimLane[] =
    lanePreview
      ? (lanePreview.map((id) => lanes.find((l) => l.id === id)).filter(Boolean) as SwimLane[])
      : lanes;

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
            registerTrack={registerTrack}
            onEventPointerDown={handleEventPointerDown}
            draggingId={movePreview?.eventId ?? null}
            onLanePointerDown={handleLanePointerDown}
            laneDragging={laneDragId === lane.id}
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
