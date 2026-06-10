import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google, type calendar_v3 } from "googleapis";
import { authOptions } from "@/lib/auth";
import { shiftISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** The dedicated calendar that holds events pushed from the app. */
const APP_CALENDAR_NAME = "Gantt Chart";

interface PushBody {
  title?: string;
  /** Inclusive ISO dates, matching the internal Event shape. */
  start?: string;
  end?: string;
  note?: string;
  /** Present when the event was pushed before — update instead of insert. */
  pushed?: { calendarId: string; eventId: string };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/calendar/push
 *
 * Pushes one app event into the user's dedicated "Gantt Chart" Google
 * Calendar (created on first push) as an all-day event. If the event was
 * pushed before, the existing calendar entry is updated; if it has since been
 * deleted on the Google side, a fresh one is created. Returns the
 * { calendarId, eventId } pair the client stores on the event.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Session expired, sign in again" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as PushBody;
  const { title, start, end, note, pushed } = body;
  if (!title || !start || !end || !ISO_DATE.test(start) || !ISO_DATE.test(end) || end < start) {
    return NextResponse.json({ error: "Invalid title/start/end" }, { status: 400 });
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  const calendar = google.calendar({ version: "v3", auth });

  // All-day events use an exclusive end date.
  const requestBody: calendar_v3.Schema$Event = {
    summary: title,
    description: note || undefined,
    start: { date: start },
    end: { date: shiftISODate(end, 1) },
  };

  try {
    // Update the previously pushed entry when it still exists.
    if (pushed?.calendarId && pushed.eventId) {
      try {
        await calendar.events.patch({
          calendarId: pushed.calendarId,
          eventId: pushed.eventId,
          requestBody,
        });
        return NextResponse.json(pushed);
      } catch (err) {
        // Calendar or event gone (deleted on the Google side) — push fresh.
        const code = (err as { code?: number }).code;
        if (code !== 404 && code !== 410) throw err;
      }
    }

    const calendarId = await findOrCreateAppCalendar(calendar);
    const inserted = await calendar.events.insert({ calendarId, requestBody });
    if (!inserted.data.id) throw new Error("Google Calendar returned no event id");
    return NextResponse.json({ calendarId, eventId: inserted.data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Calendar push failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Id of the user's "Gantt Chart" calendar, creating it on first use. */
async function findOrCreateAppCalendar(calendar: calendar_v3.Calendar): Promise<string> {
  const list = await calendar.calendarList.list({ maxResults: 250 });
  const existing = (list.data.items ?? []).find((c) => c.summary === APP_CALENDAR_NAME);
  if (existing?.id) return existing.id;
  const created = await calendar.calendars.insert({
    requestBody: { summary: APP_CALENDAR_NAME },
  });
  if (!created.data.id) throw new Error("Could not create the Gantt Chart calendar");
  return created.data.id;
}
