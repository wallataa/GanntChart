"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { DateRange, Event, ViewMode } from "@/types";
import {
  defaultRange,
  formatRangeLabel,
  fromISODate,
  shiftRange,
  weeklyRange,
} from "@/lib/dates";
import { useGanttController } from "@/lib/useGanttController";
import { useCalendarSync } from "@/lib/useCalendarSync";
import { useCalendarPush } from "@/lib/useCalendarPush";
import { useLifeEvents } from "@/lib/useLifeEvents";
import { LIFE_LANE_ID } from "@/lib/lanes";
import { useBoardSync } from "@/lib/useBoardSync";
import { useIsMobile } from "@/lib/useIsMobile";
import { useViewSettings } from "@/lib/useViewSettings";
import Toolbar from "@/components/Toolbar";
import GanttGrid from "@/components/GanttGrid";
import WeeklyView from "@/components/WeeklyView";
import SettingsPanel from "@/components/SettingsPanel";
import NotesPanel from "@/components/NotesPanel";

export default function Home() {
  // The undoable data document + all selection/editing state and handlers.
  // Life-lane (GCal) deletions route to the calendar mutations via this ref
  // (assigned below once lifeOps exists) — so the Delete key, empty-title
  // deletes, etc. all work on calendar events too, without undo pollution.
  const deleteGcalRef = useRef<(id: string) => boolean>(() => false);
  const ctrl = useGanttController({ deleteExternal: (id) => deleteGcalRef.current(id) });

  // Active view + its date windows (main spans months, weekly spans 14 days).
  const [view, setView] = useState<ViewMode>("main");
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [weekRange, setWeekRange] = useState<DateRange>(() => weeklyRange());

  // Persisted view settings (column widths, font scale, sidebar widths, …).
  const settings = useViewSettings();

  // Re-derive the weekly window when its horizon settings change (including
  // right after they hydrate from storage): keep the current anchor, apply the
  // configured span and Monday alignment.
  useEffect(() => {
    setWeekRange((r) => weeklyRange(r.start, settings.weeklyWeeks, settings.weeklyFixedWeek));
  }, [settings.weeklyWeeks, settings.weeklyFixedWeek]);

  // Phones: drop the notes column, cap the label column, and shrink the weekly
  // day columns so most of a week fits the screen without zooming. The user's
  // saved widths come back on desktop.
  const isMobile = useIsMobile();
  // The stacked split view needs vertical room — fall back to the timeline
  // on phones (the "Both" switcher option is hidden there too).
  const effectiveView: ViewMode = isMobile && view === "split" ? "main" : view;
  const sidebarNotesWidth = isMobile ? 0 : settings.sidebarNotesWidth;
  const sidebarLabelWidth = isMobile
    ? Math.min(116, settings.sidebarLabelWidth)
    : settings.sidebarLabelWidth;
  const weekColumnWidth = isMobile
    ? Math.min(48, settings.weekColumnWidth)
    : settings.weekColumnWidth;
  // On a phone the weekly grid is tight, so always drop lanes with nothing in
  // the fortnight (placeholder rows are pure noise there); desktop honors the
  // saved preference.
  const hideEmptyLanes = isMobile || settings.hideEmptyLanes;

  // Google Calendar events for the Life lane.
  const calendar = useCalendarSync(range);

  // Push selected events into the dedicated "Gantt Chart" Google Calendar.
  const push = useCalendarPush(ctrl.markPushed);

  // Editing for the Life lane's Google Calendar events (create / reschedule /
  // rename / delete write through to Google; optimistic locally).
  const lifeOps = useLifeEvents({
    calendars: calendar.calendars,
    applyLocal: calendar.applyLocal,
    refresh: calendar.refresh,
    reportError: calendar.reportError,
    onCreated: (id) => {
      ctrl.interaction.onSelect(id);
      ctrl.interaction.onStartEdit(id);
    },
  });
  deleteGcalRef.current = (id) => {
    if (!id.startsWith("gcal:")) return false;
    lifeOps.remove(id);
    return true;
  };

  // Auto-sync: once an event has been pushed to Google Calendar, later edits
  // (rename, move, resize, note, lane change) re-push automatically — no
  // "Update" click needed. The first push stays manual (you choose what goes
  // to the calendar). Pushes are debounced 2s so a burst of edits (e.g.
  // holding an arrow key to nudge) collapses into one API call, and run one
  // at a time — the effect re-fires when the in-flight one finishes.
  const pushedSigRef = useRef<Map<string, string>>(new Map());
  const pushRef = useRef(push);
  pushRef.current = push;
  useEffect(() => {
    if (!calendar.signedIn || push.pushingId) return;
    let changed: { ev: Event; laneLabel: string; sig: string } | null = null;
    for (const ev of ctrl.manualEvents) {
      if (!ev.pushed) {
        pushedSigRef.current.delete(ev.id);
        continue;
      }
      const laneLabel = ctrl.lanes.find((l) => l.id === ev.laneId)?.label ?? "";
      const sig = [ev.title, ev.start, ev.end, ev.note ?? "", laneLabel].join(" ");
      const prev = pushedSigRef.current.get(ev.id);
      if (prev === undefined) {
        // First sighting (load / fresh push): baseline, don't re-push.
        pushedSigRef.current.set(ev.id, sig);
      } else if (prev !== sig && !changed) {
        changed = { ev, laneLabel, sig };
      }
    }
    if (!changed) return;
    // The signature updates only when the push actually fires, so every
    // further edit re-runs this effect, resets the timer, and the eventual
    // push carries the latest version of the event.
    const target = changed;
    const timer = setTimeout(() => {
      pushedSigRef.current.set(target.ev.id, target.sig);
      pushRef.current.pushEvent(target.ev, target.laneLabel);
    }, 2000);
    return () => clearTimeout(timer);
  }, [ctrl.manualEvents, ctrl.lanes, calendar.signedIn, push.pushingId]);

  // Account board sync: while signed in, the document mirrors to Drive / KV.
  const boardDoc = useMemo(
    () => ({ lanes: ctrl.lanes, events: ctrl.manualEvents, subtasks: ctrl.subtasks }),
    [ctrl.lanes, ctrl.manualEvents, ctrl.subtasks],
  );
  const boardSync = useBoardSync(boardDoc, ctrl.replaceDoc);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Which markdown note (if any) is open in the side panel: a task or a lane.
  const [notesTarget, setNotesTarget] = useState<{ kind: "event" | "lane"; id: string } | null>(
    null,
  );

  // Open the Notes panel for whatever is currently selected (lane wins, mirroring
  // the toolbar's color/action precedence).
  const openNote = () => {
    if (ctrl.selectedLaneId) setNotesTarget({ kind: "lane", id: ctrl.selectedLaneId });
    else if (ctrl.interaction.selectedEventId)
      setNotesTarget({ kind: "event", id: ctrl.interaction.selectedEventId });
  };

  // Resolve the open note's heading + current markdown from the live document
  // (so it follows renames / external sync while the panel is open).
  const noteContext = useMemo(() => {
    if (!notesTarget) return null;
    if (notesTarget.kind === "lane") {
      const lane = ctrl.lanes.find((l) => l.id === notesTarget.id);
      return lane ? { title: lane.label, kindLabel: "Lane note", value: lane.note ?? "" } : null;
    }
    const ev = ctrl.manualEvents.find((e) => e.id === notesTarget.id);
    return ev ? { title: ev.title, kindLabel: "Task note", value: ev.note ?? "" } : null;
  }, [notesTarget, ctrl.lanes, ctrl.manualEvents]);

  const saveNote = (value: string) => {
    if (!notesTarget) return;
    if (notesTarget.kind === "lane") ctrl.setLaneNote(notesTarget.id, value);
    else ctrl.setNote(notesTarget.id, value);
  };

  // Grid interaction with two layers on top of the controller:
  //  - the Notes panel (page state) opens from an event's note badge;
  //  - Life-lane GCal events (ids "gcal:…") route to the calendar mutations
  //    instead of the manual-event document.
  const gridInteraction = useMemo(() => {
    const isGcal = (id: string) => id.startsWith("gcal:");
    return {
      ...ctrl.interaction,
      onOpenNote: (id: string) => {
        ctrl.interaction.onOpenNote(id);
        setNotesTarget({ kind: "event", id });
      },
      onCreateEvent: (laneId: string, startISO: string, endISO: string) => {
        if (laneId === LIFE_LANE_ID) lifeOps.create(startISO, endISO);
        else ctrl.interaction.onCreateEvent(laneId, startISO, endISO);
      },
      onCommitEdit: (id: string, title: string) => {
        if (isGcal(id)) {
          ctrl.interaction.onCancelEdit(); // close the editor without touching the doc
          lifeOps.rename(id, title);
        } else {
          ctrl.interaction.onCommitEdit(id, title);
        }
      },
      onResize: (id: string, startISO: string, endISO: string) => {
        if (isGcal(id)) lifeOps.reschedule(id, startISO, endISO);
        else ctrl.interaction.onResize(id, startISO, endISO);
      },
      onMoveEvent: (id: string, laneId: string, startISO: string, endISO: string) => {
        // GCal events stay in the Life lane — only their dates change.
        if (isGcal(id)) lifeOps.reschedule(id, startISO, endISO);
        else ctrl.interaction.onMoveEvent(id, laneId, startISO, endISO);
      },
      // onDelete needs no wrapper: the controller routes GCal ids through the
      // deleteExternal delegate (covering the Delete key path too).
    };
  }, [ctrl.interaction, lifeOps]);

  // Slide-animation state for date navigation. `key` forces a remount to replay
  // the CSS animation; `dir` picks the direction.
  const [slide, setSlide] = useState<{ key: number; dir: "left" | "right" | "none" }>({
    key: 0,
    dir: "none",
  });

  const allEvents = useMemo(() => {
    const events = [
      ...ctrl.manualEvents,
      ...calendar.events,
      ...(ctrl.draftEvent ? [ctrl.draftEvent] : []),
    ];
    return settings.hideDone ? events.filter((e) => !e.done) : events;
  }, [ctrl.manualEvents, calendar.events, ctrl.draftEvent, settings.hideDone]);

  const selectedEvent = useMemo(
    () => ctrl.manualEvents.find((e) => e.id === ctrl.interaction.selectedEventId) ?? null,
    [ctrl.manualEvents, ctrl.interaction.selectedEventId],
  );

  // Date navigation acts on whichever view's window is active (both windows
  // in split view). Bumping `key` remounts the grid wrapper, replaying the
  // directional CSS slide.
  const navigateWeeks = (weeks: number) => {
    if (effectiveView !== "main") setWeekRange((r) => shiftRange(r, weeks));
    if (effectiveView !== "weekly") setRange((r) => shiftRange(r, weeks));
    setSlide((s) => ({ key: s.key + 1, dir: weeks < 0 ? "left" : "right" }));
  };

  const goToday = () => {
    if (effectiveView !== "main")
      setWeekRange(weeklyRange(new Date(), settings.weeklyWeeks, settings.weeklyFixedWeek));
    if (effectiveView !== "weekly") setRange(defaultRange());
    setSlide((s) => ({ key: s.key + 1, dir: "none" }));
  };

  const changeView = (v: ViewMode) => {
    setView(v);
    setSlide((s) => ({ key: s.key + 1, dir: "none" }));
  };

  // Jump-to-date: re-anchor the active view's window(s) at the picked day.
  const jumpToDate = (iso: string) => {
    const d = fromISODate(iso);
    if (Number.isNaN(d.getTime())) return;
    if (effectiveView !== "main")
      setWeekRange(weeklyRange(d, settings.weeklyWeeks, settings.weeklyFixedWeek));
    if (effectiveView !== "weekly") setRange(defaultRange(d));
    setSlide((s) => ({ key: s.key + 1, dir: "none" }));
  };

  const slideClass =
    slide.dir === "left" ? "anim-left" : slide.dir === "right" ? "anim-right" : "anim-none";

  return (
    <main className="app-shell flex flex-col p-2 sm:p-4">
      <Toolbar
        view={effectiveView}
        onViewChange={changeView}
        onNavigateWeeks={navigateWeeks}
        onToday={goToday}
        rangeLabel={formatRangeLabel(effectiveView === "weekly" ? weekRange : range)}
        onJumpToDate={jumpToDate}
        onUndo={ctrl.undo}
        onRedo={ctrl.redo}
        canUndo={ctrl.canUndo}
        canRedo={ctrl.canRedo}
        fontScale={settings.fontScale}
        onFontScaleChange={settings.setFontScale}
        onFitRows={() => ctrl.fitRows(effectiveView)}
        hideEmptyLanes={settings.hideEmptyLanes}
        onHideEmptyLanesChange={settings.setHideEmptyLanes}
        hideDone={settings.hideDone}
        onHideDoneChange={settings.setHideDone}
        selectedEvent={selectedEvent}
        onToggleDone={ctrl.toggleDone}
        onOpenNote={openNote}
        onPushEvent={(event) =>
          push.pushEvent(event, ctrl.lanes.find((l) => l.id === event.laneId)?.label)
        }
        pushing={push.pushingId !== null}
        pushError={push.pushError}
        activeColor={ctrl.activeColor}
        onApplyColor={ctrl.applyColor}
        selection={
          ctrl.selectedLaneId ? "lane" : ctrl.interaction.selectedEventId ? "event" : null
        }
        signedIn={calendar.signedIn}
        syncing={calendar.syncing}
        syncError={calendar.error}
        boardStatus={boardSync.status}
        boardBackend={boardSync.backend}
        boardError={boardSync.error}
        theme={settings.theme}
        onThemeChange={settings.setTheme}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Grid (wrapper remounts per navigation to replay the slide animation) */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {ctrl.lanes.length > 0 ? (
          <div
            key={slide.key}
            className={`h-full ${slideClass}`}
            style={
              {
                ["--fs" as string]: settings.fontScale,
                ["--sb-notes" as string]: `${sidebarNotesWidth}px`,
                ["--sb-label" as string]: `${sidebarLabelWidth}px`,
                ["--sb-w" as string]: `${sidebarNotesWidth + sidebarLabelWidth}px`,
              } as CSSProperties
            }
          >
            <div className="flex h-full flex-col gap-2">
            {/* In split view the panes size to their content (flex-auto: basis
                = content height) and grow/shrink to exactly fill the viewport —
                a short weekly pane no longer wastes half the screen while the
                timeline scrolls. Single views keep the fill-everything flex-1. */}
            {effectiveView !== "weekly" && (
              <div className={effectiveView === "split" ? "min-h-0 flex-auto" : "min-h-0 flex-1"}>
              <GanttGrid
                lanes={ctrl.lanes}
                events={allEvents}
                range={range}
                interaction={gridInteraction}
                columnWidth={settings.columnWidth}
                onColumnWidthChange={settings.setColumnWidth}
                sidebarNotesWidth={sidebarNotesWidth}
                sidebarLabelWidth={sidebarLabelWidth}
                onResizeSidebar={settings.setSidebarWidth}
                subtasks={ctrl.subtasks}
                onToggleSubtask={ctrl.weeklyInteraction.onToggle}
                lifeEditable={calendar.signedIn}
              />
              </div>
            )}
            {effectiveView !== "main" && (
              <div className={effectiveView === "split" ? "min-h-0 flex-auto" : "min-h-0 flex-1"}>
              <WeeklyView
                lanes={ctrl.lanes}
                events={allEvents}
                range={weekRange}
                subtasks={ctrl.subtasks}
                interaction={ctrl.weeklyInteraction}
                columnWidth={weekColumnWidth}
                onColumnWidthChange={settings.setWeekColumnWidth}
                sidebarNotesWidth={sidebarNotesWidth}
                sidebarLabelWidth={sidebarLabelWidth}
                onResizeSidebar={settings.setSidebarWidth}
                onReorderLanes={ctrl.reorderLanes}
                onMoveTask={ctrl.moveTask}
                onAddLane={ctrl.addLane}
                onDeleteLane={ctrl.deleteLane}
                selectedLaneId={ctrl.selectedLaneId}
                onSelectLane={ctrl.selectLane}
                onToggleSubtask={ctrl.weeklyInteraction.onToggle}
                hideEmptyLanes={hideEmptyLanes}
              />
              </div>
            )}
            </div>
          </div>
        ) : (
          <div className="p-8 text-sm text-neutral-400">Loading…</div>
        )}
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        calendars={calendar.calendars}
        enabledCalendarIds={calendar.enabledCalendarIds}
        onToggleCalendar={calendar.toggleCalendar}
        lanes={ctrl.lanes}
        onRenameLane={ctrl.renameLane}
        onSetLaneColor={ctrl.setLaneColor}
        onDeleteLane={ctrl.deleteLane}
        onReorderLanes={ctrl.reorderLanes}
        onAddLane={ctrl.addLane}
        onClearAll={ctrl.clearAll}
        weeklyWeeks={settings.weeklyWeeks}
        onWeeklyWeeksChange={settings.setWeeklyWeeks}
        weeklyFixedWeek={settings.weeklyFixedWeek}
        onWeeklyFixedWeekChange={settings.setWeeklyFixedWeek}
      />

      <NotesPanel
        key={notesTarget ? `${notesTarget.kind}:${notesTarget.id}` : "none"}
        open={notesTarget !== null && noteContext !== null}
        title={noteContext?.title ?? ""}
        kindLabel={noteContext?.kindLabel ?? ""}
        value={noteContext?.value ?? ""}
        onSave={saveNote}
        onClose={() => setNotesTarget(null)}
      />
    </main>
  );
}
