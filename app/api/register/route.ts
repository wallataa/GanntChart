import { NextRequest, NextResponse } from "next/server";
import { createUser, kvConfigured } from "@/lib/users";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/** POST /api/register — create an email/password account (stored in KV). */
export async function POST(req: NextRequest) {
  if (!kvConfigured()) {
    return NextResponse.json(
      { error: "Email accounts aren't enabled on this deployment (no database configured)" },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD} characters` },
      { status: 400 },
    );
  }

  try {
    const created = await createUser(email, password);
    if (!created) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
