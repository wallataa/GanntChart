"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { DateRange, ViewMode } from "@/types";
import { defaultRange, formatRangeLabel, shiftRange, weeklyRange } from "@/lib/dates";
import { useGanttController } from "@/lib/useGanttController";
import { useCalendarSync } from "@/lib/useCalendarSync";
import { useViewSettings } from "@/lib/useViewSettings";
import Toolbar from "@/components/Toolbar";
import GanttGrid from "@/components/GanttGrid";
import WeeklyView from "@/components/WeeklyView";
import SettingsPanel from "@/components/SettingsPanel";

export default function Home() {
  // The undoable data document + all selection/editing state and handlers.
  const ctrl = useGanttController();

  // Active view + its date windows (main spans months, weekly spans 14 days).
  const [view, setView] = useState<ViewMode>("main");
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [weekRange, setWeekRange] = useState<DateRange>(() => weeklyRange());

  // Persisted view settings (column widths, font scale, sidebar widths, …).
  const settings = useViewSettings();

  // Google Calendar events for the Life lane.
  const calendar = useCalendarSync(range);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Slide-animation state for date navigation. `key` forces a remount to replay
  // the CSS animation; `dir` picks the direction.
  const [slide, setSlide] = useState<{ key: number; dir: "left" | "right" | "none" }>({
    key: 0,
    dir: "none",
  });

  const allEvents = useMemo(
    () => [
      ...ctrl.manualEvents,
      ...calendar.events,
      ...(ctrl.draftEvent ? [ctrl.draftEvent] : []),
    ],
    [ctrl.manualEvents, calendar.events, ctrl.draftEvent],
  );

  // Date navigation acts on whichever view's window is active. Bumping `key`
  // remounts the grid wrapper, replaying the directional CSS slide.
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

  const changeView = (v: ViewMode) => {
    setView(v);
    setSlide((s) => ({ key: s.key + 1, dir: "none" }));
  };

  const slideClass =
    slide.dir === "left" ? "anim-left" : slide.dir === "right" ? "anim-right" : "anim-none";

  return (
    <main className="flex h-screen flex-col p-4">
      <Toolbar
        view={view}
        onViewChange={changeView}
        onNavigateWeeks={navigateWeeks}
        onToday={goToday}
        rangeLabel={formatRangeLabel(view === "weekly" ? weekRange : range)}
        onUndo={ctrl.undo}
        onRedo={ctrl.redo}
        canUndo={ctrl.canUndo}
        canRedo={ctrl.canRedo}
        fontScale={settings.fontScale}
        onFontScaleChange={settings.setFontScale}
        onFitRows={() => ctrl.fitRows(view)}
        hideEmptyLanes={settings.hideEmptyLanes}
        onHideEmptyLanesChange={settings.setHideEmptyLanes}
        activeColor={ctrl.activeColor}
        onApplyColor={ctrl.applyColor}
        selection={
          ctrl.selectedLaneId ? "lane" : ctrl.interaction.selectedEventId ? "event" : null
        }
        signedIn={calendar.signedIn}
        syncing={calendar.syncing}
        syncError={calendar.error}
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
                ["--sb-notes" as string]: `${settings.sidebarNotesWidth}px`,
                ["--sb-label" as string]: `${settings.sidebarLabelWidth}px`,
                ["--sb-w" as string]: `${settings.sidebarNotesWidth + settings.sidebarLabelWidth}px`,
              } as CSSProperties
            }
          >
            {view === "main" ? (
              <GanttGrid
                lanes={ctrl.lanes}
                events={allEvents}
                range={range}
                interaction={ctrl.interaction}
                columnWidth={settings.columnWidth}
                onColumnWidthChange={settings.setColumnWidth}
                sidebarNotesWidth={settings.sidebarNotesWidth}
                sidebarLabelWidth={settings.sidebarLabelWidth}
                onResizeSidebar={settings.setSidebarWidth}
                subtasks={ctrl.subtasks}
                onToggleSubtask={ctrl.weeklyInteraction.onToggle}
              />
            ) : (
              <WeeklyView
                lanes={ctrl.lanes}
                events={allEvents}
                range={weekRange}
                subtasks={ctrl.subtasks}
                interaction={ctrl.weeklyInteraction}
                columnWidth={settings.weekColumnWidth}
                onColumnWidthChange={settings.setWeekColumnWidth}
                sidebarNotesWidth={settings.sidebarNotesWidth}
                sidebarLabelWidth={settings.sidebarLabelWidth}
                onResizeSidebar={settings.setSidebarWidth}
                onReorderLanes={ctrl.reorderLanes}
                onMoveTask={ctrl.moveTask}
                onAddLane={ctrl.addLane}
                onDeleteLane={ctrl.deleteLane}
                selectedLaneId={ctrl.selectedLaneId}
                onSelectLane={ctrl.selectLane}
                onToggleSubtask={ctrl.weeklyInteraction.onToggle}
                hideEmptyLanes={settings.hideEmptyLanes}
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
      />
    </main>
  );
}
