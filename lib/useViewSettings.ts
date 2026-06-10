"use client";

import { useEffect } from "react";
import {
  COLUMN_WIDTH,
  SIDEBAR_LABEL_WIDTH,
  SIDEBAR_NOTES_WIDTH,
  WEEK_COLUMN_WIDTH,
} from "./dates";
import { usePersistedState } from "./usePersistedState";

export type Theme = "light" | "dark";

const clamp = (min: number, max: number) => (v: number) =>
  Math.max(min, Math.min(max, Math.round(v)));
const clampColWidth = clamp(28, 120);
const clampNotesWidth = clamp(120, 400);
const clampLabelWidth = clamp(60, 280);
const clampFontScale = (v: number) => Math.max(0.8, Math.min(1.8, Math.round(v * 10) / 10));

export interface ViewSettings {
  /** Day-column width for the main view (drag a column edge in its header). */
  columnWidth: number;
  setColumnWidth: (w: number) => void;
  /** Day-column width for the weekly view (independent of the main view). */
  weekColumnWidth: number;
  setWeekColumnWidth: (w: number) => void;
  /** Grid font multiplier (toolbar − / +). */
  fontScale: number;
  setFontScale: (s: number) => void;
  /** Left sidebar column widths (drag the edges in the header). */
  sidebarNotesWidth: number;
  sidebarLabelWidth: number;
  setSidebarWidth: (part: "notes" | "label", width: number) => void;
  /** Weekly view: hide lanes with nothing in the visible fortnight. */
  hideEmptyLanes: boolean;
  setHideEmptyLanes: (hide: boolean) => void;
  /** Filter completed events out of both views. */
  hideDone: boolean;
  setHideDone: (hide: boolean) => void;
  /** Color theme. Applied as a `dark` class on <html> (Tailwind class mode). */
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

/**
 * View settings, persisted to localStorage and clamped. Deliberately outside
 * the undoable document so zoom/layout changes aren't tangled into undo.
 */
export function useViewSettings(): ViewSettings {
  const [columnWidth, setColumnWidth] = usePersistedState(
    "gantt:colWidth",
    COLUMN_WIDTH,
    clampColWidth,
  );
  const [weekColumnWidth, setWeekColumnWidth] = usePersistedState(
    "gantt:weekColWidth",
    WEEK_COLUMN_WIDTH,
    clampColWidth,
  );
  const [fontScale, setFontScale] = usePersistedState("gantt:fontScale", 1, clampFontScale);
  const [sidebarNotesWidth, setSidebarNotesWidth] = usePersistedState(
    "gantt:sbNotesW",
    SIDEBAR_NOTES_WIDTH,
    clampNotesWidth,
  );
  const [sidebarLabelWidth, setSidebarLabelWidth] = usePersistedState(
    "gantt:sbLabelW",
    SIDEBAR_LABEL_WIDTH,
    clampLabelWidth,
  );
  const [hideEmptyLanes, setHideEmptyLanes] = usePersistedState("gantt:hideEmptyWeekly", false);
  const [hideDone, setHideDone] = usePersistedState("gantt:hideDone", false);
  const [theme, setTheme] = usePersistedState<Theme>("gantt:theme", "light", (t) =>
    t === "dark" ? "dark" : "light",
  );

  // Mirror the theme onto <html> so Tailwind `dark:` variants apply everywhere
  // (a pre-hydration script in layout.tsx sets the initial class to avoid a
  // flash of the wrong theme).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setSidebarWidth = (part: "notes" | "label", w: number) =>
    part === "notes" ? setSidebarNotesWidth(w) : setSidebarLabelWidth(w);

  return {
    columnWidth,
    setColumnWidth,
    weekColumnWidth,
    setWeekColumnWidth,
    fontScale,
    setFontScale,
    sidebarNotesWidth,
    sidebarLabelWidth,
    setSidebarWidth,
    hideEmptyLanes,
    setHideEmptyLanes,
    hideDone,
    setHideDone,
    theme,
    setTheme,
  };
}
