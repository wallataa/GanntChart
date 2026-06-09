import "next-auth";
import "next-auth/jwt";

// Augment NextAuth types so the Google access token is available on the
// session and JWT for use by the /api/calendar route.
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** Epoch ms when the access token expires. */
    expiresAt?: number;
    error?: string;
  }
}
