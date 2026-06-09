// Core domain types for the Gantt app.
// Dates are stored as ISO date strings (YYYY-MM-DD) so they survive localStorage
// round-trips and JSON API responses without timezone drift.

/** Keys into the SPEC.md color palette. */
export type ColorName =
  | "peach"
  | "salmon"
  | "rose"
  | "sky"
  | "mint"
  | "lemon"
  | "lavender"
  | "graytone";

/** A single Gantt event block. */
export interface Event {
  id: string;
  laneId: string;
  /** Short text shown inside the block. */
  title: string;
  /** Inclusive start date, ISO `YYYY-MM-DD`. */
  start: string;
  /** Inclusive end date, ISO `YYYY-MM-DD`. Single-day events have start === end. */
  end: string;
  /** Optional per-event color override; falls back to the lane color. */
  color?: ColorName;
  /** Where the event came from. Manual events are user-created and editable. */
  source: "manual" | "gcal";
  /** Original Google Calendar event id, when source === "gcal". */
  gcalId?: string;
  /**
   * Optional fixed height in px for this task's row in the weekly view (set by
   * dragging its bottom edge); taller content scrolls. Undefined = auto.
   */
  rowHeight?: number;
}

/** A horizontal band (project / category). */
export interface SwimLane {
  id: string;
  /** Display label, e.g. "July 4th Show". */
  label: string;
  /** Default fill color for events in this lane. */
  color: ColorName;
  /** Bullet-point notes / sub-tasks shown in the left sidebar. */
  notes: string[];
  /**
   * Optional fixed row height in px for the main view (set by dragging the
   * lane's bottom edge); content taller than this scrolls. Undefined = auto.
   */
  rowHeight?: number;
  /**
   * The "Life" lane is special: events come from Google Calendar and the lane
   * is locked (cannot be deleted or reordered past the last position).
   */
  isLifeLane?: boolean;
}

/** The visible date window. Both bounds inclusive. */
export interface DateRange {
  start: Date;
  end: Date;
}

/** A Google Calendar the user can toggle into the Life lane. */
export interface CalendarSource {
  id: string;
  summary: string;
  /** Whether this calendar feeds the Life lane. */
  enabled: boolean;
  primary?: boolean;
  backgroundColor?: string;
}

/** Shape returned by GET /api/calendar. */
export interface CalendarApiResponse {
  events: Event[];
  calendars: CalendarSource[];
}

/** Which top-level view is active. */
export type ViewMode = "main" | "weekly";

/** A per-day checklist item under a task (weekly view). */
export interface Subtask {
  id: string;
  /** Parent Event id (manual uuid, or the "gcal:calId:eventId" id). */
  taskId: string;
  /** ISO `YYYY-MM-DD`, single day. */
  date: string;
  title: string;
  done: boolean;
}

/** What's currently being text-edited inline in the grid. */
export type EditTarget =
  | { kind: "new"; laneId: string; date: string }
  | { kind: "event"; eventId: string };

/** What's currently being text-edited in the weekly view. */
export type SubtaskEditTarget =
  | { kind: "new"; taskId: string; date: string }
  | { kind: "sub"; subtaskId: string };

/** Selection/edit state + callbacks for the weekly day-planning view. */
export interface WeeklyInteraction {
  editing: SubtaskEditTarget | null;
  /** Currently selected task (for recolor via the toolbar Fill swatches). */
  selectedTaskId: string | null;
  /** Select a task (manual tasks only; GCal tasks are read-only). */
  onSelectTask: (taskId: string) => void;
  /** Set a task's fixed weekly row height in px (0 / undefined = auto). */
  onSetTaskHeight: (taskId: string, height: number) => void;
  /** Begin typing a new subtask in a task's day cell. */
  onStartNew: (taskId: string, date: string) => void;
  /** Begin editing an existing subtask's title. */
  onStartEdit: (subtaskId: string) => void;
  /** Commit a new subtask's title (empty title cancels). */
  onCommitNew: (taskId: string, date: string, title: string) => void;
  /** Append a subtask but keep the input open for rapid entry (Enter). */
  onAddSubtask: (taskId: string, date: string, title: string) => void;
  /** Commit an edited title (empty title deletes the subtask). */
  onCommitEdit: (subtaskId: string, title: string) => void;
  onCancelEdit: () => void;
  onToggle: (subtaskId: string) => void;
  onDelete: (subtaskId: string) => void;
}

export type ResizeEdge = "start" | "end";

/**
 * Bundle of selection/edit state + callbacks threaded down to the grid so cells
 * behave like a spreadsheet (click to type, drag edges to span days, etc.).
 */
export interface GridInteraction {
  selectedEventId: string | null;
  /** Selected swim lane (for recolor via the toolbar Fill swatches). */
  selectedLaneId: string | null;
  /** Select a swim lane (click its label cell); null clears the selection. */
  onSelectLane: (laneId: string | null) => void;
  editing: EditTarget | null;
  /** Begin creating an event by typing into an empty cell. */
  onStartNew: (laneId: string, date: string) => void;
  /**
   * Create a blank event spanning [startISO, endISO] (drawn by dragging across
   * empty cells) and immediately put it into title-edit mode. The block is a
   * transient draft until a non-empty title is committed.
   */
  onCreateEvent: (laneId: string, startISO: string, endISO: string) => void;
  /** Begin editing an existing event's title. */
  onStartEdit: (eventId: string) => void;
  /** Select an event (for recolor / resize). */
  onSelect: (eventId: string) => void;
  /** Commit a new event's typed title (empty title cancels). */
  onCommitNew: (laneId: string, date: string, title: string) => void;
  /** Commit an edited title (empty title deletes the event). */
  onCommitEdit: (eventId: string, title: string) => void;
  /** Abort the current inline edit without saving. */
  onCancelEdit: () => void;
  /** Resize an event to a new inclusive [start, end] range. */
  onResize: (eventId: string, startISO: string, endISO: string) => void;
  /** Move an event to a new lane and/or date range (drag the body). */
  onMoveEvent: (eventId: string, laneId: string, startISO: string, endISO: string) => void;
  onDelete: (eventId: string) => void;
  /** Rename a lane from the sidebar. */
  onRenameLane: (id: string, label: string) => void;
  /** Replace a lane's sidebar notes (one per line). */
  onSetLaneNotes: (id: string, notes: string[]) => void;
  /** Reorder lanes by moving the lane at `from` to index `to`. */
  onReorderLanes: (from: number, to: number) => void;
  /** Set a lane's fixed row height in px (0 / undefined = auto). */
  onSetLaneHeight: (id: string, height: number) => void;
  /** Append a new swim lane (inserted before the locked Life lane). */
  onAddLane: () => void;
  /** Delete a lane and cascade-remove its events (Life lane is locked). */
  onDeleteLane: (id: string) => void;
}
