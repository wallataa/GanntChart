"use client";

import { useState } from "react";
import type { BoardBackend, ColorName, Event, ViewMode } from "@/types";
import { COLOR_NAMES, PALETTE } from "@/lib/colors";
import type { Theme } from "@/lib/useViewSettings";
import type { BoardSyncStatus } from "@/lib/useBoardSync";
import HelpPopover from "./HelpPopover";
import {
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  MoonIcon,
  MoreIcon,
  NoteIcon,
  PlusIcon,
  RedoIcon,
  SettingsIcon,
  SunIcon,
  UndoIcon,
} from "./icons";

interface ToolbarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /** Shift the active view's window by ±1 week. */
  onNavigateWeeks: (weeks: number) => void;
  onToday: () => void;
  /** Human label for the visible window, e.g. "Jun 10 – Jul 22, 2026". */
  rangeLabel: string;
  /** Re-anchor the active view's window at the picked ISO date. */
  onJumpToDate: (iso: string) => void;

  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  fontScale: number;
  onFontScaleChange: (scale: number) => void;
  onFitRows: () => void;

  /** Weekly view only. */
  hideEmptyLanes: boolean;
  onHideEmptyLanesChange: (hide: boolean) => void;

  /** Filter completed events out of both views. */
  hideDone: boolean;
  onHideDoneChange: (hide: boolean) => void;

  /** The selected manual event, for the Done / Note / Push actions. */
  selectedEvent: Event | null;
  onToggleDone: (eventId: string) => void;
  /** Open the Notes panel for the current selection (task or lane). */
  onOpenNote: () => void;
  onPushEvent: (event: Event) => void;
  /** True while a push request is in flight. */
  pushing: boolean;
  pushError: string | null;

  /** Fill-color swatches: recolor the selection / set the default color. */
  activeColor: ColorName;
  onApplyColor: (color: ColorName) => void;
  /** What the swatches will recolor right now (null = next created event). */
  selection: "lane" | "event" | null;

  /** Google Calendar sync indicator. */
  signedIn: boolean;
  syncing: boolean;
  syncError: string | null;

  /** Account board sync indicator (hidden while signed out). */
  boardStatus: BoardSyncStatus;
  boardBackend: BoardBackend | null;
  boardError: string | null;

  theme: Theme;
  onThemeChange: (theme: Theme) => void;

  onOpenSettings: () => void;
}

const VIEW_LABELS: Record<ViewMode, string> = { main: "Timeline", weekly: "Weekly", split: "Both" };

const btn =
  "flex h-7 items-center justify-center rounded border border-neutral-300 px-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800";
const iconBtn = `${btn} w-7 px-0 text-neutral-600 dark:text-neutral-300`;

/** Color swatch circles. With a selection, the full strip shows inline on
 *  desktop; on phones (and whenever nothing is selected) it collapses to a
 *  single swatch that opens the palette in a popover. */
