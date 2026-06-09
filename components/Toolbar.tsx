"use client";

import { useState } from "react";
import type { ColorName, ViewMode } from "@/types";
import { COLOR_NAMES, PALETTE } from "@/lib/colors";
import type { Theme } from "@/lib/useViewSettings";
import HelpPopover from "./HelpPopover";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  MoonIcon,
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

  /** Fill-color swatches: recolor the selection / set the default color. */
  activeColor: ColorName;
  onApplyColor: (color: ColorName) => void;
  /** What the swatches will recolor right now (null = next created event). */
  selection: "lane" | "event" | null;

  /** Google Calendar sync indicator. */
  signedIn: boolean;
  syncing: boolean;
  syncError: string | null;

  theme: Theme;
  onThemeChange: (theme: Theme) => void;

  onOpenSettings: () => void;
}

const VIEW_LABELS: Record<ViewMode, string> = { main: "Timeline", weekly: "Weekly" };

const btn =
  "flex h-7 items-center justify-center rounded border border-neutral-300 px-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800";
const iconBtn = `${btn} w-7 px-0 text-neutral-600 dark:text-neutral-300`;

/** Color swatch circles. Expanded when something is selected; otherwise a
 *  single compact swatch that opens the palette in a popover. */
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

  if (selection) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
          {selection === "lane" ? "Lane color" : "Event color"}
        </span>
        {swatches}
      </div>
    );
  }

  // Nothing selected: one compact swatch sets the color for the next event.
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${btn} gap-1.5 text-xs text-neutral-500 dark:text-neutral-400`}
        title="Color for the next event you create"
        aria-label="Choose default event color"
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
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  fontScale,
  onFontScaleChange,
  onFitRows,
  hideEmptyLanes,
  onHideEmptyLanesChange,
  activeColor,
  onApplyColor,
  selection,
  signedIn,
  syncing,
  syncError,
  theme,
  onThemeChange,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="text-lg font-semibold tracking-tight">Gantt Chart</h1>

      {/* View switcher */}
      <div className="flex h-7 overflow-hidden rounded border border-neutral-300 text-sm dark:border-neutral-700">
        {(["main", "weekly"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={[
              "px-3",
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
        <span className="ml-1 hidden text-xs tabular-nums text-neutral-500 dark:text-neutral-400 md:inline">
          {rangeLabel}
        </span>
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
          widths are resized by dragging column edges in the date header. */}
      <div className="flex items-center gap-1 border-l border-neutral-200 pl-3 dark:border-neutral-800">
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
          title={
            view === "main"
              ? "Fit lanes to content (reset row heights)"
              : "Fit task rows to content (reset row heights)"
          }
        >
          Fit rows
        </button>
        {view === "weekly" && (
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
      </div>

      {/* Color (contextual: recolors the selection, else sets the default). */}
      <div className="flex items-center border-l border-neutral-200 pl-3 dark:border-neutral-800">
        <ColorControl activeColor={activeColor} onApplyColor={onApplyColor} selection={selection} />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <SyncStatus
          signedIn={signedIn}
          syncing={syncing}
          syncError={syncError}
          onOpenSettings={onOpenSettings}
        />
        <button
          type="button"
          onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
          className={iconBtn}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
        <HelpPopover />
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
