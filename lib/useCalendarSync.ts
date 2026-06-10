"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import type { CalendarApiResponse, CalendarSource, DateRange, Event } from "@/types";
import { toISODate } from "./dates";

export interface CalendarSync {
  /** GCal events for the Life lane (empty when signed out). */
  events: Event[];
  /** The user's calendar list, for the settings panel toggles. */
  calendars: CalendarSource[];
  /** Ids of the calendars currently feeding the Life lane. */
  enabledCalendarIds: string[];
  toggleCalendar: (id: string, enabled: boolean) => void;
  signedIn: boolean;
  syncing: boolean;
  error: string | null;
}

/**
 * Fetches Google Calendar events for the visible range whenever the range,
 * session, or the set of enabled calendars changes. The enabled set starts as
 * "whatever the server says" (the primary calendar) and only becomes an
 * explicit query parameter once the user toggles a calendar — so the initial
 * load is a single request. In-flight requests are aborted when superseded, so
 * rapid navigation can't apply stale responses out of order.
 */
export function useCalendarSync(range: DateRange): CalendarSync {
  const { data: session } = useSession();
  // Calendar features need a Google access token — email/password sessions
  // don't have one, so for them the Life lane stays empty (no failed fetches).
  const hasGoogle =
    Boolean(session?.accessToken) && session?.error !== "RefreshAccessTokenError";
  const [events, setEvents] = useState<Event[]>([]);
  const [calendars, setCalendars] = useState<CalendarSource[]>([]);
  // null = server defaults; a concrete list once the user has toggled.
  const [enabledOverride, setEnabledOverride] = useState<string[] | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledCalendarIds = useMemo(
    () => enabledOverride ?? calendars.filter((c) => c.enabled).map((c) => c.id),
    [enabledOverride, calendars],
  );

  useEffect(() => {
    if (!hasGoogle) {
      setEvents([]);
      return;
    }
    const controller = new AbortController();
    (async () => {
      setSyncing(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start: toISODate(range.start),
          end: toISODate(range.end),
        });
        if (enabledOverride) params.set("calendars", enabledOverride.join(","));
        const res = await fetch(`/api/calendar?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        const data = (await res.json()) as CalendarApiResponse;
        setEvents(data.events);
        setCalendars(data.calendars);
        setSyncing(false);
      } catch (err) {
        if (controller.signal.aborted) return; // superseded — newer fetch owns the state
        setError(err instanceof Error ? err.message : "Sync failed");
        setEvents([]);
        setSyncing(false);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGoogle, range, enabledOverride]);

  const toggleCalendar = (id: string, enabled: boolean) =>
    setEnabledOverride(
      enabled
        ? enabledCalendarIds.includes(id)
          ? enabledCalendarIds
          : [...enabledCalendarIds, id]
        : enabledCalendarIds.filter((c) => c !== id),
    );

  return {
    events,
    calendars,
    enabledCalendarIds,
    toggleCalendar,
    signedIn: hasGoogle,
    syncing,
    error,
  };
}
