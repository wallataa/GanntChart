"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type Mode = "signin" | "register";

/**
 * Sign-in page (also NextAuth's configured signIn page): email/password with
 * an inline create-account mode, plus Google sign-in for calendar features.
 */
export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Registration failed (${res.status})`);
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) throw new Error("Invalid email or password");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "w-full rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-neutral-700";

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <h1 className="text-lg font-semibold tracking-tight">Gantt Chart</h1>
        <p className="mb-5 mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          {mode === "signin"
            ? "Sign in to sync your board across devices."
            : "Create an account to sync your board across devices."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={input}
          />
          <input
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 8 : 1}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            placeholder={mode === "register" ? "Password (8+ characters)" : "Password"}
            className={input}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-neutral-800 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "register" : "signin"));
            setError(null);
          }}
          className="mt-3 text-xs text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
        >
          {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-neutral-400 dark:text-neutral-500">
          <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
          or
          <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-700" />
        </div>

        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Continue with Google
        </button>
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
          Google sign-in also enables the calendar features (Life lane, push).
        </p>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 text-xs text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400"
        >
          ← Skip — use without an account (saved in this browser only)
        </button>
      </div>
    </main>
  );
}
