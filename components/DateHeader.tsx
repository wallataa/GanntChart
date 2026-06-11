"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { DateRange } from "@/types";
import { startDrag } from "@/lib/drag";
import {
  COLUMN_WIDTH,
  dayAbbrev,
  dayNumber,
  daysInRange,
  isMonthStart,
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
    <div className="sticky top-0 z-20 bg-white dark:bg-neutral-950">
      {/* Month row */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        <div
          className="sticky left-0 z-10 shrink-0 bg-white dark:bg-neutral-950"
          style={{ width: SIDEBAR_VAR }}
        />
        {groups.map((g) => (
          <div
            key={g.label}
            className="fs-12 shrink-0 border-l border-neutral-200 px-2 py-1 font-semibold text-neutral-600 dark:border-neutral-800 dark:text-neutral-300"
            style={{ width: g.span * columnWidth }}
          >
            {g.label}
          </div>
        ))}
      </div>

      {/* Day-of-week + date number rows */}
      <div className="flex border-b border-neutral-300 dark:border-neutral-700">
        <div
          className="sticky left-0 z-10 shrink-0 bg-white dark:bg-neutral-950"
          style={{ width: SIDEBAR_VAR }}
        >
          {/* Drag the left columns' edges to resize them. The label column is
              leftmost (matching both views), so its edge sits at --sb-label;
              the notes column ends at the sidebar's right edge. */}
          {onResizeSidebar && (
            <>
              <div
                onPointerDown={startSidebarResize("label")}
                title="Drag to resize the label column"
                className={[
                  "absolute top-0 z-30 h-full w-[6px] cursor-col-resize touch-none hover:bg-blue-400/40 coarse:w-3",
                  sidebarNotesWidth > 0 ? "" : "-right-[3px]",
                ].join(" ")}
                style={
                  sidebarNotesWidth > 0
                    ? { left: "calc(var(--sb-label, 120px) - 3px)" }
                    : undefined
                }
              />
              {sidebarNotesWidth > 0 && (
                <div
                  onPointerDown={startSidebarResize("notes")}
                  title="Drag to resize the notes column"
                  className="absolute -right-[3px] top-0 z-30 h-full w-[6px] cursor-col-resize touch-none hover:bg-blue-400/40 coarse:w-3"
                />
              )}
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
                "relative shrink-0 border-l text-center",
                isMonthStart(d)
                  ? "border-neutral-400 dark:border-neutral-500"
                  : "border-neutral-200 dark:border-neutral-800",
                weekend ? "bg-neutral-100 dark:bg-neutral-900" : "bg-white dark:bg-neutral-950",
              ].join(" ")}
              style={{ width: columnWidth }}
            >
              <div
                className={[
                  "fs-10 pt-1 font-medium",
                  today
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-neutral-500 dark:text-neutral-400",
                ].join(" ")}
              >
                {dayAbbrev(d)}
              </div>
              {/* Today gets a filled pill so it anchors the whole grid. */}
              <div className="fs-12 pb-1">
                <span
                  className={
                    today
                      ? "inline-block min-w-[1.6em] rounded-full bg-blue-600 px-1 font-bold leading-snug text-white"
                      : "text-neutral-700 dark:text-neutral-300"
                  }
                >
                  {dayNumber(d)}
                </span>
              </div>
              {/* Drag the right edge to resize all columns. */}
              {onColumnWidthChange && (
                <div
                  onPointerDown={startResize}
                  title="Drag to resize columns"
                  className="absolute -right-[3px] top-0 z-30 h-full w-[6px] cursor-col-resize touch-none hover:bg-blue-400/40 coarse:w-3"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
