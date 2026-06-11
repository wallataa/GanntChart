"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type {
  DateRange,
  Event,
  GridInteraction,
  ResizeEdge,
  Subtask,
  SwimLane as SwimLaneType,
} from "@/types";
import { daysInRange, toISODate } from "@/lib/dates";
import { isLifeLane } from "@/lib/lanes";
import { fillFor } from "@/lib/colors";
import { packEvents } from "@/lib/events";
import { startDrag } from "@/lib/drag";
import { useRowHeightDrag } from "@/lib/useRowHeightDrag";
import Sidebar from "./Sidebar";
import EventBlock from "./EventBlock";
import DayColumns from "./DayColumns";

interface SwimLaneProps {
  lane: SwimLaneType;
  events: Event[];
  range: DateRange;
  interaction: GridInteraction;
  columnWidth: number;
  /** All subtasks (for the per-task to-do list in the sidebar). */
  subtasks: Subtask[];
  onToggleSubtask: (subtaskId: string) => void;
  /** False on small screens — the notes column is collapsed entirely. */
  showNotes: boolean;
  /** Register this lane's track element for cross-lane drag hit-testing. */
  registerTrack: (laneId: string, el: HTMLElement | null) => void;
  /** Begin a move-drag from an event body (handled by the grid controller). */
  onEventPointerDown: (event: Event, e: ReactPointerEvent) => void;
  /** Id of the event currently being moved (for styling), if any. */
  draggingId: string | null;
  /** Begin a lane reorder drag from the sidebar handle. */
  onLanePointerDown: (laneId: string, e: ReactPointerEvent) => void;
  /** True while this whole lane is being dragged to reorder. */
  laneDragging: boolean;
}

