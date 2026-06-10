import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { boardStoreFor, isMissingScopeError } from "@/lib/boardStore";
import type { BoardApiResponse, StoredBoard } from "@/types";

export const dynamic = "force-dynamic";

/** Hard cap on stored board size (the doc is normally a few KB). */
const MAX_BYTES = 1_000_000;

const RECONNECT_HINT =
  "Google Drive access missing — sign out and back in to grant the new permission";

/** GET /api/board — the signed-in user's stored board (null on first use). */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const store = boardStoreFor(session);
    const board = await store.load();
    const body: BoardApiResponse = { board, backend: store.backend };
    return NextResponse.json(body);
  } catch (err) {
    if (isMissingScopeError(err)) {
      return NextResponse.json({ error: RECONNECT_HINT }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Board load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT /api/board — replace the signed-in user's stored board. */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.error === "RefreshAccessTokenError") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BYTES) {
    return NextResponse.json({ error: "Board too large" }, { status: 413 });
  }
  let board: StoredBoard;
  try {
    board = JSON.parse(raw) as StoredBoard;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (
    typeof board?.updatedAt !== "number" ||
    !Array.isArray(board.doc?.lanes) ||
    !Array.isArray(board.doc?.events) ||
    !Array.isArray(board.doc?.subtasks)
  ) {
    return NextResponse.json({ error: "Invalid board shape" }, { status: 400 });
  }

  try {
    const store = boardStoreFor(session);
    await store.save(board);
    return NextResponse.json({ ok: true, backend: store.backend });
  } catch (err) {
    if (isMissingScopeError(err)) {
      return NextResponse.json({ error: RECONNECT_HINT }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Board save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
