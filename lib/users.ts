import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { kv } from "@vercel/kv";

/**
 * Email/password accounts, stored in Vercel KV (`user:<email>`). Passwords are
 * hashed with Node's built-in scrypt (salt:hash hex), so there are no native
 * or third-party crypto dependencies. Requires the KV store to be configured —
 * Google sign-in keeps working without it.
 */

export interface StoredUser {
  email: string;
  passwordHash: string;
  createdAt: number;
}

export function kvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

const userKey = (email: string) => `user:${email.toLowerCase()}`;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

export async function getUser(email: string): Promise<StoredUser | null> {
  return (await kv.get<StoredUser>(userKey(email))) ?? null;
}

/** Create an account. Returns false if the email is already registered. */
export async function createUser(email: string, password: string): Promise<boolean> {
  const user: StoredUser = {
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    createdAt: Date.now(),
  };
  // NX = only set if absent, so concurrent registrations can't overwrite.
  const result = await kv.set(userKey(email), user, { nx: true });
  return result === "OK";
}