/** One horizontal band: sticky sidebar + a date-column track with event blocks. */
export default function SwimLaneRow({
  lane,
  events,
  range,
  interaction,
  columnWidth,
  subtasks,
  onToggleSubtask,
  showNotes,
  registerTrack,
  onEventPointerDown,
  draggingId,
  onLanePointerDown,
  laneDragging,
}: SwimLaneProps) {
  const days = daysInRange(range);
  const life = isLifeLane(lane);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Row-height drag (drag the lane's bottom edge). The committed value lives
  // on `lane.rowHeight`.
  const { effHeight, onResizeRow } = useRowHeightDrag(
    lane.rowHeight,
    () => trackRef.current?.offsetHeight ?? 34,
    (h) => interaction.onSetLaneHeight(lane.id, h),
    32,
  );

  // Live preview while dragging an event edge to resize.
  const [preview, setPreview] = useState<{ eventId: string; start: string; end: string } | null>(
    null,
  );
  const previewRef = useRef(preview);
  previewRef.current = preview;

  // Live preview of a draw-to-create gesture (press on empty track, drag to
  // size). On release the grid controller turns it into a draft event in edit
  // mode; a press with no drag makes a single-day block.
  const [createPreview, setCreatePreview] = useState<{ startCol: number; endCol: number } | null>(
    null,
  );
  const createPreviewRef = useRef(createPreview);
  createPreviewRef.current = createPreview;

  // Map a clientX pixel to a day column index within this lane's track.
  const colFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const i = Math.floor((clientX - rect.left) / columnWidth);
    return Math.max(0, Math.min(days.length - 1, i));
  };

  // The scrollable grid surface, for edge auto-scroll during drags.
  const getScroll = () => trackRef.current?.closest<HTMLElement>(".gantt-scroll");

  // Begin an edge-resize drag for an event (the non-dragged edge stays fixed).
  const beginResize = (event: Event, edge: ResizeEdge) => {
    startDrag(
      { clientX: 0, clientY: 0 },
      {
        scrollContainer: getScroll,
        onMove: (e) => {
          const dateISO = toISODate(days[colFromX(e.clientX)]);
          if (edge === "end") {
            setPreview({ eventId: event.id, start: event.start, end: dateISO < event.start ? event.start : dateISO });
          } else {
            setPreview({ eventId: event.id, start: dateISO > event.end ? event.end : dateISO, end: event.end });
          }
        },
        onUp: () => {
          const p = previewRef.current;
          if (p) interaction.onResize(p.eventId, p.start, p.end);
          setPreview(null);
        },
        onCancel: () => setPreview(null),
      },
    );
  };

  // Press on empty track space and (optionally) drag to draw a new event.
  const beginCreate = (e: ReactPointerEvent) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return; // empty space only
    // If an event is mid-edit (e.g. a freshly-drawn draft still being typed),
    // this tap should only blur/commit that editor — not start a second draft.
    // On touch the input's blur fires *after* this pointer's `up`, so creating
    // here would replace the draft before its text commits and lose it.
    if (interaction.editingEventId) return;
    const startCol = colFromX(e.clientX);
    setCreatePreview({ startCol, endCol: startCol });
    startDrag(e, {
      scrollContainer: getScroll,
      onMove: (ev) => setCreatePreview({ startCol, endCol: colFromX(ev.clientX) }),
      onUp: () => {
        const p = createPreviewRef.current;
        setCreatePreview(null);
        if (!p) return;
        const a = Math.min(p.startCol, p.endCol);
        const b = Math.max(p.startCol, p.endCol);
        interaction.onCreateEvent(lane.id, toISODate(days[a]), toISODate(days[b]));
      },
      // A touch that became a scroll: discard the draft preview, create nothing.
      onCancel: () => setCreatePreview(null),
    });
  };

  // Apply the live preview so the block stretches as you drag.
  const effective = preview
    ? events.map((e) =>
        e.id === preview.eventId ? { ...e, start: preview.start, end: preview.end } : e,
      )
    : events;

  const { placed, trackCount } = packEvents(effective, range);
  const columns = `repeat(${days.length}, ${columnWidth}px)`;

  // Columns the draw-to-create preview spans (1-based, inclusive).
  const previewCols = createPreview
    ? {
        start: Math.min(createPreview.startCol, createPreview.endCol) + 1,
        span: Math.abs(createPreview.endCol - createPreview.startCol) + 1,
      }
    : null;

  return (
    <div
      className={[
        "relative flex transition-shadow",
        laneDragging ? "z-20 bg-white opacity-90 shadow-md dark:bg-neutral-950" : "",
      ].join(" ")}
    >
      <Sidebar
        lane={lane}
        interaction={interaction}
        onLanePointerDown={onLanePointerDown}
        tasks={events}
        subtasks={subtasks}
        onToggleSubtask={onToggleSubtask}
        showNotes={showNotes}
        maxHeight={effHeight}
      />

      {/* Track area. Press on empty space (the track itself, not an event block)
          and drag to draw a new event; release drops you into typing its title. */}
      <div
        ref={(el) => {
          trackRef.current = el;
          registerTrack(lane.id, el);
        }}
        onPointerDown={life ? undefined : beginCreate}
        className={[
          "group/track relative flex-1 border-b border-neutral-200 dark:border-neutral-800",
          life ? "" : "cursor-text",
        ].join(" ")}
        style={{
          minHeight: 34,
          backgroundColor: `${fillFor(lane.color)}24`,
          ...(effHeight ? { height: effHeight, overflowY: "auto", overflowX: "hidden" } : null),
        }}
      >
        <DayColumns range={range} columnWidth={columnWidth} />

        {/* Discoverability: empty lanes hint at draw-to-create on hover. */}
        {!life && events.length === 0 && !createPreview && (
          <span className="fs-10 pointer-events-none absolute inset-y-0 left-2 flex items-center text-neutral-400 opacity-0 transition-opacity group-hover/track:opacity-100 dark:text-neutral-500">
            drag across days to create an event
          </span>
        )}

        {/* Foreground: event blocks (defines row height). pointer-events-none so
            empty space falls through to the track click handler; children re-enable. */}
        <div
          className="pointer-events-none relative grid gap-y-px py-px"
          style={{
            gridTemplateColumns: columns,
            gridTemplateRows: `repeat(${trackCount}, minmax(26px, auto))`,
          }}
        >
          {placed.map((p) => (
            <EventBlock
              key={p.event.id}
              event={p.event}
              lane={lane}
              colStart={p.colStart}
              span={p.span}
              track={p.track}
              selected={interaction.selectedEventId === p.event.id}
              editing={interaction.editingEventId === p.event.id}
              dragging={draggingId === p.event.id}
              onStartEdit={() => interaction.onStartEdit(p.event.id)}
              onCommitEdit={(title) => interaction.onCommitEdit(p.event.id, title)}
              onCancelEdit={interaction.onCancelEdit}
              onOpenNote={() => interaction.onOpenNote(p.event.id)}
              rowCapPx={effHeight ? Math.max(18, Math.floor((effHeight - 2) / trackCount)) : undefined}
              onResizeStart={(edge) => beginResize(p.event, edge)}
              onPointerDownBody={(e) => onEventPointerDown(p.event, e)}
            />
          ))}

          {/* Live draw-to-create preview (dashed block following the cursor). */}
          {previewCols && (
            <div
              className="pointer-events-none m-[2px] rounded-[3px] border border-dashed border-blue-500"
              style={{
                gridColumn: `${previewCols.start} / span ${previewCols.span}`,
                gridRow: 1,
                backgroundColor: `${fillFor(lane.color)}99`,
              }}
            />
          )}
        </div>
      </div>

      {/* Bottom-edge handle: drag to set this lane's row height; double-click resets. */}
      <div
        onPointerDown={onResizeRow}
        onDoubleClick={() => interaction.onSetLaneHeight(lane.id, 0)}
        title="Drag to resize row height · double-click to reset"
        className="absolute bottom-0 left-0 right-0 z-20 h-1.5 cursor-row-resize touch-none coarse:h-3"
      />
    </div>
  );
}
