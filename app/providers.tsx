"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/** Wraps the app in a NextAuth SessionProvider so client components can use useSession(). */
export default function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
