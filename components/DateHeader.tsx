"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { DateRange } from "@/types";
import {
  COLUMN_WIDTH,
  SIDEBAR_LABEL_WIDTH,
  SIDEBAR_NOTES_WIDTH,
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
}

/** Three-row sticky header: month groups, day-of-week, date number. */
export default function DateHeader({
  range,
  columnWidth = COLUMN_WIDTH,
  onColumnWidthChange,
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
    const onMove = (ev: PointerEvent) => onColumnWidthChange(startW + (ev.clientX - startX));
    const onUp = () => window.removeEventListener("pointermove", onMove);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div className="sticky top-0 z-20 bg-white">
      {/* Month row */}
      <div className="flex border-b border-neutral-200">
        <div
          className="sticky left-0 z-10 shrink-0 bg-white"
          style={{ width: SIDEBAR_NOTES_WIDTH + SIDEBAR_LABEL_WIDTH }}
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
          style={{ width: SIDEBAR_NOTES_WIDTH + SIDEBAR_LABEL_WIDTH }}
        />
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
