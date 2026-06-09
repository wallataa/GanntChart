"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { Event, ResizeEdge, SwimLane } from "@/types";
import { fillFor } from "@/lib/colors";
import { fromISODate } from "@/lib/dates";
import { format } from "date-fns";

interface EventBlockProps {
  event: Event;
  lane: SwimLane;
  /** 1-based grid column to start at. */
  colStart: number;
  /** Number of columns to span. */
  span: number;
  /** 1-based stacking row within the lane. */
  track: number;
  selected: boolean;
  editing: boolean;
  /** True while this block is being moved (grid controller owns the drag). */
  dragging: boolean;
  onStartEdit: () => void;
  onCommitEdit: (title: string) => void;
  onCancelEdit: () => void;
  onResizeStart: (edge: ResizeEdge) => void;
  /** Pointer-down on the body begins a move-drag (or, if no movement, a select). */
  onPointerDownBody: (e: ReactPointerEvent) => void;
}

/**
 * A colored block spanning one or more date columns. Manual events behave like
 * spreadsheet cells: click to select, double-click to retype the label, and
 * drag either edge to span more days. GCal events are read-only.
 */
export default function EventBlock({
  event,
  lane,
  colStart,
  span,
  track,
  selected,
  editing,
  dragging,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onResizeStart,
  onPointerDownBody,
}: EventBlockProps) {
  const fill = fillFor(event.color ?? lane.color);
  const startLabel = format(fromISODate(event.start), "MMM d");
  const endLabel = format(fromISODate(event.end), "MMM d");
  const range = event.start === event.end ? startLabel : `${startLabel} – ${endLabel}`;
  const editable = event.source === "manual";

  return (
    <div
      className={[
        "group fs-10 pointer-events-auto relative m-[2px] flex items-center overflow-hidden rounded-[3px] border px-1 leading-tight text-neutral-800 select-none",
        selected ? "border-blue-500 ring-2 ring-blue-400" : "border-black/10",
        dragging ? "opacity-80 shadow-lg" : "",
        editable && !editing ? "cursor-grab active:cursor-grabbing hover:brightness-95" : "",
      ].join(" ")}
      style={{
        gridColumn: `${colStart} / span ${span}`,
        gridRow: track,
        backgroundColor: fill,
      }}
      title={editing ? undefined : `${event.title} (${range})`}
      onPointerDown={editable && !editing ? onPointerDownBody : undefined}
      onDoubleClick={editable ? onStartEdit : undefined}
    >
      {editing ? (
        <input
          autoFocus
          defaultValue={event.title}
          className="fs-10 w-full bg-transparent outline-none"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitEdit(e.currentTarget.value);
            else if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={(e) => onCommitEdit(e.currentTarget.value)}
        />
      ) : (
        <span className="truncate">{event.title}</span>
      )}

      {/* Resize handles (manual events only). Visible on hover / when selected. */}
      {editable && !editing && (
        <>
          <span
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart("start");
            }}
            className={[
              "absolute left-0 top-0 h-full w-1.5 cursor-ew-resize bg-blue-500/0",
              selected ? "bg-blue-500/30" : "group-hover:bg-blue-500/20",
            ].join(" ")}
            aria-hidden
          />
          <span
            onPointerDown={(e) => {
              e.stopPropagation();
              onResizeStart("end");
            }}
            className={[
              "absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-blue-500/0",
              selected ? "bg-blue-500/30" : "group-hover:bg-blue-500/20",
            ].join(" ")}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
