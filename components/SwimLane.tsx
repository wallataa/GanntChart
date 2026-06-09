"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type {
  DateRange,
  Event,
  GridInteraction,
  ResizeEdge,
  Subtask,
  SwimLane as SwimLaneType,
} from "@/types";
import {
  columnIndex,
  daysInRange,
  fromISODate,
  isToday,
  isWeekend,
  toISODate,
} from "@/lib/dates";
import { isLifeLane } from "@/lib/lanes";
import { fillFor } from "@/lib/colors";
import { packEvents } from "@/lib/events";
import Sidebar from "./Sidebar";
import EventBlock from "./EventBlock";

interface SwimLaneProps {
  lane: SwimLaneType;
  events: Event[];
  range: DateRange;
  interaction: GridInteraction;
  columnWidth: number;
  /** All subtasks (for the per-task to-do list in the sidebar). */
  subtasks: Subtask[];
  onToggleSubtask: (subtaskId: string) => void;
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
  registerTrack,
  onEventPointerDown,
  draggingId,
  onLanePointerDown,
  laneDragging,
}: SwimLaneProps) {
  const days = daysInRange(range);
  const life = isLifeLane(lane);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Live preview while dragging an event edge to resize.
  const [drag, setDrag] = useState<{ eventId: string; edge: ResizeEdge } | null>(null);
  const [preview, setPreview] = useState<{ eventId: string; start: string; end: string } | null>(
    null,
  );
  const previewRef = useRef(preview);
  previewRef.current = preview;

  // Map a clientX pixel to a day column index within this lane's track.
  const colFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const i = Math.floor((clientX - rect.left) / columnWidth);
    return Math.max(0, Math.min(days.length - 1, i));
  };

  // Drive the resize drag via window pointer listeners.
  useEffect(() => {
    if (!drag) return;
    const ev = events.find((e) => e.id === drag.eventId);
    if (!ev) return;

    const onMove = (e: PointerEvent) => {
      const dateISO = toISODate(days[colFromX(e.clientX)]);
      if (drag.edge === "end") {
        const end = dateISO < ev.start ? ev.start : dateISO;
        setPreview({ eventId: ev.id, start: ev.start, end });
      } else {
        const start = dateISO > ev.end ? ev.end : dateISO;
        setPreview({ eventId: ev.id, start, end: ev.end });
      }
    };
    const onUp = () => {
      const p = previewRef.current;
      if (p) interaction.onResize(p.eventId, p.start, p.end);
      setDrag(null);
      setPreview(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  // Apply the live preview so the block stretches as you drag.
  const effective = preview
    ? events.map((e) =>
        e.id === preview.eventId ? { ...e, start: preview.start, end: preview.end } : e,
      )
    : events;

  const { placed, trackCount } = packEvents(effective, range);
  const columns = `repeat(${days.length}, ${columnWidth}px)`;

  // Inline "new event" input position (when typing into an empty cell here).
  const newHere =
    interaction.editing?.kind === "new" && interaction.editing.laneId === lane.id
      ? interaction.editing
      : null;
  const newCol = newHere ? columnIndex(fromISODate(newHere.date), range) + 1 : 0;

  return (
    <div
      className={[
        "flex transition-shadow",
        laneDragging ? "relative z-20 bg-white opacity-90 shadow-md" : "",
      ].join(" ")}
    >
      <Sidebar
        lane={lane}
        interaction={interaction}
        onLanePointerDown={onLanePointerDown}
        tasks={events}
        subtasks={subtasks}
        onToggleSubtask={onToggleSubtask}
      />

      {/* Track area */}
      <div
        ref={(el) => {
          trackRef.current = el;
          registerTrack(lane.id, el);
        }}
        className="relative flex-1 border-b border-neutral-200"
        style={{ minHeight: 34, backgroundColor: `${fillFor(lane.color)}24` }}
      >
        {/* Background: column borders, weekend tint, today highlight, click targets */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: columns }}>
          {days.map((d) => {
            const weekend = isWeekend(d);
            const today = isToday(d);
            const iso = toISODate(d);
            return (
              <button
                key={iso}
                type="button"
                disabled={life}
                onClick={life ? undefined : () => interaction.onStartNew(lane.id, iso)}
                className={[
                  "h-full border-l border-neutral-200",
                  weekend ? "bg-neutral-100" : "",
                  today ? "bg-blue-50/60" : "",
                  life ? "cursor-default" : "cursor-text hover:bg-blue-50",
                ].join(" ")}
                aria-label={life ? undefined : `Add event on ${iso}`}
              />
            );
          })}
        </div>

        {/* Foreground: event blocks (defines row height). pointer-events-none so
            empty space falls through to the cell buttons; children re-enable. */}
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
              editing={
                interaction.editing?.kind === "event" &&
                interaction.editing.eventId === p.event.id
              }
              dragging={draggingId === p.event.id}
              onStartEdit={() => interaction.onStartEdit(p.event.id)}
              onCommitEdit={(title) => interaction.onCommitEdit(p.event.id, title)}
              onCancelEdit={interaction.onCancelEdit}
              onResizeStart={(edge) => setDrag({ eventId: p.event.id, edge })}
              onPointerDownBody={(e) => onEventPointerDown(p.event, e)}
            />
          ))}

          {/* Inline create input */}
          {newHere && (
            <input
              key={newHere.date}
              autoFocus
              defaultValue=""
              placeholder="Type…"
              className="fs-11 pointer-events-auto z-20 m-[2px] h-[24px] rounded-[3px] border border-blue-400 bg-white px-1 outline-none"
              style={{ gridColumn: `${newCol}`, gridRow: 1, width: 150 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  interaction.onCommitNew(newHere.laneId, newHere.date, e.currentTarget.value);
                } else if (e.key === "Escape") {
                  interaction.onCancelEdit();
                }
              }}
              onBlur={(e) =>
                interaction.onCommitNew(newHere.laneId, newHere.date, e.currentTarget.value)
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
