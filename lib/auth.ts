import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getUser, kvConfigured, verifyPassword } from "./users";

/**
 * Google OAuth scopes: calendar access for the Life lane and "push to
 * calendar", plus drive.appdata so the board can sync to a hidden app folder
 * in the user's Drive (the no-database storage backend). Users who connected
 * under older, narrower scopes must sign out and back in to re-consent.
 */
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.appdata",
].join(" ");

/**
 * Refresh an expired Google access token using the stored refresh token.
 * Returns an updated token object (or one flagged with an error).
 */
async function refreshAccessToken(token: {
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: number;
}) {
  try {
    if (!token.refreshToken) throw new Error("No refresh token");
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const refreshed = await res.json();
    if (!res.ok) throw refreshed;
    return {
      ...token,
      accessToken: refreshed.access_token as string,
      expiresAt: Date.now() + (refreshed.expires_in as number) * 1000,
      // Google may not return a new refresh token; keep the old one.
      refreshToken: (refreshed.refresh_token as string) ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: GOOGLE_SCOPES,
          access_type: "offline", // request a refresh token
          prompt: "consent",
        },
      },
    }),
    // Email/password accounts (stored in Vercel KV — see lib/users.ts). These
    // sessions have no Google access token, so calendar features are
    // unavailable and the board syncs via the KV backend.
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!kvConfigured() || !credentials?.email || !credentials.password) return null;
        const user = await getUser(credentials.email);
        if (!user || !verifyPassword(credentials.password, user.passwordHash)) return null;
        return { id: user.email, email: user.email };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    async jwt({ token, account }) {
      // Initial Google sign-in: persist its tokens for the calendar APIs.
      if (account?.provider === "google") {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at
            ? account.expires_at * 1000
            : Date.now() + 3600 * 1000,
        };
      }
      // Credentials sign-in / non-Google session: nothing to refresh.
      if (account || !token.accessToken) return token;
      // Google session still valid — reuse it.
      if (token.expiresAt && Date.now() < token.expiresAt - 60_000) {
        return token;
      }
      // Expired — refresh.
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
};