function ColorControl({
  activeColor,
  onApplyColor,
  selection,
}: Pick<ToolbarProps, "activeColor" | "onApplyColor" | "selection">) {
  const [open, setOpen] = useState(false);

  const swatches = (
    <div className="flex items-center gap-1.5">
      {COLOR_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => {
            onApplyColor(name);
            setOpen(false);
          }}
          title={name}
          aria-label={`Fill color ${name}`}
          className={[
            "h-5 w-5 rounded-full border transition",
            activeColor === name
              ? "ring-2 ring-neutral-800 ring-offset-1"
              : "border-black/10 hover:scale-110",
          ].join(" ")}
          style={{ backgroundColor: PALETTE[name] }}
        />
      ))}
    </div>
  );

  // Compact swatch + popover. The only color control on phones, and the
  // "next event color" picker on desktop when nothing is selected.
  const compact = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${btn} gap-1.5 text-xs text-neutral-500 dark:text-neutral-400`}
        title={selection ? "Recolor the selection" : "Color for the next event you create"}
        aria-label={selection ? "Recolor the selection" : "Choose default event color"}
        aria-expanded={open}
      >
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ backgroundColor: PALETTE[activeColor] }}
        />
        Color
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            {swatches}
          </div>
        </>
      )}
    </div>
  );

  if (selection) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="hidden text-xs font-medium text-blue-700 sm:inline dark:text-blue-400">
          {selection === "lane" ? "Lane color" : "Event color"}
        </span>
        {/* Phones: collapse the 8-swatch strip into the popover button. */}
        <div className="hidden sm:block">{swatches}</div>
        <div className="sm:hidden">{compact}</div>
      </div>
    );
  }

  return compact;
}

/** The visible-range label; click to jump the window to a picked date. */
function JumpToDate({
  rangeLabel,
  onJumpToDate,
}: Pick<ToolbarProps, "rangeLabel" | "onJumpToDate">) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-1 hidden rounded px-1.5 py-0.5 text-xs tabular-nums text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 md:inline"
        title="Jump to a date"
        aria-expanded={open}
      >
        {rangeLabel}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              Go to
              <input
                type="date"
                autoFocus
                onChange={(e) => {
                  if (!e.target.value) return;
                  onJumpToDate(e.target.value);
                  setOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                className="rounded border border-neutral-300 bg-transparent px-1.5 py-1 text-sm text-neutral-800 outline-none focus:border-blue-400 dark:border-neutral-700 dark:text-neutral-200"
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}

/** Done / Note / Push actions for the selected manual event. */
function EventActions({
  selectedEvent,
  onToggleDone,
  onOpenNote,
  onPushEvent,
  pushing,
  pushError,
  signedIn,
}: Pick<
  ToolbarProps,
  | "selectedEvent"
  | "onToggleDone"
  | "onOpenNote"
  | "onPushEvent"
  | "pushing"
  | "pushError"
  | "signedIn"
>) {
  const event = selectedEvent!;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => onToggleDone(event.id)}
        className={[
          btn,
          "gap-1 text-xs",
          event.done
            ? "border-green-600 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
            : "text-neutral-500 dark:text-neutral-400",
        ].join(" ")}
        title={event.done ? "Mark not done" : "Mark done"}
        aria-label={event.done ? "Mark not done" : "Mark done"}
      >
        <CheckIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Done</span>
      </button>

      <button
        type="button"
        onClick={onOpenNote}
        className={[
          btn,
          "gap-1 text-xs",
          event.note
            ? "text-amber-700 dark:text-amber-400"
            : "text-neutral-500 dark:text-neutral-400",
        ].join(" ")}
        title={event.note ? "Edit note" : "Add a note"}
        aria-label={event.note ? "Edit note" : "Add a note"}
      >
        <NoteIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Note</span>
      </button>

      <button
        type="button"
        onClick={() => onPushEvent(event)}
        disabled={pushing || !signedIn}
        className={[
          btn,
          "gap-1 text-xs disabled:opacity-40",
          pushError
            ? "border-red-400 text-red-600 dark:border-red-800 dark:text-red-400"
            : event.pushed
              ? "text-teal-700 dark:text-teal-400"
              : "text-neutral-500 dark:text-neutral-400",
        ].join(" ")}
        title={
          !signedIn
            ? "Connect Google Calendar first (settings)"
            : pushError
              ? `Push failed: ${pushError} — click to retry`
              : event.pushed
                ? "Update this event in your Gantt Chart calendar"
                : "Push to your Gantt Chart calendar in Google Calendar"
        }
        aria-label={event.pushed ? "Update in Google Calendar" : "Push to Google Calendar"}
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">
          {pushing ? "Pushing…" : event.pushed ? "Update" : "Push"}
        </span>
      </button>
    </div>
  );
}

/** Small-screen overflow menu for the controls hidden from the toolbar. */
function MoreMenu({
  view,
  fontScale,
  onFontScaleChange,
  onFitRows,
  hideEmptyLanes,
  onHideEmptyLanesChange,
  hideDone,
  onHideDoneChange,
  boardStatus,
  boardBackend,
  boardError,
  signedIn,
  syncing,
  syncError,
  onOpenSettings,
}: Pick<
  ToolbarProps,
  | "view"
  | "fontScale"
  | "onFontScaleChange"
  | "onFitRows"
  | "hideEmptyLanes"
  | "onHideEmptyLanesChange"
  | "hideDone"
  | "onHideDoneChange"
  | "boardStatus"
  | "boardBackend"
  | "boardError"
  | "signedIn"
  | "syncing"
  | "syncError"
  | "onOpenSettings"
>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={iconBtn}
        title="More options"
        aria-label="More options"
        aria-expanded={open}
      >
        <MoreIcon />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-56 space-y-3 rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Text size</span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onFontScaleChange(fontScale - 0.1)}
                  className={iconBtn}
                  aria-label="Smaller font"
                >
                  <MinusIcon className="h-3.5 w-3.5" />
                </button>
                <span className="w-9 text-center text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
                  {Math.round(fontScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => onFontScaleChange(fontScale + 0.1)}
                  className={iconBtn}
                  aria-label="Larger font"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>

            <button type="button" onClick={onFitRows} className={`${btn} w-full text-xs`}>
              Fit rows to content
            </button>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={hideDone}
                onChange={(e) => onHideDoneChange(e.target.checked)}
                className="h-4 w-4 cursor-pointer"
              />
              Hide done events
            </label>
            {view !== "main" && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
                <input
                  type="checkbox"
                  checked={hideEmptyLanes}
                  onChange={(e) => onHideEmptyLanesChange(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                Hide empty lanes
              </label>
            )}

            <div className="space-y-1 border-t border-neutral-200 pt-2 dark:border-neutral-700">
              <BoardStatus
                boardStatus={boardStatus}
                boardBackend={boardBackend}
                boardError={boardError}
              />
              <SyncStatus
                signedIn={signedIn}
                syncing={syncing}
                syncError={syncError}
                onOpenSettings={() => {
                  setOpen(false);
                  onOpenSettings();
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Board account-sync dot: where the board itself is saved. */
function BoardStatus({
  boardStatus,
  boardBackend,
  boardError,
}: Pick<ToolbarProps, "boardStatus" | "boardBackend" | "boardError">) {
  if (boardStatus === "local") return null;
  const where =
    boardBackend === "kv" ? "the app database" : boardBackend === "drive" ? "Google Drive" : "…";
  const [dot, label, title] =
    boardStatus === "error"
      ? ["bg-red-500", "Board sync error", boardError ?? "Board sync failed"]
      : boardStatus === "saved"
        ? ["bg-green-500", "Board saved", `Board synced to ${where}`]
        : ["animate-pulse bg-amber-400", boardStatus === "loading" ? "Loading board…" : "Saving board…", `Syncing your board with ${where}`];
  return (
    <span
      className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"
      title={title}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** Sync status dot: green = synced, amber pulse = syncing, red = error. */
function SyncStatus({
  signedIn,
  syncing,
  syncError,
  onOpenSettings,
}: Pick<ToolbarProps, "signedIn" | "syncing" | "syncError" | "onOpenSettings">) {
  if (!signedIn) {
    return (
      <button
        type="button"
        onClick={onOpenSettings}
        className={`${btn} text-xs text-neutral-500`}
        title="Connect Google Calendar to fill the Life lane"
      >
        Connect calendar
      </button>
    );
  }
  const [dot, label, title] = syncing
    ? ["animate-pulse bg-amber-400", "Syncing…", "Fetching Google Calendar events"]
    : syncError
      ? ["bg-red-500", "Sync error", syncError]
      : ["bg-green-500", "Synced", "Google Calendar is up to date"];
  return (
    <span
      className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"
      title={title}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

/** The app header: view switcher, date navigation, undo/redo, view controls,
 *  color swatches, sync status, help, and settings. */
export default function Toolbar({
  view,
  onViewChange,
  onNavigateWeeks,
  onToday,
  rangeLabel,
  onJumpToDate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  fontScale,
  onFontScaleChange,
  onFitRows,
  hideEmptyLanes,
  onHideEmptyLanesChange,
  hideDone,
  onHideDoneChange,
  activeColor,
  onApplyColor,
  selection,
  selectedEvent,
  onToggleDone,
  onOpenNote,
  onPushEvent,
  pushing,
  pushError,
  signedIn,
  syncing,
  syncError,
  boardStatus,
  boardBackend,
  boardError,
  theme,
  onThemeChange,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <header className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-2 sm:mb-3 sm:gap-x-3">
      <h1 className="hidden text-lg font-semibold tracking-tight md:block">Gantt Chart</h1>

      {/* View switcher ("Both" stacks weekly under the timeline; it needs
          vertical room, so it's hidden on small screens). */}
      <div className="flex h-7 overflow-hidden rounded border border-neutral-300 text-sm dark:border-neutral-700">
        {(["main", "weekly", "split"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={[
              "px-3",
              v === "split" ? "hidden md:block" : "",
              view === v
                ? "bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "bg-white hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-800",
            ].join(" ")}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {/* Date navigation + visible range */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onNavigateWeeks(-1)}
          className={iconBtn}
          title="Back one week"
          aria-label="Previous week"
        >
          <ChevronLeftIcon />
        </button>
        <button type="button" onClick={onToday} className={btn}>
          Today
        </button>
        <button
          type="button"
          onClick={() => onNavigateWeeks(1)}
          className={iconBtn}
          title="Forward one week"
          aria-label="Next week"
        >
          <ChevronRightIcon />
        </button>
        <JumpToDate rangeLabel={rangeLabel} onJumpToDate={onJumpToDate} />
      </div>

      {/* Undo / redo (also Ctrl+Z / Ctrl+Y). */}
      <div className="flex items-center gap-1 border-l border-neutral-200 pl-3 dark:border-neutral-800">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`${iconBtn} disabled:opacity-30`}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={`${iconBtn} disabled:opacity-30`}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          <RedoIcon />
        </button>
      </div>

      {/* View controls: font scale, fit rows, hide-empty (weekly). Column
          widths are resized by dragging column edges in the date header.
          On small screens these live in the ⋯ menu instead. */}
      <div className="hidden items-center gap-1 border-l border-neutral-200 pl-3 dark:border-neutral-800 sm:flex">
        <button
          type="button"
          onClick={() => onFontScaleChange(fontScale - 0.1)}
          className={iconBtn}
          title="Smaller text"
          aria-label="Smaller font"
        >
          <MinusIcon className="h-3.5 w-3.5" />
        </button>
        <span
          className="w-9 text-center text-xs tabular-nums text-neutral-500 dark:text-neutral-400"
          title="Grid text size"
        >
          {Math.round(fontScale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onFontScaleChange(fontScale + 0.1)}
          className={iconBtn}
          title="Larger text"
          aria-label="Larger font"
        >
          <PlusIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onFitRows}
          className={`${btn} ml-1 text-xs`}
          title="Fit rows to content (reset row heights)"
        >
          Fit rows
        </button>
        {view !== "main" && (
          <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
            <input
              type="checkbox"
              checked={hideEmptyLanes}
              onChange={(e) => onHideEmptyLanesChange(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer"
            />
            Hide empty
          </label>
        )}
        <label className="ml-1 flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => onHideDoneChange(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer"
          />
          Hide done
        </label>
      </div>

      {/* Color (contextual: recolors the selection, else sets the default).
          Wraps internally so the swatches + event actions never push the page
          wider than a phone screen (which would re-enable zoom-out). */}
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-l border-neutral-200 pl-3 dark:border-neutral-800">
        <ColorControl activeColor={activeColor} onApplyColor={onApplyColor} selection={selection} />
        {selection === "event" && selectedEvent && (
          <EventActions
            selectedEvent={selectedEvent}
            onToggleDone={onToggleDone}
            onOpenNote={onOpenNote}
            onPushEvent={onPushEvent}
            pushing={pushing}
            pushError={pushError}
            signedIn={signedIn}
          />
        )}
        {/* A selected lane gets a Note button too (opens the same panel). */}
        {selection === "lane" && (
          <button
            type="button"
            onClick={onOpenNote}
            className={`${btn} gap-1 text-xs text-neutral-500 dark:text-neutral-400`}
            title="Lane note"
            aria-label="Lane note"
          >
            <NoteIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Note</span>
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 sm:flex">
          <BoardStatus
            boardStatus={boardStatus}
            boardBackend={boardBackend}
            boardError={boardError}
          />
          <SyncStatus
            signedIn={signedIn}
            syncing={syncing}
            syncError={syncError}
            onOpenSettings={onOpenSettings}
          />
        </div>
        <button
          type="button"
          onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
          className={iconBtn}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <div className="hidden sm:block">
          <HelpPopover />
        </div>
        <MoreMenu
          view={view}
          fontScale={fontScale}
          onFontScaleChange={onFontScaleChange}
          onFitRows={onFitRows}
          hideEmptyLanes={hideEmptyLanes}
          onHideEmptyLanesChange={onHideEmptyLanesChange}
          hideDone={hideDone}
          onHideDoneChange={onHideDoneChange}
          boardStatus={boardStatus}
          boardBackend={boardBackend}
          boardError={boardError}
          signedIn={signedIn}
          syncing={syncing}
          syncError={syncError}
          onOpenSettings={onOpenSettings}
        />
        <button
          type="button"
          onClick={onOpenSettings}
          className={iconBtn}
          title="Settings"
          aria-label="Open settings"
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  );
}
