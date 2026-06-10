"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { BoardApiResponse, BoardBackend, BoardDoc } from "@/types";

const UPDATED_AT_KEY = "gantt:updatedAt";
/** How long after the last change before the board is pushed. */
const SAVE_DEBOUNCE_MS = 1500;

export type BoardSyncStatus =
  | "local" // signed out — localStorage only
  | "loading" // fetching the stored board after sign-in
  | "saving" // a push is pending / in flight
  | "saved" // remote copy matches the local board
  | "error";

export interface BoardSync {
  status: BoardSyncStatus;
  /** Which storage backend the server is using (known after first load). */
  backend: BoardBackend | null;
  /** Last sync failure, if status === "error". */
  error: string | null;
}

/** Epoch ms of the last local change (0 when never stamped). */
function localUpdatedAt(): number {
  try {
    return Number(window.localStorage.getItem(UPDATED_AT_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function stampLocal(ms: number) {
  try {
    window.localStorage.setItem(UPDATED_AT_KEY, String(ms));
  } catch {
    /* ignore */
  }
}

/**
 * Syncs the board document to account storage (GET/PUT /api/board) while the
 * user is signed in; signed out, the app stays localStorage-only.
 *
 * On sign-in the local and stored boards are reconciled last-write-wins by
 * timestamp: a newer stored copy replaces the local board (via `replaceDoc`),
 * otherwise the local board is pushed up. After that, every local change is
 * debounce-pushed. Incoming replacements are recognized by content equality
 * so they don't echo back as saves.
 */
export function useBoardSync(doc: BoardDoc, replaceDoc: (doc: BoardDoc) => void): BoardSync {
  const { data: session } = useSession();
  const signedIn = Boolean(session) && session?.error !== "RefreshAccessTokenError";

  const [status, setStatus] = useState<BoardSyncStatus>("local");
  const [backend, setBackend] = useState<BoardBackend | null>(null);
  const [error, setError] = useState<string | null>(null);

  // JSON of the doc as last seen by the server (sent or received).
  const lastSyncedRef = useRef<string | null>(null);
  // True once the initial sign-in reconciliation finished.
  const reconciledRef = useRef(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const replaceRef = useRef(replaceDoc);
  replaceRef.current = replaceDoc;

  const putBoard = async (json: string, updatedAt: number) => {
    const res = await fetch("/api/board", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: `{"updatedAt":${updatedAt},"doc":${json}}`,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Save failed (${res.status})`);
    }
  };

  // Initial reconciliation when the session appears (or goes away).
  useEffect(() => {
    if (!signedIn) {
      reconciledRef.current = false;
      lastSyncedRef.current = null;
      setStatus("local");
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setStatus("loading");
      setError(null);
      try {
        const res = await fetch("/api/board");
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Load failed (${res.status})`);
        }
        const data = (await res.json()) as BoardApiResponse;
        if (cancelled) return;
        setBackend(data.backend);

        if (data.board && data.board.updatedAt > localUpdatedAt()) {
          // Stored copy is newer — adopt it locally.
          lastSyncedRef.current = JSON.stringify(data.board.doc);
          replaceRef.current(data.board.doc);
          stampLocal(data.board.updatedAt);
        } else {
          // Local is newer (or nothing stored yet) — push it up.
          const json = JSON.stringify(docRef.current);
          const now = Date.now();
          await putBoard(json, now);
          if (cancelled) return;
          lastSyncedRef.current = json;
          stampLocal(now);
        }
        reconciledRef.current = true;
        setStatus("saved");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setError(err instanceof Error ? err.message : "Sync failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  // Debounce-push local changes after the initial reconciliation.
  useEffect(() => {
    if (!signedIn || !reconciledRef.current) return;
    const json = JSON.stringify(doc);
    if (json === lastSyncedRef.current) return; // incoming replace / already saved
    stampLocal(Date.now());
    setStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const now = Date.now();
        await putBoard(json, now);
        lastSyncedRef.current = json;
        stampLocal(now);
        setStatus("saved");
        setError(null);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Save failed");
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [doc, signedIn]);

  return { status, backend, error };
}
