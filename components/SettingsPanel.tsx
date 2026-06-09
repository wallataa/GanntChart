"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import type { CalendarSource, ColorName, SwimLane } from "@/types";
import LaneManager from "./LaneManager";
import { XIcon } from "./icons";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  calendars: CalendarSource[];
  /** Currently enabled calendar ids feeding the Life lane. */
  enabledCalendarIds: string[];
  onToggleCalendar: (id: string, enabled: boolean) => void;
  // Swim-lane management (Phase 3)
  lanes: SwimLane[];
  onRenameLane: (id: string, label: string) => void;
  onSetLaneColor: (id: string, color: ColorName) => void;
  onDeleteLane: (id: string) => void;
  onReorderLanes: (from: number, to: number) => void;
  onAddLane: () => void;
  /** Reset lanes to defaults and wipe all events + subtasks. */
  onClearAll: () => void;
}

/**
 * Slide-over settings panel: Google sign-in/out, toggling which calendars feed
 * the "Life" lane, and swim-lane add/rename/recolor/reorder/delete.
 */
export default function SettingsPanel({
  open,
  onClose,
  calendars,
  enabledCalendarIds,
  onToggleCalendar,
  lanes,
  onRenameLane,
  onSetLaneColor,
  onDeleteLane,
  onReorderLanes,
  onAddLane,
  onClearAll,
}: SettingsPanelProps) {
  const { data: session, status } = useSession();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="anim-fade absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <aside className="anim-slide-in absolute right-0 top-0 flex h-full w-80 flex-col bg-white shadow-xl dark:bg-neutral-900">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label="Close settings"
          >
            <XIcon />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Google account */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Google Calendar
            </h3>
            {status === "loading" ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Checking session…</p>
            ) : session ? (
              <div className="space-y-2">
                <p className="text-sm text-neutral-700 dark:text-neutral-300">
                  Signed in as{" "}
                  <span className="font-medium">{session.user?.email}</span>
                </p>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="rounded border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn("google")}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Connect Google Calendar
              </button>
            )}
          </section>

          {/* Calendar sources */}
          {session && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Calendars in “Life” lane
              </h3>
              {calendars.length === 0 ? (
                <p className="text-sm text-neutral-500 dark:text-neutral-400">No calendars loaded yet.</p>
              ) : (
                <ul className="space-y-1">
                  {calendars.map((cal) => (
                    <li key={cal.id} className="flex items-center gap-2">
                      <input
                        id={`cal-${cal.id}`}
                        type="checkbox"
                        checked={enabledCalendarIds.includes(cal.id)}
                        onChange={(e) => onToggleCalendar(cal.id, e.target.checked)}
                      />
                      <label
                        htmlFor={`cal-${cal.id}`}
                        className="flex flex-1 items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300"
                      >
                        <span
                          className="inline-block h-3 w-3 shrink-0 rounded-sm"
                          style={{ backgroundColor: cal.backgroundColor ?? "#ccc" }}
                        />
                        <span className="truncate">
                          {cal.summary}
                          {cal.primary && (
                            <span className="ml-1 text-xs text-neutral-400">(primary)</span>
                          )}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Swim-lane management */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Swim lanes
            </h3>
            <LaneManager
              lanes={lanes}
              onRename={onRenameLane}
              onSetColor={onSetLaneColor}
              onDelete={onDeleteLane}
              onReorder={onReorderLanes}
              onAdd={onAddLane}
            />
          </section>

          {/* Danger zone: wipe all user data. */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Data
            </h3>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Clear all data?\n\nThis resets swim lanes to the defaults and deletes every event and subtask. You can undo with Ctrl+Z.",
                  )
                ) {
                  onClearAll();
                }
              }}
              className="w-full rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              Clear all data
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}
