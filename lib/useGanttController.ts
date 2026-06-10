"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ColorName,
  Event,
  GridInteraction,
  Subtask,
  SubtaskEditTarget,
  SwimLane,
  ViewMode,
  WeeklyInteraction,
} from "@/types";
import { DEFAULT_LANES, isLifeLane, loadLanes, pinLifeLast, saveLanes } from "./lanes";
import { loadEvents, saveEvents } from "./events";
import { loadSubtasks, saveSubtasks } from "./subtasks";
import { newId } from "./id";
import { shiftISODate } from "./dates";
import { useHistory, type Doc } from "./useHistory";

export interface GanttController {
  lanes: SwimLane[];
  manualEvents: Event[];
  subtasks: Subtask[];
  /** A just-drawn event being titled but not yet committed (render it alongside real events). */
  draftEvent: Event | null;

  /** Default fill color for the next created event / the selection's color. */
  activeColor: ColorName;
  /** Recolor the selected lane/event, or just set the default color. */
  applyColor: (color: ColorName) => void;
  selectedLaneId: string | null;
  selectLane: (laneId: string | null) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /** Selection/edit state + callbacks for the main grid. */
  interaction: GridInteraction;
  /** Selection/edit state + callbacks for the weekly view. */
  weeklyInteraction: WeeklyInteraction;

  // Lane management (settings panel + both views).
  renameLane: (id: string, label: string) => void;
  setLaneColor: (id: string, color: ColorName) => void;
  /** Set / clear a lane's free-form markdown note (empty string clears). */
  setLaneNote: (id: string, note: string) => void;
  deleteLane: (id: string) => void;
  reorderLanes: (from: number, to: number) => void;
  addLane: () => void;
  /** Reset lanes to defaults and wipe all events + subtasks (undoable). */
  clearAll: () => void;

  /** Weekly drag: move a task to a lane/position/date-span in one update. */
  moveTask: (
    id: string,
    laneId: string,
    beforeTaskId: string | null,
    startISO: string,
    endISO: string,
  ) => void;
  /** Toolbar "Fit rows": reset manual row heights for the active view to auto. */
  fitRows: (view: ViewMode) => void;

  /** Toggle an event's completed state (dimmed + struck through). */
  toggleDone: (id: string) => void;
  /** Set / clear an event's free-form note (empty string clears). */
  setNote: (id: string, note: string) => void;
  /** Record that an event now exists in the app's Google Calendar. */
  markPushed: (id: string, pushed: { calendarId: string; eventId: string }) => void;

  /**
   * Replace the whole document with a board loaded from account storage.
   * Clears the undo history and selection (the old entities may not exist).
   */
  replaceDoc: (next: Doc) => void;
}

/** Normalize a dragged [start, end] so start <= end. */
const orderRange = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);

/**
 * Owns the app's data document (lanes / events / subtasks) plus all selection
 * and inline-editing state, and exposes the mutation handlers the views need.
 *
 * The document is one undoable unit, mirrored to localStorage. Ctrl+Z / Ctrl+Y
 * walk the history; hydration and "clear all data" go through `reset`/`commit`.
 * Single-slice mutations record one history step each; multi-slice changes
 * (e.g. deleting a lane + its events) commit once so they undo as one action.
 */
