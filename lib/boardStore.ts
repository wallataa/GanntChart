import { google } from "googleapis";
import { kv } from "@vercel/kv";
import type { Session } from "next-auth";
import type { BoardBackend, StoredBoard } from "@/types";

/**
 * Server-side board persistence behind one interface, with two backends:
 *
 *  - "drive": the board lives in a hidden `appDataFolder` file in the user's
 *    own Google Drive. No infrastructure — works on any deployment where
 *    Google OAuth is configured (requires the drive.appdata scope).
 *  - "kv": the board lives in Vercel KV (Upstash Redis), keyed by the user's
 *    email. Used automatically when the KV env vars are present.
 *
 * Selection: BOARD_STORAGE=drive|kv overrides; otherwise KV is used when
 * configured, falling back to Drive.
 */

export interface BoardStore {
  backend: BoardBackend;
  load: () => Promise<StoredBoard | null>;
  save: (board: StoredBoard) => Promise<void>;
}

export function activeBackend(): BoardBackend {
  const forced = process.env.BOARD_STORAGE;
  if (forced === "drive" || forced === "kv") return forced;
  return process.env.KV_REST_API_URL ? "kv" : "drive";
}

/** Build the store for this request's user, or throw with a friendly message. */
export function boardStoreFor(session: Session): BoardStore {
  const backend = activeBackend();
  const email = session.user?.email;
  if (backend === "kv") {
    if (!email) throw new Error("No user email on session");
    return kvStore(email);
  }
  // Drive needs a Google token. Email/password sessions don't have one, so
  // they fall back to KV when it's configured.
  if (!session.accessToken) {
    if (process.env.KV_REST_API_URL && email) return kvStore(email);
    throw new Error(
      "Board sync for email accounts needs the app database (Vercel KV) configured",
    );
  }
  return driveStore(session.accessToken);
}

// ---- Vercel KV backend ----

function kvStore(email: string): BoardStore {
  const key = `board:${email}`;
  return {
    backend: "kv",
    load: async () => (await kv.get<StoredBoard>(key)) ?? null,
    save: async (board) => {
      await kv.set(key, board);
    },
  };
}

// ---- Google Drive appDataFolder backend ----

const DRIVE_FILE_NAME = "gantt-board.json";

function driveClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

function driveStore(accessToken: string): BoardStore {
  const drive = driveClient(accessToken);

  const findFileId = async (): Promise<string | null> => {
    const res = await drive.files.list({
      spaces: "appDataFolder",
      q: `name='${DRIVE_FILE_NAME}'`,
      fields: "files(id)",
      pageSize: 1,
    });
    return res.data.files?.[0]?.id ?? null;
  };

  return {
    backend: "drive",
    load: async () => {
      const fileId = await findFileId();
      if (!fileId) return null;
      const res = await drive.files.get({ fileId, alt: "media" });
      const data = res.data as unknown;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      return (parsed as StoredBoard) ?? null;
    },
    save: async (board) => {
      const media = { mimeType: "application/json", body: JSON.stringify(board) };
      const fileId = await findFileId();
      if (fileId) {
        await drive.files.update({ fileId, media });
      } else {
        await drive.files.create({
          requestBody: { name: DRIVE_FILE_NAME, parents: ["appDataFolder"] },
          media,
        });
      }
    },
  };
}

/**
 * True when a Google API error means the token lacks the drive.appdata scope
 * (a session created before the scope was added) — the user must re-connect.
 */
export function isMissingScopeError(err: unknown): boolean {
  const code = (err as { code?: number | string }).code;
  return code === 403 || code === "403";
}
