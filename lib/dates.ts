import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
} from "date-fns";
import type { DateRange } from "@/types";

/** Width of a single date column in pixels. Keep in sync with the grid layout. */
export const COLUMN_WIDTH = 46;
/** Combined width of the two left sidebar columns (notes + lane label). */
export const SIDEBAR_NOTES_WIDTH = 196;
export const SIDEBAR_LABEL_WIDTH = 120;
export const SIDEBAR_WIDTH = SIDEBAR_NOTES_WIDTH + SIDEBAR_LABEL_WIDTH;

/** Strip the time component so date math is timezone-stable. */
export function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** ISO `YYYY-MM-DD` string for a Date (local, no timezone shift). */
export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

/** Parse an ISO `YYYY-MM-DD` string into a local Date at midnight. */
export function fromISODate(iso: string): Date {
  return toDateOnly(parseISO(iso));
}

/**
 * Default visible window for the main view: starts at **today** (today is the
 * first column) and runs ~6 months out, to the end of the month 5 months ahead.
 */
export function defaultRange(today: Date = new Date()): DateRange {
  const start = toDateOnly(today);
  const end = toDateOnly(endOfMonth(addMonths(today, 5)));
  return { start, end };
}

/** Every day in the range, inclusive of both bounds. */
export function daysInRange(range: DateRange): Date[] {
  return eachDayOfInterval({ start: range.start, end: range.end }).map(toDateOnly);
}

/** Number of day columns in the range (inclusive). */
export function columnCount(range: DateRange): number {
  return differenceInCalendarDays(range.end, range.start) + 1;
}

/**
 * Zero-based column index of `date` within `range`. Returns a value that may be
 * out of bounds (negative or >= columnCount) if the date falls outside the
 * range — callers should clamp when rendering.
 */
export function columnIndex(date: Date, range: DateRange): number {
  return differenceInCalendarDays(toDateOnly(date), range.start);
}

/** True for Saturday (6) and Sunday (0). */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** True if `date` is the same calendar day as today. */
export function isToday(date: Date, today: Date = new Date()): boolean {
  return isSameDay(toDateOnly(date), toDateOnly(today));
}

/** Shift the whole window by `weeks` (negative = earlier). */
export function shiftRange(range: DateRange, weeks: number): DateRange {
  const delta = weeks * 7;
  return {
    start: toDateOnly(addDays(range.start, delta)),
    end: toDateOnly(addDays(range.end, delta)),
  };
}

/** Day-of-week abbreviation used in the header (matches the screenshot). */
export function dayAbbrev(date: Date): string {
  // date-fns "EEE" gives Mon/Tue/Wed/Thu/Fri/Sat/Sun; the original sheet uses
  // "Mo"/"Thurs"/"Weds" etc. We map to the closest readable short form.
  const map: Record<number, string> = {
    0: "Sun",
    1: "Mon",
    2: "Tue",
    3: "Weds",
    4: "Thurs",
    5: "Fri",
    6: "Sat",
  };
  return map[date.getDay()];
}

/** Numeric day-of-month, e.g. "5". */
export function dayNumber(date: Date): string {
  return format(date, "d");
}

/**
 * Group consecutive days by month for the top header row. Returns the month
 * label plus how many columns it spans.
 */
export function monthGroups(range: DateRange): { label: string; span: number }[] {
  const groups: { label: string; span: number }[] = [];
  for (const day of daysInRange(range)) {
    const label = format(day, "MMMM yyyy");
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.span += 1;
    } else {
      groups.push({ label, span: 1 });
    }
  }
  return groups;
}

/**
 * Clamp an event's [start, end] (inclusive ISO dates) to the visible range and
 * return the grid placement, or null if it falls entirely outside the window.
 * `colStart` / `colEnd` are zero-based inclusive column indices.
 */
export function placeEvent(
  startISO: string,
  endISO: string,
  range: DateRange,
): { colStart: number; span: number } | null {
  const total = columnCount(range);
  const rawStart = columnIndex(fromISODate(startISO), range);
  const rawEnd = columnIndex(fromISODate(endISO), range);
  if (rawEnd < 0 || rawStart > total - 1) return null;
  const colStart = Math.max(0, rawStart);
  const colEnd = Math.min(total - 1, rawEnd);
  return { colStart, span: colEnd - colStart + 1 };
}

/** Two-week (14-day) window starting at `anchor` (today by default). */
export function weeklyRange(anchor: Date = new Date()): DateRange {
  const start = toDateOnly(anchor);
  return { start, end: toDateOnly(addDays(start, 13)) };
}

/** True if an ISO date falls within the inclusive range. */
export function isWithinRange(dateISO: string, range: DateRange): boolean {
  const d = fromISODate(dateISO);
  return d >= range.start && d <= range.end;
}
