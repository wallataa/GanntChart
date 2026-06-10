"use client";

import { useState } from "react";
import type { Event } from "@/types";

export interface CalendarPush {
  /** Push (or re-push to update) an event. No-op while a push is in flight.
   *  `laneLabel` is included in the calendar event's title. */
  pushEvent: (event: Event, laneLabel?: string) => void;
  /** Id of the event currently being pushed, if any. */
  pushingId: string | null;
  /** Last push failure, cleared on the next attempt. */
  pushError: string | null;
}

/**
 * Pushes app events into the user's dedicated "Gantt Chart" Google Calendar
 * via POST /api/calendar/push. On success, `onPushed` records the returned
 * { calendarId, eventId } on the event so later pushes update in place and the
 * block can show its synced badge.
 */
export function useCalendarPush(
  onPushed: (eventId: string, pushed: { calendarId: string; eventId: string }) => void,
): CalendarPush {
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  const pushEvent = async (event: Event, laneLabel?: string) => {
    if (pushingId) return;
    setPushingId(event.id);
    setPushError(null);
    try {
      const res = await fetch("/api/calendar/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          lane: laneLabel || undefined,
          start: event.start,
          end: event.end,
          note: event.note,
          pushed: event.pushed,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        calendarId?: string;
        eventId?: string;
        error?: string;
      };
      if (!res.ok || !data.calendarId || !data.eventId) {
        throw new Error(data.error ?? `Push failed (${res.status})`);
      }
      onPushed(event.id, { calendarId: data.calendarId, eventId: data.eventId });
    } catch (err) {
      setPushError(err instanceof Error ? err.message : "Push failed");
    } finally {
      setPushingId(null);
    }
  };

  return { pushEvent, pushingId, pushError };
}