export function useGanttController(): GanttController {
  const persistDoc = useCallback((d: Doc) => {
    saveLanes(d.lanes);
    saveEvents(d.events);
    saveSubtasks(d.subtasks);
  }, []);
  const { doc, commit, reset, undo, redo, canUndo, canRedo } = useHistory(
    { lanes: [], events: [], subtasks: [] },
    persistDoc,
  );
  const { lanes, events: manualEvents, subtasks } = doc;

  // Direct-manipulation state (spreadsheet-style editing).
  const [activeColor, setActiveColor] = useState<ColorName>("sky");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [subEditing, setSubEditing] = useState<SubtaskEditTarget | null>(null);
  // A just-drawn event that's being titled but not yet committed to the
  // document (so an aborted create leaves nothing behind and never enters the
  // undo history).
  const [draftEvent, setDraftEvent] = useState<Event | null>(null);

  // Hydrate client-only data after mount (avoids SSR/localStorage mismatch).
  // Loading is not undoable, so use reset (clears the history stacks).
  useEffect(() => {
    reset({ lanes: loadLanes(), events: loadEvents(), subtasks: loadSubtasks() });
  }, [reset]);

  // Adopt a board loaded from account storage: not undoable (reset), but
  // persisted locally so localStorage mirrors the synced copy.
  const replaceDoc = useCallback(
    (next: Doc) => {
      const adopted = { ...next, lanes: pinLifeLast(next.lanes) };
      reset(adopted);
      persistDoc(adopted);
      setSelectedEventId(null);
      setSelectedLaneId(null);
      setEditingEventId(null);
      setSubEditing(null);
      setDraftEvent(null);
    },
    [reset, persistDoc],
  );

  const persistEvents = (next: Event[]) => commit({ ...doc, events: next });
  const persistSubtasks = (next: Subtask[]) => commit({ ...doc, subtasks: next });
  const persistLanes = (next: SwimLane[]) => commit({ ...doc, lanes: pinLifeLast(next) });

  // ---- Events (main grid) ----

  // Draw-to-create: make a blank draft event spanning the dragged days and drop
  // straight into title editing. It isn't persisted until a title is committed.
  const createEvent = (laneId: string, startISO: string, endISO: string) => {
    const [start, end] = orderRange(startISO, endISO);
    const id = newId();
    setDraftEvent({ id, laneId, title: "", start, end, color: activeColor, source: "manual" });
    setSelectedEventId(id);
    setSelectedLaneId(null);
    setEditingEventId(id);
  };

  const commitEdit = (id: string, title: string) => {
    const name = title.trim();
    setEditingEventId(null);
    // Committing a freshly-drawn draft: only now does it become a real event
    // (one history step). An empty title means the draw was abandoned.
    if (draftEvent && id === draftEvent.id) {
      const draft = draftEvent;
      setDraftEvent(null);
      if (name) {
        persistEvents([...manualEvents, { ...draft, title: name }]);
        setSelectedEventId(id);
      } else {
        setSelectedEventId((cur) => (cur === id ? null : cur));
      }
      return;
    }
    if (!name) {
      // Clearing the text deletes the event (like emptying a cell).
      persistEvents(manualEvents.filter((e) => e.id !== id));
      setSelectedEventId((cur) => (cur === id ? null : cur));
      return;
    }
    persistEvents(manualEvents.map((e) => (e.id === id ? { ...e, title: name } : e)));
  };

  // Abort an inline edit. If it was an uncommitted draft, discard it.
  const cancelEdit = () => {
    setEditingEventId(null);
    if (draftEvent) {
      setSelectedEventId((cur) => (cur === draftEvent.id ? null : cur));
      setDraftEvent(null);
    }
  };

  const deleteEvent = (id: string) => {
    persistEvents(manualEvents.filter((e) => e.id !== id));
    setSelectedEventId((cur) => (cur === id ? null : cur));
    setEditingEventId(null);
  };

  const resizeEvent = (id: string, startISO: string, endISO: string) => {
    const [start, end] = orderRange(startISO, endISO);
    persistEvents(manualEvents.map((e) => (e.id === id ? { ...e, start, end } : e)));
  };

  // Keyboard nudge: arrows shift the whole event ±1 day; Shift+arrows grow /
  // shrink it by moving the end date (never below the start).
  const nudgeEvent = (id: string, days: 1 | -1, resize: boolean) => {
    const ev = manualEvents.find((e) => e.id === id);
    if (!ev) return;
    if (resize) {
      const end = shiftISODate(ev.end, days);
      if (end < ev.start) return;
      persistEvents(manualEvents.map((e) => (e.id === id ? { ...e, end } : e)));
    } else {
      persistEvents(
        manualEvents.map((e) =>
          e.id === id
            ? { ...e, start: shiftISODate(e.start, days), end: shiftISODate(e.end, days) }
            : e,
        ),
      );
    }
  };

  const moveEvent = (id: string, laneId: string, startISO: string, endISO: string) => {
    persistEvents(
      manualEvents.map((e) => (e.id === id ? { ...e, laneId, start: startISO, end: endISO } : e)),
    );
    setSelectedEventId(id);
  };

  // Move a task (weekly drag): change its lane, vertical position, and/or dates
  // in one update. `beforeTaskId` is the task to insert it ahead of within the
  // target lane (null = append). Order is encoded by array position.
  const moveTask = (
    id: string,
    laneId: string,
    beforeTaskId: string | null,
    startISO: string,
    endISO: string,
  ) => {
    const moving = manualEvents.find((e) => e.id === id);
    if (!moving) return;
    const [start, end] = orderRange(startISO, endISO);
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

  const toggleDone = (id: string) =>
    persistEvents(manualEvents.map((e) => (e.id === id ? { ...e, done: !e.done } : e)));

  const setNote = (id: string, note: string) => {
    const text = note.trim();
    persistEvents(
      manualEvents.map((e) => (e.id === id ? { ...e, note: text || undefined } : e)),
    );
  };

  const markPushed = (id: string, pushed: { calendarId: string; eventId: string }) =>
    persistEvents(manualEvents.map((e) => (e.id === id ? { ...e, pushed } : e)));

  const selectEvent = (id: string) => {
    setSelectedEventId(id);
    setSelectedLaneId(null);
    setEditingEventId(null);
    // Reflect the selected event's color in the toolbar.
    const ev = manualEvents.find((e) => e.id === id);
    if (ev?.color) setActiveColor(ev.color);
  };

  // Select a swim lane (so the Fill swatches recolor it). null clears.
  const selectLane = (id: string | null) => {
    setSelectedLaneId(id);
    if (id) {
      setSelectedEventId(null);
      setEditingEventId(null);
      const lane = lanes.find((l) => l.id === id);
      if (lane) setActiveColor(lane.color);
    }
  };

  // Color toolbar: recolor whichever is selected (lane wins over event), and set
  // the default color for the next created event.
  const applyColor = (color: ColorName) => {
    setActiveColor(color);
    if (selectedLaneId) {
      setLaneColor(selectedLaneId, color);
    } else if (selectedEventId) {
      persistEvents(
        manualEvents.map((e) => (e.id === selectedEventId ? { ...e, color } : e)),
      );
    }
  };

  // ---- Subtasks (weekly view) ----

  const addSubtask = (taskId: string, date: string, title: string) => {
    const name = title.trim();
    if (!name) return;
    persistSubtasks([...subtasks, { id: newId(), taskId, date, title: name, done: false }]);
  };

  const commitEditSubtask = (id: string, title: string) => {
    const name = title.trim();
    setSubEditing(null);
    if (!name) {
      persistSubtasks(subtasks.filter((s) => s.id !== id));
      return;
    }
    persistSubtasks(subtasks.map((s) => (s.id === id ? { ...s, title: name } : s)));
  };

  // Fixed weekly-row height for a task (drag its bottom edge). 0 = back to auto.
  const setTaskHeight = (id: string, height: number) =>
    persistEvents(
      manualEvents.map((e) =>
        e.id === id ? { ...e, rowHeight: height > 0 ? Math.round(height) : undefined } : e,
      ),
    );

  // ---- Swim-lane management ----

  const renameLane = (id: string, label: string) =>
    persistLanes(lanes.map((l) => (l.id === id ? { ...l, label } : l)));

  const setLaneColor = (id: string, color: ColorName) =>
    persistLanes(lanes.map((l) => (l.id === id ? { ...l, color } : l)));

  const setLaneNotes = (id: string, notes: string[]) =>
    persistLanes(lanes.map((l) => (l.id === id ? { ...l, notes } : l)));

  // The lane's free-form markdown note (edited in the Notes panel). Empty clears.
  const setLaneNote = (id: string, note: string) => {
    const text = note.trim();
    persistLanes(lanes.map((l) => (l.id === id ? { ...l, note: text || undefined } : l)));
  };

  // Fixed row height for a main-view lane (drag its bottom edge). 0 = back to auto.
  const setLaneHeight = (id: string, height: number) =>
    persistLanes(
      lanes.map((l) =>
        l.id === id ? { ...l, rowHeight: height > 0 ? Math.round(height) : undefined } : l,
      ),
    );

  const fitRows = (view: ViewMode) => {
    if (view === "weekly") persistEvents(manualEvents.map((e) => ({ ...e, rowHeight: undefined })));
    else persistLanes(lanes.map((l) => ({ ...l, rowHeight: undefined })));
  };

  const deleteLane = (id: string) => {
    const target = lanes.find((l) => l.id === id);
    if (!target || isLifeLane(target)) return; // Life lane is locked.
    // Drop the lane and cascade-remove its events in one commit, so a single
    // undo restores both.
    commit({
      ...doc,
      lanes: pinLifeLast(lanes.filter((l) => l.id !== id)),
      events: manualEvents.filter((e) => e.laneId !== id),
    });
    setSelectedLaneId((cur) => (cur === id ? null : cur));
  };

  const clearAll = () => {
    commit({ lanes: DEFAULT_LANES, events: [], subtasks: [] });
    setSelectedEventId(null);
    setSelectedLaneId(null);
    setEditingEventId(null);
    setSubEditing(null);
  };

  const reorderLanes = (from: number, to: number) => {
    if (to < 0 || to >= lanes.length || from === to) return;
    const next = [...lanes];
    const [moved] = next.splice(from, 1);
    if (isLifeLane(moved)) return; // can't move the locked lane
    next.splice(to, 0, moved);
    persistLanes(next);
  };

  const addLane = () => {
    // pinLifeLast keeps the Life lane at the end after insertion.
    persistLanes([...lanes, { id: newId(), label: "New Lane", color: "graytone", notes: [] }]);
  };

  // Keyboard: Ctrl+Z / Ctrl+Y undo/redo; Escape clears selection/edit;
  // Delete/Backspace removes the selected event (unless focus is in a text field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      // Skip undo/redo while typing so the browser's native text undo still
      // works inside inputs.
      if ((e.ctrlKey || e.metaKey) && !typing) {
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
          return;
        }
        if (key === "y" || (key === "z" && e.shiftKey)) {
          e.preventDefault();
          redo();
          return;
        }
      }
      if (e.key === "Escape") {
        setEditingEventId(null);
        setSelectedEventId(null);
        setSelectedLaneId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && !typing && selectedEventId) {
        e.preventDefault();
        deleteEvent(selectedEventId);
      } else if (
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        !typing &&
        selectedEventId &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        nudgeEvent(selectedEventId, e.key === "ArrowRight" ? 1 : -1, e.shiftKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, doc, undo, redo]);

  const interaction: GridInteraction = {
    selectedEventId,
    selectedLaneId,
    onSelectLane: selectLane,
    editingEventId,
    onStartEdit: setEditingEventId,
    onSelect: selectEvent,
    onCreateEvent: createEvent,
    onCommitEdit: commitEdit,
    onCancelEdit: cancelEdit,
    onResize: resizeEvent,
    onMoveEvent: moveEvent,
    onDelete: deleteEvent,
    onRenameLane: renameLane,
    onSetLaneNotes: setLaneNotes,
    onReorderLanes: reorderLanes,
    onSetLaneHeight: setLaneHeight,
    onAddLane: addLane,
    onDeleteLane: deleteLane,
  };

  const weeklyInteraction: WeeklyInteraction = {
    editing: subEditing,
    selectedTaskId: selectedEventId,
    onSelectTask: selectEvent,
    onSetTaskHeight: setTaskHeight,
    onStartNew: (taskId, date) => setSubEditing({ kind: "new", taskId, date }),
    onStartEdit: (subtaskId) => setSubEditing({ kind: "sub", subtaskId }),
    onCommitNew: (taskId, date, title) => {
      setSubEditing(null);
      addSubtask(taskId, date, title);
    },
    onAddSubtask: addSubtask,
    onCommitEdit: commitEditSubtask,
    onCancelEdit: () => setSubEditing(null),
    onToggle: (id) =>
      persistSubtasks(subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s))),
    onDelete: (id) => persistSubtasks(subtasks.filter((s) => s.id !== id)),
  };

  return {
    lanes,
    manualEvents,
    subtasks,
    draftEvent,
    activeColor,
    applyColor,
    selectedLaneId,
    selectLane,
    undo,
    redo,
    canUndo,
    canRedo,
    interaction,
    weeklyInteraction,
    renameLane,
    setLaneColor,
    setLaneNote,
    deleteLane,
    reorderLanes,
    addLane,
    clearAll,
    moveTask,
    fitRows,
    toggleDone,
    setNote,
    markPushed,
    replaceDoc,
  };
}
