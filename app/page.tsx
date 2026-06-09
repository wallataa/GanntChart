"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useSession } from "next-auth/react";
import type {
  CalendarApiResponse,
  CalendarSource,
  ColorName,
  DateRange,
  EditTarget,
  Event,
  GridInteraction,
  Subtask,
  SubtaskEditTarget,
  SwimLane,
  ViewMode,
  WeeklyInteraction,
} from "@/types";
import { COLUMN_WIDTH, defaultRange, shiftRange, toISODate, weeklyRange } from "@/lib/dates";
import { isLifeLane, loadLanes, pinLifeLast, saveLanes } from "@/lib/lanes";
import { loadEvents, saveEvents } from "@/lib/events";
import { loadSubtasks, saveSubtasks } from "@/lib/subtasks";
import { COLOR_NAMES, PALETTE } from "@/lib/colors";
import GanttGrid from "@/components/GanttGrid";
import WeeklyView from "@/components/WeeklyView";
import SettingsPanel from "@/components/SettingsPanel";

export default function Home() {
  const { data: session } = useSession();

  // Swim lanes + manual events come from localStorage (seeded with defaults).
  const [lanes, setLanes] = useState<SwimLane[]>([]);
  const [manualEvents, setManualEvents] = useState<Event[]>([]);

  // Active view + its date windows (main spans months, weekly spans 14 days).
  const [view, setView] = useState<ViewMode>("main");
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [weekRange, setWeekRange] = useState<DateRange>(() => weeklyRange());

  // Subtasks (weekly view) + inline edit state.
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subEditing, setSubEditing] = useState<SubtaskEditTarget | null>(null);

  // Adjustable day-column width (shared by both views), persisted. Resized by
  // dragging a column edge in the date header (see DateHeader).
  const COL_WIDTH_KEY = "gantt:colWidth";
  const [columnWidth, setColumnWidth] = useState<number>(COLUMN_WIDTH);
  const changeColumnWidth = (next: number) => {
    const clamped = Math.max(28, Math.min(120, Math.round(next)));
    setColumnWidth(clamped);
    try {
      window.localStorage.setItem(COL_WIDTH_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  };

  // Adjustable font scale (− / +), applied to the grid via the `--fs` CSS var,
  // persisted. 1 = default size.
  const FONT_SCALE_KEY = "gantt:fontScale";
  const [fontScale, setFontScale] = useState<number>(1);
  const changeFontScale = (next: number) => {
    const clamped = Math.max(0.8, Math.min(1.8, Math.round(next * 10) / 10));
    setFontScale(clamped);
    try {
      window.localStorage.setItem(FONT_SCALE_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  };

  // Max weekly-row height in px (0 = off). Applied via the `--max-row-h` CSS
  // var; rows taller than this scroll. Persisted.
  const MAX_ROW_KEY = "gantt:maxRowHeight";
  const [maxRowHeight, setMaxRowHeight] = useState<number>(0);
  const stepMaxRow = (dir: 1 | -1) => {
    let next: number;
    if (maxRowHeight === 0) next = dir > 0 ? 160 : 0; // turn on from off
    else {
      next = maxRowHeight + dir * 40;
      if (next < 80) next = 0; // below the floor turns it off
      else next = Math.min(800, next);
    }
    setMaxRowHeight(next);
    try {
      window.localStorage.setItem(MAX_ROW_KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  // Optionally hide weekly swim lanes with no tasks in the visible fortnight.
  const HIDE_EMPTY_KEY = "gantt:hideEmptyWeekly";
  const [hideEmptyLanes, setHideEmptyLanes] = useState(false);
  const changeHideEmpty = (next: boolean) => {
    setHideEmptyLanes(next);
    try {
      window.localStorage.setItem(HIDE_EMPTY_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // Google Calendar state for the Life lane.
  const [gcalEvents, setGcalEvents] = useState<Event[]>([]);
  const [calendars, setCalendars] = useState<CalendarSource[]>([]);
  const [enabledCalendarIds, setEnabledCalendarIds] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Direct-manipulation state (spreadsheet-style editing).
  const [activeColor, setActiveColor] = useState<ColorName>("sky");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);

  // Slide-animation state for date navigation. `key` forces a remount to replay
  // the CSS animation; `dir` picks the direction.
  const [slide, setSlide] = useState<{ key: number; dir: "left" | "right" | "none" }>({
    key: 0,
    dir: "none",
  });

  // Hydrate client-only data after mount (avoids SSR/localStorage mismatch).
  useEffect(() => {
    setLanes(loadLanes());
    setManualEvents(loadEvents());
    setSubtasks(loadSubtasks());
    const savedWidth = Number(window.localStorage.getItem("gantt:colWidth"));
    if (savedWidth >= 28 && savedWidth <= 120) setColumnWidth(savedWidth);
    const savedScale = Number(window.localStorage.getItem("gantt:fontScale"));
    if (savedScale >= 0.8 && savedScale <= 1.8) setFontScale(savedScale);
    const savedMaxRow = Number(window.localStorage.getItem("gantt:maxRowHeight"));
    if (savedMaxRow >= 80 && savedMaxRow <= 800) setMaxRowHeight(savedMaxRow);
    setHideEmptyLanes(window.localStorage.getItem("gantt:hideEmptyWeekly") === "1");
  }, []);

  // Fetch GCal events for the Life lane whenever the range, session, or the
  // set of enabled calendars changes.
  const fetchCalendar = useCallback(async () => {
    if (!session) {
      setGcalEvents([]);
      return;
    }
    setSyncing(true);
    setSyncError(null);
    try {
      const params = new URLSearchParams({
        start: toISODate(range.start),
        end: toISODate(range.end),
      });
      if (enabledCalendarIds.length > 0) {
        params.set("calendars", enabledCalendarIds.join(","));
      }
      const res = await fetch(`/api/calendar?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as CalendarApiResponse;
      setGcalEvents(data.events);
      setCalendars(data.calendars);
      // Initialize the enabled set from the server's defaults on first load.
      setEnabledCalendarIds((prev) =>
        prev.length > 0 ? prev : data.calendars.filter((c) => c.enabled).map((c) => c.id),
      );
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
      setGcalEvents([]);
    } finally {
      setSyncing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, range, enabledCalendarIds]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const allEvents = useMemo(
    () => [...manualEvents, ...gcalEvents],
    [manualEvents, gcalEvents],
  );

  const handleToggleCalendar = (id: string, enabled: boolean) => {
    setEnabledCalendarIds((prev) =>
      enabled ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((c) => c !== id),
    );
  };

  // Persist manual events to state + localStorage in one place.
  const persistEvents = (next: Event[]) => {
    setManualEvents(next);
    saveEvents(next);
  };

  const newId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `manual-${Date.now()}`;

  // ---- Inline event editing (spreadsheet-style) ----
  const handleCommitNew = (laneId: string, date: string, title: string) => {
    const name = title.trim();
    setEditing(null);
    if (!name) return; // empty = cancel
    const id = newId();
    const newEvent: Event = {
      id,
      laneId,
      title: name,
      start: date,
      end: date,
      color: activeColor,
      source: "manual",
    };
    persistEvents([...manualEvents, newEvent]);
    setSelectedEventId(id); // select so the color toolbar can recolor it
  };

  const handleCommitEdit = (id: string, title: string) => {
    const name = title.trim();
    setEditing(null);
    if (!name) {
      // Clearing the text deletes the event (like emptying a cell).
      persistEvents(manualEvents.filter((e) => e.id !== id));
      setSelectedEventId((cur) => (cur === id ? null : cur));
      return;
    }
    persistEvents(manualEvents.map((e) => (e.id === id ? { ...e, title: name } : e)));
  };

  const handleDeleteEvent = (id: string) => {
    persistEvents(manualEvents.filter((e) => e.id !== id));
    setSelectedEventId((cur) => (cur === id ? null : cur));
    setEditing(null);
  };

  const handleResizeEvent = (id: string, startISO: string, endISO: string) => {
    const start = startISO <= endISO ? startISO : endISO;
    const end = startISO <= endISO ? endISO : startISO;
    persistEvents(manualEvents.map((e) => (e.id === id ? { ...e, start, end } : e)));
  };

  const handleMoveEvent = (id: string, laneId: string, startISO: string, endISO: string) => {
    persistEvents(
      manualEvents.map((e) =>
        e.id === id ? { ...e, laneId, start: startISO, end: endISO } : e,
      ),
    );
    setSelectedEventId(id);
  };

  // Move a task (weekly drag): change its lane, vertical position, and/or dates
  // in one update. `beforeTaskId` is the task to insert it ahead of within the
  // target lane (null = append). Order is encoded by array position.
  const handleMoveTask = (
    id: string,
    laneId: string,
    beforeTaskId: string | null,
    startISO: string,
    endISO: string,
  ) => {
    const moving = manualEvents.find((e) => e.id === id);
    if (!moving) return;
    const start = startISO <= endISO ? startISO : endISO;
    const end = startISO <= endISO ? endISO : startISO;
    const rest = manualEvents.filter((e) => e.id !== id);
    const updated = { ...moving, laneId, start, end };
    let idx = beforeTaskId ? rest.findIndex((e) => e.id === beforeTaskId) : -1;
    if (idx === -1) {
      // Append after the last existing task of the target lane (or at the end).
      let last = -1;
      rest.forEach((e, i) => {
        if (e.laneId === laneId) last = i;
      });
      idx = last === -1 ? rest.length : last + 1;
    }
    persistEvents([...rest.slice(0, idx), updated, ...rest.slice(idx)]);
    setSelectedEventId(id);
    setSelectedLaneId(null);
  };

  const handleSelectEvent = (id: string) => {
    setSelectedEventId(id);
    setSelectedLaneId(null);
    setEditing(null);
    // Reflect the selected event's color in the toolbar.
    const ev = manualEvents.find((e) => e.id === id);
    if (ev?.color) setActiveColor(ev.color);
  };

  // Select a swim lane (so the Fill swatches recolor it). null clears.
  const handleSelectLane = (id: string | null) => {
    setSelectedLaneId(id);
    if (id) {
      setSelectedEventId(null);
      setEditing(null);
      const lane = lanes.find((l) => l.id === id);
      if (lane) setActiveColor(lane.color);
    }
  };

  // Color toolbar: recolor whichever is selected (lane wins over event), and set
  // the default color for the next created event.
  const applyColor = (color: ColorName) => {
    setActiveColor(color);
    if (selectedLaneId) {
      handleSetLaneColor(selectedLaneId, color);
    } else if (selectedEventId) {
      persistEvents(
        manualEvents.map((e) => (e.id === selectedEventId ? { ...e, color } : e)),
      );
    }
  };

  // ---- Subtasks (weekly view) ----
  const persistSubtasks = (next: Subtask[]) => {
    setSubtasks(next);
    saveSubtasks(next);
  };

  const handleCommitNewSubtask = (taskId: string, date: string, title: string) => {
    const name = title.trim();
    setSubEditing(null);
    if (!name) return;
    persistSubtasks([
      ...subtasks,
      { id: newId(), taskId, date, title: name, done: false },
    ]);
  };

  // Append a subtask but keep the input open for rapid entry (Enter in weekly).
  const handleAddSubtask = (taskId: string, date: string, title: string) => {
    const name = title.trim();
    if (!name) return;
    persistSubtasks([
      ...subtasks,
      { id: newId(), taskId, date, title: name, done: false },
    ]);
  };

  const handleCommitEditSubtask = (id: string, title: string) => {
    const name = title.trim();
    setSubEditing(null);
    if (!name) {
      persistSubtasks(subtasks.filter((s) => s.id !== id));
      return;
    }
    persistSubtasks(subtasks.map((s) => (s.id === id ? { ...s, title: name } : s)));
  };

  const weeklyInteraction: WeeklyInteraction = {
    editing: subEditing,
    selectedTaskId: selectedEventId,
    onSelectTask: handleSelectEvent,
    onStartNew: (taskId, date) => setSubEditing({ kind: "new", taskId, date }),
    onStartEdit: (subtaskId) => setSubEditing({ kind: "sub", subtaskId }),
    onCommitNew: handleCommitNewSubtask,
    onAddSubtask: handleAddSubtask,
    onCommitEdit: handleCommitEditSubtask,
    onCancelEdit: () => setSubEditing(null),
    onToggle: (id) =>
      persistSubtasks(subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s))),
    onDelete: (id) => persistSubtasks(subtasks.filter((s) => s.id !== id)),
  };

  // ---- Swim-lane management (Phase 3) ----
  const persistLanes = (next: SwimLane[]) => {
    const pinned = pinLifeLast(next);
    setLanes(pinned);
    saveLanes(pinned);
  };

  const handleRenameLane = (id: string, label: string) =>
    persistLanes(lanes.map((l) => (l.id === id ? { ...l, label } : l)));

  const handleSetLaneColor = (id: string, color: ColorName) =>
    persistLanes(lanes.map((l) => (l.id === id ? { ...l, color } : l)));

  const handleSetLaneNotes = (id: string, notes: string[]) =>
    persistLanes(lanes.map((l) => (l.id === id ? { ...l, notes } : l)));

  const handleDeleteLane = (id: string) => {
    const target = lanes.find((l) => l.id === id);
    if (!target || isLifeLane(target)) return; // Life lane is locked.
    persistLanes(lanes.filter((l) => l.id !== id));
    // Cascade: drop the deleted lane's manual events so they don't linger
    // orphaned in localStorage.
    persistEvents(manualEvents.filter((e) => e.laneId !== id));
  };

  const handleReorderLanes = (from: number, to: number) => {
    if (to < 0 || to >= lanes.length || from === to) return;
    const next = [...lanes];
    const [moved] = next.splice(from, 1);
    if (isLifeLane(moved)) return; // can't move the locked lane
    next.splice(to, 0, moved);
    persistLanes(next);
  };

  const handleAddLane = () => {
    const newLane: SwimLane = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `lane-${Date.now()}`,
      label: "New Lane",
      color: "graytone",
      notes: [],
    };
    // pinLifeLast keeps the Life lane at the end after insertion.
    persistLanes([...lanes, newLane]);
  };

  // ---- Date navigation with slide animation (Phase 4) ----
  // Bumping `key` remounts the grid wrapper, replaying the directional CSS slide.
  // Navigation acts on whichever view's window is active.
  const navigateWeeks = (weeks: number) => {
    if (view === "weekly") setWeekRange((r) => shiftRange(r, weeks));
    else setRange((r) => shiftRange(r, weeks));
    setSlide((s) => ({ key: s.key + 1, dir: weeks < 0 ? "left" : "right" }));
  };

  const goToday = () => {
    if (view === "weekly") setWeekRange(weeklyRange());
    else setRange(defaultRange());
    setSlide((s) => ({ key: s.key + 1, dir: "none" }));
  };

  const slideClass =
    slide.dir === "left" ? "anim-left" : slide.dir === "right" ? "anim-right" : "anim-none";

  // Keyboard: Escape clears selection/edit; Delete/Backspace removes the
  // selected event (unless focus is in a text field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "Escape") {
        setEditing(null);
        setSelectedEventId(null);
        setSelectedLaneId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && selectedEventId) {
        e.preventDefault();
        handleDeleteEvent(selectedEventId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, manualEvents]);

  const interaction: GridInteraction = {
    selectedEventId,
    selectedLaneId,
    onSelectLane: handleSelectLane,
    editing,
    onStartNew: (laneId, date) => {
      setSelectedEventId(null);
      setSelectedLaneId(null);
      setEditing({ kind: "new", laneId, date });
    },
    onStartEdit: (eventId) => setEditing({ kind: "event", eventId }),
    onSelect: handleSelectEvent,
    onCommitNew: handleCommitNew,
    onCommitEdit: handleCommitEdit,
    onCancelEdit: () => setEditing(null),
    onResize: handleResizeEvent,
    onMoveEvent: handleMoveEvent,
    onDelete: handleDeleteEvent,
    onRenameLane: handleRenameLane,
    onSetLaneNotes: handleSetLaneNotes,
    onReorderLanes: handleReorderLanes,
  };

  return (
    <main className="flex h-screen flex-col p-4">
      {/* Toolbar */}
      <header className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-lg font-semibold">Gantt Chart</h1>

        {/* View toggle */}
        <div className="flex overflow-hidden rounded border border-neutral-300 text-sm">
          {(["main", "weekly"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setSlide((s) => ({ key: s.key + 1, dir: "none" }));
              }}
              className={[
                "px-3 py-1 capitalize",
                view === v ? "bg-neutral-800 text-white" : "bg-white hover:bg-neutral-50",
              ].join(" ")}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigateWeeks(-1)}
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50"
            aria-label="Previous week"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => navigateWeeks(1)}
            className="rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50"
            aria-label="Next week"
          >
            ›
          </button>
        </div>

        {/* Font size (− / +). Column width is resized by dragging a column edge
            in the date header. */}
        <div className="flex items-center gap-1 border-l border-neutral-200 pl-3 text-sm">
          <span className="text-xs text-neutral-500">Font</span>
          <button
            type="button"
            onClick={() => changeFontScale(fontScale - 0.1)}
            className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50"
            aria-label="Smaller font"
          >
            −
          </button>
          <span className="w-8 text-center text-xs tabular-nums text-neutral-500">
            {Math.round(fontScale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => changeFontScale(fontScale + 0.1)}
            className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50"
            aria-label="Larger font"
          >
            +
          </button>
        </div>

        {/* Max row height (− / value / +). 0 = off (rows grow freely). */}
        <div className="flex items-center gap-1 border-l border-neutral-200 pl-3 text-sm">
          <span className="text-xs text-neutral-500">Max row</span>
          <button
            type="button"
            onClick={() => stepMaxRow(-1)}
            className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50"
            aria-label="Shorter max row height"
          >
            −
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-neutral-500">
            {maxRowHeight ? `${maxRowHeight}px` : "Off"}
          </span>
          <button
            type="button"
            onClick={() => stepMaxRow(1)}
            className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-50"
            aria-label="Taller max row height"
          >
            +
          </button>
        </div>

        {/* Hide empty lanes (weekly view only). */}
        {view === "weekly" && (
          <label className="flex items-center gap-1.5 border-l border-neutral-200 pl-3 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={hideEmptyLanes}
              onChange={(e) => changeHideEmpty(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer"
            />
            Hide empty lanes
          </label>
        )}

        {/* Fill-color toolbar (both views). Recolors the selected lane or event;
            otherwise sets the default color for the next event you create. */}
        <div className="flex items-center gap-1.5 border-l border-neutral-200 pl-3">
          <span className="text-xs text-neutral-500">
            {selectedLaneId ? "Lane" : "Fill"}
          </span>
          {COLOR_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => applyColor(name)}
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
          {!syncing && !syncError && session && <span>Calendar synced</span>}
        </div>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="ml-auto rounded border border-neutral-300 px-2 py-1 text-sm hover:bg-neutral-50"
          aria-label="Open settings"
        >
          ⚙️
        </button>
      </header>

      {/* Grid (wrapper remounts per navigation to replay the slide animation) */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {lanes.length > 0 ? (
          <div
            key={slide.key}
            className={`h-full ${slideClass}`}
            style={
              {
                ["--fs" as string]: fontScale,
                ["--max-row-h" as string]: maxRowHeight ? `${maxRowHeight}px` : "none",
              } as CSSProperties
            }
          >
            {view === "main" ? (
              <GanttGrid
                lanes={lanes}
                events={allEvents}
                range={range}
                interaction={interaction}
                columnWidth={columnWidth}
                onColumnWidthChange={changeColumnWidth}
                subtasks={subtasks}
                onToggleSubtask={weeklyInteraction.onToggle}
              />
            ) : (
              <WeeklyView
                lanes={lanes}
                events={allEvents}
                range={weekRange}
                subtasks={subtasks}
                interaction={weeklyInteraction}
                columnWidth={columnWidth}
                onColumnWidthChange={changeColumnWidth}
                onReorderLanes={handleReorderLanes}
                onMoveTask={handleMoveTask}
                selectedLaneId={selectedLaneId}
                onSelectLane={handleSelectLane}
                onToggleSubtask={weeklyInteraction.onToggle}
                hideEmptyLanes={hideEmptyLanes}
              />
            )}
          </div>
        ) : (
          <div className="p-8 text-sm text-neutral-400">Loading…</div>
        )}
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        calendars={calendars}
        enabledCalendarIds={enabledCalendarIds}
        onToggleCalendar={handleToggleCalendar}
        lanes={lanes}
        onRenameLane={handleRenameLane}
        onSetLaneColor={handleSetLaneColor}
        onDeleteLane={handleDeleteLane}
        onReorderLanes={handleReorderLanes}
        onAddLane={handleAddLane}
      />
    </main>
  );
}
