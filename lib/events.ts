import type { DateRange, Event } from "@/types";
import { placeEvent } from "./dates";

export const EVENTS_STORAGE_KEY = "gantt:events";

/** An event placed onto the grid: 1-based start column, span, and stacking row. */
export interface PlacedEvent {
  event: Event;
  colStart: number;
  span: number;
  track: number;
}

/**
 * Pack events that overlap the range into stacking tracks so they never collide,
 * laid out in chronological reading order: events are placed earliest-start
 * first (shorter span first on a tie), and each takes the topmost free track —
 * so rows read top-to-bottom / left-to-right by date, with long spans settling
 * under the point events rather than floating to the top. Shared by the main
 * view's lanes and the weekly Life band.
 */
export function packEvents(
  events: Event[],
  range: DateRange,
): { placed: PlacedEvent[]; trackCount: number } {
  const candidates = events
    .map((event) => {
      const p = placeEvent(event.start, event.end, range);
      return p ? { event, colStart: p.colStart, span: p.span } : null;
    })
    .filter((x): x is { event: Event; colStart: number; span: number } => x !== null)
    .sort((a, b) => a.colStart - b.colStart || a.span - b.span);

  // For each track, the last column it's occupied through.
  const trackEnds: number[] = [];
  const placed: PlacedEvent[] = [];
  for (const c of candidates) {
    const end = c.colStart + c.span - 1;
    // Topmost track whose previous event has already ended before this one starts.
    let track = trackEnds.findIndex((e) => e < c.colStart);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(end);
    } else {
      trackEnds[track] = end;
    }
    placed.push({ event: c.event, colStart: c.colStart + 1, span: c.span, track: track + 1 });
  }
  return { placed, trackCount: Math.max(1, trackEnds.length) };
}

/**
 * Sample manual events so the static layout is fully visible before any data
 * is entered. Dates are intentionally relative to a fixed July window to match
 * the reference screenshot; navigate to July to see them.
 */
export const SAMPLE_EVENTS: Event[] = [
  {
    id: "s1",
    laneId: "july-4th-show",
    title: "Storyboard Show",
    start: "2025-07-05",
    end: "2025-07-07",
    color: "peach",
    source: "manual",
  },
  {
    id: "s2",
    laneId: "july-4th-show",
    title: "Prelim Sound ideas",
    start: "2025-07-08",
    end: "2025-07-09",
    color: "sky",
    source: "manual",
  },
  {
    id: "s3",
    laneId: "july-4th-show",
    title: "Send Sound Ideas to Ushara",
    start: "2025-07-10",
    end: "2025-07-10",
    color: "sky",
    source: "manual",
  },
  {
    id: "s4",
    laneId: "floating-points-install",
    title: "Prep Software On Computers",
    start: "2025-07-09",
    end: "2025-07-09",
    color: "graytone",
    source: "manual",
  },
  {
    id: "s5",
    laneId: "floating-points-install",
    title: "Install",
    start: "2025-07-26",
    end: "2025-07-26",
    color: "salmon",
    source: "manual",
  },
  {
    id: "s6",
    laneId: "film-festival",
    title: "Collect finished films",
    start: "2025-07-12",
    end: "2025-07-12",
    color: "graytone",
    source: "manual",
  },
  {
    id: "s7",
    laneId: "film-festival",
    title: "Film Fest Night",
    start: "2025-07-19",
    end: "2025-07-19",
    color: "rose",
    source: "manual",
  },
  {
    id: "s8",
    laneId: "poster-for-ushara",
    title: "DUE",
    start: "2025-07-14",
    end: "2025-07-14",
    color: "salmon",
    source: "manual",
  },
];

/** Read manual events from localStorage; seed with samples on first run. */
export function loadEvents(): Event[] {
  if (typeof window === "undefined") return SAMPLE_EVENTS;
  try {
    const raw = window.localStorage.getItem(EVENTS_STORAGE_KEY);
    if (!raw) return SAMPLE_EVENTS;
    const parsed = JSON.parse(raw) as Event[];
    return Array.isArray(parsed) ? parsed : SAMPLE_EVENTS;
  } catch {
    return SAMPLE_EVENTS;
  }
}

/** Persist manual events. No-op during SSR. */
export function saveEvents(events: Event[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch {
    /* ignore */
  }
}
