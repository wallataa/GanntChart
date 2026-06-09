"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { DateRange } from "@/types";
import { startDrag } from "@/lib/drag";
import {
  COLUMN_WIDTH,
  dayAbbrev,
  dayNumber,
  daysInRange,
  isToday,
  isWeekend,
  monthGroups,
  toISODate,
} from "@/lib/dates";

interface DateHeaderProps {
  range: DateRange;
  columnWidth?: number;
  /** Resize the (shared) day-column width by dragging a column edge. */
  onColumnWidthChange?: (width: number) => void;
  /** Current left-column widths + handler to resize them by dragging edges. */
  sidebarNotesWidth?: number;
  sidebarLabelWidth?: number;
  onResizeSidebar?: (part: "notes" | "label", width: number) => void;
}

/** The sidebar width comes from the `--sb-w` CSS var (set on the grid wrapper). */
const SIDEBAR_VAR = "var(--sb-w, 316px)";

/** Three-row sticky header: month groups, day-of-week, date number. */
export default function DateHeader({
  range,
  columnWidth = COLUMN_WIDTH,
  onColumnWidthChange,
  sidebarNotesWidth = 0,
  sidebarLabelWidth = 0,
  onResizeSidebar,
}: DateHeaderProps) {
  const days = daysInRange(range);
  const groups = monthGroups(range);

  // Drag a column's right edge to resize all day columns uniformly. The new
  // width is the starting width plus however far the cursor has moved.
  const startResize = (e: ReactPointerEvent) => {
    if (!onColumnWidthChange || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = columnWidth;
    startDrag(e, { onMove: (ev) => onColumnWidthChange(startW + (ev.clientX - startX)) });
  };

  // Drag a sidebar column's right edge to resize that left column.
  const startSidebarResize = (part: "notes" | "label") => (e: ReactPointerEvent) => {
    if (!onResizeSidebar || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = part === "notes" ? sidebarNotesWidth : sidebarLabelWidth;
    startDrag(e, { onMove: (ev) => onResizeSidebar(part, startW + (ev.clientX - startX)) });
  };

  return (
    <div className="sticky top-0 z-20 bg-white">
      {/* Month row */}
      <div className="flex border-b border-neutral-200">
        <div
          className="sticky left-0 z-10 shrink-0 bg-white"
          style={{ width: SIDEBAR_VAR }}
        />
        {groups.map((g) => (
          <div
            key={g.label}
            className="fs-12 shrink-0 border-l border-neutral-200 px-2 py-1 font-semibold text-neutral-600"
            style={{ width: g.span * columnWidth }}
          >
            {g.label}
          </div>
        ))}
      </div>

      {/* Day-of-week + date number rows */}
      <div className="flex border-b border-neutral-300">
        <div
          className="sticky left-0 z-10 shrink-0 bg-white"
          style={{ width: SIDEBAR_VAR }}
        >
          {/* Drag the left columns' edges to resize them. */}
          {onResizeSidebar && (
            <>
              <div
                onPointerDown={startSidebarResize("notes")}
                title="Drag to resize the notes column"
                className="absolute top-0 z-30 h-full w-[6px] cursor-col-resize hover:bg-blue-400/40"
                style={{ left: "calc(var(--sb-notes, 196px) - 3px)" }}
              />
              <div
                onPointerDown={startSidebarResize("label")}
                title="Drag to resize the label column"
                className="absolute -right-[3px] top-0 z-30 h-full w-[6px] cursor-col-resize hover:bg-blue-400/40"
              />
            </>
          )}
        </div>
        {days.map((d) => {
          const weekend = isWeekend(d);
          const today = isToday(d);
          return (
            <div
              key={toISODate(d)}
              className={[
                "relative shrink-0 border-l border-neutral-200 text-center",
                weekend ? "bg-neutral-100" : "bg-white",
                today ? "ring-2 ring-inset ring-blue-400" : "",
              ].join(" ")}
              style={{ width: columnWidth }}
            >
              <div className="fs-10 pt-1 font-medium text-neutral-500">{dayAbbrev(d)}</div>
              <div
                className={[
                  "fs-12 pb-1",
                  today ? "font-bold text-blue-600" : "text-neutral-700",
                ].join(" ")}
              >
                {dayNumber(d)}
              </div>
              {/* Drag the right edge to resize all columns. */}
              {onColumnWidthChange && (
                <div
                  onPointerDown={startResize}
                  title="Drag to resize columns"
                  className="absolute -right-[3px] top-0 z-30 h-full w-[6px] cursor-col-resize hover:bg-blue-400/40"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
