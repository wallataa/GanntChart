"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarSource, Event } from "@/types";
import { LIFE_LANE_ID } from "./lanes";

/** How long a calendar deletion stays undoable. */
const UNDO_WINDOW_MS = 10_000;

export interface LifeEventOps {
  /** Draw-to-create in the Life lane: insert into the primary calendar and
   *  drop straight into title editing. */
  create: (startISO: string, endISO: string) => void;
  /** Move / resize: update the event's dates in Google Calendar. */
  reschedule: (id: string, startISO: string, endISO: string) => void;
  /** Rename (empty title deletes, matching manual-event semantics). */
  rename: (id: string, title: string) => void;
  remove: (id: string) => void;
  /** The most recent deletion, while still inside the undo window. */
  lastDeleted: Event | null;
  /** Restore the most recent deletion (Google revives the same event).
   *  Returns false when there's nothing to restore. */
  restore: () => boolean;
}

/** Split a Life-lane id (`gcal:<calendarId>:<eventId>`) into its API parts. */
function parseId(id: string): { calendarId: string; eventId: string } | null {
  const m = /^gcal:([^:]+):(.+)$/.exec(id);
  return m ? { calendarId: m[1], eventId: m[2] } : null;
}

async function call(method: "POST" | "PATCH" | "DELETE", body: unknown): Promise<unknown> {
  const res = await fetch("/api/calendar/event", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Calendar update failed (${res.status})`);
  return data;
}

/**
 * Editing for the Life lane's Google Calendar events. Mutations apply
 * optimistically to the local copy (via the sync hook's applyLocal) and write
 * through to Google; failures surface in the sync indicator and trigger a
 * refresh so the lane snaps back to the calendar's truth.
 */
export function useLifeEvents(opts: {
  calendars: CalendarSource[];
  /** Current GCal events (to stash a copy of what a delete removes). */
  events: Event[];
  applyLocal: (updater: (events: Event[]) => Event[]) => void;
  refresh: () => void;
  reportError: (message: string) => void;
  /** Called with the new event's id after a create (to open title editing). */
  onCreated: (id: string) => void;
}): LifeEventOps {
  const { calendars, events, applyLocal, refresh, reportError, onCreated } = opts;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  // The most recent deletion, undoable for a short window (Google keeps the
  // cancelled event restorable; we only offer it briefly to keep undo sane).
  const [lastDeleted, setLastDeleted] = useState<Event | null>(null);
  useEffect(() => {
    if (!lastDeleted) return;
    const timer = setTimeout(() => setLastDeleted(null), UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [lastDeleted]);

  const fail = (err: unknown, fallback: string) => {
    reportError(err instanceof Error ? err.message : fallback);
    refresh(); // snap back to Google's truth
  };

  const create = async (startISO: string, endISO: string) => {
    const primary = calendars.find((c) => c.primary) ?? calendars[0];
    const calendarId = primary?.id ?? "primary";
    const title = "New event";
    try {
      const data = (await call("POST", { title, start: startISO, end: endISO, calendarId })) as {
        calendarId: string;
        eventId: string;
      };
      const id = `gcal:${data.calendarId}:${data.eventId}`;
      applyLocal((events) => [
        ...events,
        {
          id,
          laneId: LIFE_LANE_ID,
          title,
          start: startISO,
          end: endISO,
          source: "gcal",
          gcalId: data.eventId,
          gcalColor: primary?.backgroundColor,
        },
      ]);
      onCreated(id);
    } catch (err) {
      fail(err, "Event create failed");
    }
  };

  const reschedule = async (id: string, startISO: string, endISO: string) => {
    const parts = parseId(id);
    if (!parts) return;
    applyLocal((events) =>
      events.map((e) => (e.id === id ? { ...e, start: startISO, end: endISO } : e)),
    );
    try {
      await call("PATCH", { ...parts, start: startISO, end: endISO });
    } catch (err) {
      fail(err, "Event update failed");
    }
  };

  const rename = async (id: string, title: string) => {
    const parts = parseId(id);
    if (!parts) return;
    const name = title.trim();
    if (!name) return remove(id);
    applyLocal((events) => events.map((e) => (e.id === id ? { ...e, title: name } : e)));
    try {
      await call("PATCH", { ...parts, title: name });
    } catch (err) {
      fail(err, "Event rename failed");
    }
  };

  const remove = async (id: string) => {
    const parts = parseId(id);
    if (!parts) return;
    const deleted = eventsRef.current.find((e) => e.id === id) ?? null;
    applyLocal((events) => events.filter((e) => e.id !== id));
    try {
      await call("DELETE", parts);
      if (deleted) setLastDeleted(deleted);
    } catch (err) {
      fail(err, "Event delete failed");
    }
  };

  const restore = (): boolean => {
    const deleted = lastDeleted;
    if (!deleted) return false;
    const parts = parseId(deleted.id);
    if (!parts) return false;
    setLastDeleted(null);
    applyLocal((events) =>
      events.some((e) => e.id === deleted.id) ? events : [...events, deleted],
    );
    // Google revives the cancelled event in place (same id, all fields).
    call("PATCH", { ...parts, status: "confirmed" }).catch((err) =>
      fail(err, "Event restore failed"),
    );
    return true;
  };

  return { create, reschedule, rename, remove, lastDeleted, restore };
}
