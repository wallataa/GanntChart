import type { DateRange, Event } from "@/types";
import { placeEvent } from "./dates";
import { loadJSON, saveJSON } from "./storage";

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

/** Read manual events from localStorage (SSR-safe; empty on first run). */
export function loadEvents(): Event[] {
  const parsed = loadJSON<Event[] | null>(EVENTS_STORAGE_KEY, null);
  return Array.isArray(parsed) ? parsed : [];
}

/** Persist manual events. No-op during SSR. */
export function saveEvents(events: Event[]): void {
  saveJSON(EVENTS_STORAGE_KEY, events);
}
