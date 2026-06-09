import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";
import { LIFE_LANE_ID } from "@/lib/lanes";
import type { CalendarApiResponse, CalendarSource, Event } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD&calendars=id1,id2
 *
 * Fetches Google Calendar events for the visible range and maps them to the
 * internal Event type for the "Life" swim lane. Also returns the user's
 * calendar list so the settings panel can let them toggle sources.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Session expired, sign in again" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }
  const requested = searchParams.get("calendars");
  const requestedIds = requested ? requested.split(",").filter(Boolean) : null;

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  // timeMin inclusive at local midnight; timeMax exclusive at end-of-window +1 day.
  const timeMin = new Date(`${start}T00:00:00`).toISOString();
  const timeMax = new Date(`${end}T23:59:59`).toISOString();

  try {
    // 1. List calendars so the UI can offer toggles.
    const listRes = await calendar.calendarList.list({ maxResults: 250 });
    const calendars: CalendarSource[] = (listRes.data.items ?? []).map((c) => ({
      id: c.id ?? "",
      summary: c.summary ?? c.id ?? "Untitled",
      primary: Boolean(c.primary),
      backgroundColor: c.backgroundColor ?? undefined,
      // Default: only the primary calendar feeds the Life lane unless the
      // client explicitly requested a set.
      enabled: requestedIds
        ? requestedIds.includes(c.id ?? "")
        : Boolean(c.primary),
    }));

    const sourceIds = calendars.filter((c) => c.enabled).map((c) => c.id);

    // 2. Fetch events from each enabled calendar in parallel.
    const perCalendar = await Promise.all(
      sourceIds.map(async (calId) => {
        const res = await calendar.events.list({
          calendarId: calId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 2500,
        });
        return (res.data.items ?? []).map((item) => mapGcalEvent(item, calId));
      }),
    );

    const events: Event[] = perCalendar.flat().filter((e): e is Event => e !== null);

    const body: CalendarApiResponse = { events, calendars };
    return NextResponse.json(body);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calendar fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Map a Google Calendar event into our Event type, or null if unusable. */
function mapGcalEvent(
  item: {
    id?: string | null;
    summary?: string | null;
    start?: { date?: string | null; dateTime?: string | null } | null;
    end?: { date?: string | null; dateTime?: string | null } | null;
  },
  calId: string,
): Event | null {
  if (!item.id || (!item.start?.date && !item.start?.dateTime)) return null;

  const startISO = isoDate(item.start?.date, item.start?.dateTime);
  // All-day events have an exclusive end date — subtract one day so the block
  // ends on the last occupied day (SPEC.md).
  const endISO = item.end?.date
    ? minusOneDay(item.end.date)
    : isoDate(item.end?.date, item.end?.dateTime) ?? startISO;

  if (!startISO) return null;

  return {
    id: `gcal:${calId}:${item.id}`,
    laneId: LIFE_LANE_ID,
    title: item.summary ?? "(busy)",
    start: startISO,
    end: endISO ?? startISO,
    source: "gcal",
    gcalId: item.id,
  };
}

/** Extract a YYYY-MM-DD date from an all-day `date` or timed `dateTime`. */
function isoDate(
  date?: string | null,
  dateTime?: string | null,
): string | null {
  if (date) return date;
  if (dateTime) return dateTime.slice(0, 10);
  return null;
}

function minusOneDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
