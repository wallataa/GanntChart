"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Event, ResizeEdge, SwimLane } from "@/types";
import { fillFor, textOn } from "@/lib/colors";
import { fromISODate } from "@/lib/dates";
import { differenceInCalendarDays, format } from "date-fns";
import { CalendarIcon, NoteIcon } from "./icons";

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
  /** Open this event's note editor (double-click the note badge). */
  onOpenNote: () => void;
  onResizeStart: (edge: ResizeEdge) => void;
  /** Pointer-down on the body begins a move-drag (or, if no movement, a select). */
  onPointerDownBody: (e: ReactPointerEvent) => void;
  /**
   * Per-track row height budget (px) when the lane has a fixed height.
   * Titles wrap to as many full lines as fit this budget (min 1, with an
   * ellipsis beyond). Undefined = auto-height lane, wrap freely.
   */
  rowCapPx?: number;
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
  onOpenNote,
  onResizeStart,
  onPointerDownBody,
  rowCapPx,
}: EventBlockProps) {
  // Fixed-height lanes: fit as many full lines as the per-track budget allows
  // (measured against the real line height, which scales with the font size).
  const titleRef = useRef<HTMLSpanElement>(null);
  const [maxLines, setMaxLines] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (rowCapPx == null || !titleRef.current) {
      setMaxLines(null);
      return;
    }
    const lineHeight = parseFloat(getComputedStyle(titleRef.current).lineHeight) || 13;
    // ~10px of box margins/border/padding around the text.
    setMaxLines(Math.max(1, Math.floor((rowCapPx - 10) / lineHeight)));
  }, [rowCapPx]);
  // GCal events carry their real Google color (may be dark → adjust the text).
  const fill = event.gcalColor ?? fillFor(event.color ?? lane.color);
  const textColor = event.gcalColor ? textOn(fill) : undefined;
  const startLabel = format(fromISODate(event.start), "MMM d");
  const endLabel = format(fromISODate(event.end), "MMM d");
  const duration = differenceInCalendarDays(fromISODate(event.end), fromISODate(event.start)) + 1;
  const range =
    event.start === event.end ? startLabel : `${startLabel} – ${endLabel} · ${duration}d`;
  const editable = event.source === "manual";
  const tooltip = [
    `${event.title} (${range})`,
    event.done ? "✓ done" : null,
    event.pushed ? "synced to Google Calendar" : null,
    event.note,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    // Transparent grid-cell wrapper: the colored box inside hugs its own
    // content and centers vertically, so one wrapped (tall) block in a grid
    // row doesn't stretch its neighbors into looking multiline. Clicks on the
    // empty area around a short box fall through to the track.
    <div
      className="pointer-events-none flex items-center"
      style={{ gridColumn: `${colStart} / span ${span}`, gridRow: track }}
    >
    <div
      className={[
        "group fs-10 pointer-events-auto relative m-[2px] flex min-h-[22px] w-full items-center overflow-hidden rounded border px-1 leading-tight text-neutral-800 select-none",
        selected ? "border-blue-500 shadow-sm ring-2 ring-blue-400" : "border-black/15",
        dragging ? "opacity-80 shadow-lg" : "",
        event.done && !dragging ? "opacity-50 saturate-50" : "",
        editable && !editing
          ? "cursor-grab touch-none hover:shadow-sm hover:brightness-95 active:cursor-grabbing"
          : "",
      ].join(" ")}
      style={{
        backgroundColor: fill,
        color: textColor,
      }}
      title={editing ? undefined : tooltip}
      onPointerDown={editable && !editing ? onPointerDownBody : undefined}
      onDoubleClick={editable ? onStartEdit : undefined}
    >
      {editing ? (
        <input
          autoFocus
          defaultValue={event.title}
          placeholder="Type…"
          className="fs-10 w-full bg-transparent outline-none placeholder:text-neutral-500"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onCommitEdit(e.currentTarget.value);
            else if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={(e) => onCommitEdit(e.currentTarget.value)}
        />
      ) : (
        <>
          {/* Titles wrap at word boundaries and the box grows (break-words
              only splits a word wider than the box). Fixed-height lanes clamp
              to the lines that fit their row budget, ellipsizing beyond. */}
          <span
            ref={titleRef}
            className={[
              "min-w-0 whitespace-normal break-words py-0.5",
              event.done ? "line-through" : "",
            ].join(" ")}
            style={
              maxLines != null
                ? {
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: maxLines,
                    overflow: "hidden",
                  }
                : undefined
            }
          >
            {event.title}
          </span>
          {/* Status badges: note + synced-to-calendar. Tooltip has the detail. */}
          {(event.note || event.pushed) && (
            <span className="ml-auto flex shrink-0 items-center gap-0.5 pl-1 text-neutral-700/70">
              {event.note && (
                <span
                  title="Open the note"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenNote();
                  }}
                  onDoubleClick={(e) => e.stopPropagation()}
                  className="cursor-pointer p-0.5 coarse:p-1"
                >
                  <NoteIcon className="h-2.5 w-2.5" />
                </span>
              )}
              {event.pushed && <CalendarIcon className="h-2.5 w-2.5" />}
            </span>
          )}
        </>
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
              "absolute left-0 top-0 h-full w-1.5 cursor-ew-resize touch-none bg-blue-500/0 coarse:w-3",
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
              "absolute right-0 top-0 h-full w-1.5 cursor-ew-resize touch-none bg-blue-500/0 coarse:w-3",
              selected ? "bg-blue-500/30" : "group-hover:bg-blue-500/20",
            ].join(" ")}
            aria-hidden
          />
        </>
      )}
    </div>
    </div>
  );
}
