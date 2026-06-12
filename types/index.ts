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
   * Raw hex fill for GCal events — the event's own Google color, falling back
   * to its calendar's color. Takes precedence over `color` when rendering.
   */
  gcalColor?: string;
  /**
   * True for GCal events from calendars the user can't write to (birthdays,
   * holidays, subscriptions) — they stay read-only even when signed in.
   */
  gcalReadOnly?: boolean;
  /**
   * Optional fixed height in px for this task's row in the weekly view (set by
   * dragging its bottom edge); taller content scrolls. Undefined = auto.
   */
  rowHeight?: number;
  /** Marks the event completed (rendered dimmed + struck through). */
  done?: boolean;
  /** Free-form note, shown in the tooltip and the toolbar note editor. */
  note?: string;
  /** Set once the event has been pushed to the app's Google Calendar. */
  pushed?: { calendarId: string; eventId: string };
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
  /** Free-form markdown note for the lane (edited in the Notes panel). */
  note?: string;
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

/** Which top-level view is active ("split" stacks weekly under the timeline). */
export type ViewMode = "main" | "weekly" | "split";

/** The user's whole board — the same shape as the undoable document. */
export interface BoardDoc {
  lanes: SwimLane[];
  events: Event[];
  subtasks: Subtask[];
}

/** A board as persisted to account storage (Drive / database). */
export interface StoredBoard {
  doc: BoardDoc;
  /** Epoch ms of the save, for last-write-wins reconciliation. */
  updatedAt: number;
}

/** Where the signed-in user's board is persisted server-side. */
export type BoardBackend = "drive" | "kv";

/** Shape returned by GET /api/board. */
export interface BoardApiResponse {
  board: StoredBoard | null;
  backend: BoardBackend;
}

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
  /** Event whose title is being edited inline, if any. */
  editingEventId: string | null;
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
  /** Commit an edited title (empty title deletes the event). */
  onCommitEdit: (eventId: string, title: string) => void;
  /** Abort the current inline edit without saving. */
  onCancelEdit: () => void;
  /** Select the event and open its note editor (double-click the note badge). */
  onOpenNote: (eventId: string) => void;
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
