import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { google, type calendar_v3 } from "googleapis";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { shiftISODate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mutations for Google Calendar events shown in the Life lane (all-day,
 * inclusive ISO dates — converted to GCal's exclusive end internally):
 *
 *  POST   { title, start, end, calendarId? }      → create (default: primary)
 *  PATCH  { calendarId, eventId, title?, start?, end? } → update fields
 *  DELETE { calendarId, eventId }                 → delete
 */

function client(session: Session) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });
  return google.calendar({ version: "v3", auth });
}

async function authed() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken || session.error === "RefreshAccessTokenError") return null;
  return session;
}

const fail = (err: unknown, fallback: string) =>
  NextResponse.json(
    { error: err instanceof Error ? err.message : fallback },
    { status: 500 },
  );

export async function POST(req: NextRequest) {
  const session = await authed();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    start?: string;
    end?: string;
    calendarId?: string;
  };
  const { title, start, end } = body;
  if (!title || !start || !end || !ISO_DATE.test(start) || !ISO_DATE.test(end) || end < start) {
    return NextResponse.json({ error: "Invalid title/start/end" }, { status: 400 });
  }
  const calendarId = body.calendarId || "primary";

  try {
    const res = await client(session).events.insert({
      calendarId,
      requestBody: {
        summary: title,
        start: { date: start },
        end: { date: shiftISODate(end, 1) },
      },
    });
    if (!res.data.id) throw new Error("Google Calendar returned no event id");
    return NextResponse.json({ calendarId, eventId: res.data.id });
  } catch (err) {
    return fail(err, "Event create failed");
  }
}

export async function PATCH(req: NextRequest) {
  const session = await authed();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    calendarId?: string;
    eventId?: string;
    title?: string;
    start?: string;
    end?: string;
    status?: string;
  };
  const { calendarId, eventId, title, start, end, status } = body;
  if (!calendarId || !eventId) {
    return NextResponse.json({ error: "Missing calendarId/eventId" }, { status: 400 });
  }
  if ((start && !ISO_DATE.test(start)) || (end && !ISO_DATE.test(end))) {
    return NextResponse.json({ error: "Invalid start/end" }, { status: 400 });
  }
  if (status !== undefined && status !== "confirmed") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const requestBody: calendar_v3.Schema$Event = {};
  if (title !== undefined) requestBody.summary = title;
  // "confirmed" restores a just-deleted (cancelled) event in place — this is
  // what makes calendar deletion undoable.
  if (status) requestBody.status = status;

  try {
    const cal = client(session);
    if (start || end) {
      // Date changes must respect the event's kind: patching `date` onto a
      // TIMED event merges into {date + dateTime} and Google rejects it (the
      // grid edit then looked like it "reverted"). Read the event and either
      // move the all-day dates, or keep a timed event's clock time/zone and
      // move only its calendar date.
      const existing = (await cal.events.get({ calendarId, eventId })).data;
      if (existing.start?.date) {
        if (start) requestBody.start = { date: start };
        if (end) requestBody.end = { date: shiftISODate(end, 1) };
      } else {
        const onDate = (
          orig: calendar_v3.Schema$EventDateTime | undefined,
          newDate: string,
        ): calendar_v3.Schema$EventDateTime => ({
          // RFC3339 "2026-06-14T19:00:00+01:00" → keep "T19:00:00+01:00".
          dateTime: `${newDate}${(orig?.dateTime ?? "T00:00:00Z").slice(10)}`,
          timeZone: orig?.timeZone ?? undefined,
        });
        if (start) requestBody.start = onDate(existing.start ?? undefined, start);
        if (end) requestBody.end = onDate(existing.end ?? undefined, end);
      }
    }
    await cal.events.patch({ calendarId, eventId, requestBody });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Event update failed");
  }
}

export async function DELETE(req: NextRequest) {
  const session = await authed();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    calendarId?: string;
    eventId?: string;
  };
  const { calendarId, eventId } = body;
  if (!calendarId || !eventId) {
    return NextResponse.json({ error: "Missing calendarId/eventId" }, { status: 400 });
  }

  try {
    await client(session).events.delete({ calendarId, eventId });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err, "Event delete failed");
  }
}
