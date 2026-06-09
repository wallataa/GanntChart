"use client";

import type { ColorName, ViewMode } from "@/types";
import { COLOR_NAMES, PALETTE } from "@/lib/colors";

interface ToolbarProps {
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  /** Shift the active view's window by ±1 week. */
  onNavigateWeeks: (weeks: number) => void;
  onToday: () => void;

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
  /** True when a lane is selected (the swatches recolor it, not an event). */
  laneSelected: boolean;

  /** Google Calendar sync indicator. */
  signedIn: boolean;
  syncing: boolean;
  syncError: string | null;

  onOpenSettings: () => void;
}

const buttonClass = "rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50";

/** The app header: view toggle, date navigation, undo/redo, view controls,
 *  fill-color swatches, sync indicator, and the settings button. */
export default function Toolbar({
  view,
  onViewChange,
  onNavigateWeeks,
  onToday,
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
  laneSelected,
  signedIn,
  syncing,
  syncError,
  onOpenSettings,
}: ToolbarProps) {
  return (
    <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="text-lg font-semibold">Gantt Chart</h1>

      {/* View toggle */}
      <div className="flex overflow-hidden rounded border border-neutral-300 text-sm">
        {(["main", "weekly"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={[
              "px-3 py-1 capitalize",
              view === v ? "bg-neutral-800 text-white" : "bg-white hover:bg-neutral-50",
            ].join(" ")}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onNavigateWeeks(-1)}
          className={buttonClass}
          aria-label="Previous week"
        >
          ‹
        </button>
        <button type="button" onClick={onToday} className={buttonClass}>
          Today
        </button>
        <button
          type="button"
          onClick={() => onNavigateWeeks(1)}
          className={buttonClass}
          aria-label="Next week"
        >
          ›
        </button>
      </div>

      {/* Undo / redo (also Ctrl+Z / Ctrl+Y). */}
      <div className="flex items-center gap-1 border-l border-neutral-200 pl-3">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`${buttonClass} disabled:opacity-30`}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          ↶
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={`${buttonClass} disabled:opacity-30`}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
        >
          ↷
        </button>
      </div>

      {/* Font size (− / +). Column width is resized by dragging a column edge
          in the date header. */}
      <div className="flex items-center gap-1 border-l border-neutral-200 pl-3 text-sm">
        <span className="text-xs text-neutral-500">Font</span>
        <button
          type="button"
          onClick={() => onFontScaleChange(fontScale - 0.1)}
          className={buttonClass}
          aria-label="Smaller font"
        >
          −
        </button>
        <span className="w-8 text-center text-xs tabular-nums text-neutral-500">
          {Math.round(fontScale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onFontScaleChange(fontScale + 0.1)}
          className={buttonClass}
          aria-label="Larger font"
        >
          +
        </button>
      </div>

      {/* Fit rows to content — reset manual row heights for the active view. */}
      <div className="flex items-center border-l border-neutral-200 pl-3 text-sm">
        <button
          type="button"
          onClick={onFitRows}
          className={buttonClass}
          title={
            view === "main"
              ? "Fit lanes to content (reset row heights)"
              : "Fit task rows to content (reset row heights)"
          }
        >
          Fit rows
        </button>
      </div>

      {/* Hide empty lanes (weekly view only). */}
      {view === "weekly" && (
        <label className="flex items-center gap-1.5 border-l border-neutral-200 pl-3 text-xs text-neutral-600">
          <input
            type="checkbox"
            checked={hideEmptyLanes}
            onChange={(e) => onHideEmptyLanesChange(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer"
          />
          Hide empty lanes
        </label>
      )}

      {/* Fill-color toolbar (both views). Recolors the selected lane or event;
          otherwise sets the default color for the next event you create. */}
      <div className="flex items-center gap-1.5 border-l border-neutral-200 pl-3">
        <span className="text-xs text-neutral-500">{laneSelected ? "Lane" : "Fill"}</span>
        {COLOR_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onApplyColor(name)}
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

      {/* Sync indicator */}
      <div className="min-w-[120px] text-xs text-neutral-500">
        {syncing && <span className="animate-pulse">Syncing calendar…</span>}
        {!syncing && syncError && <span className="text-red-500">{syncError}</span>}
        {!syncing && !syncError && signedIn && <span>Calendar synced</span>}
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className={`${buttonClass} ml-auto`}
        aria-label="Open settings"
      >
        ⚙️
      </button>
    </header>
  );
}
