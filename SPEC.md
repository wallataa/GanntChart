# Gantt Chart App — Project Spec

## Overview
A web-based planning app that mirrors a Google Sheets–style layout, with a bottom "Life" swim lane
that pulls events automatically from Google Calendar via OAuth. It has two views that share the
same swim lanes and data:

- **Main view** — a multi-month Gantt of projects (swim lanes) and tasks (events).
- **Weekly view** — a 2-week board where each task becomes a sub-lane broken down into per-day
  **subtask** checklists for day planning.

---

## Views & Toolbar

A toolbar sits above the grid in both views:

- **Main | Weekly** toggle.
- **Prev / Today / Next** navigation — shifts the active view's window by one week; "Today" resets.
  Navigation plays a directional slide animation (respects `prefers-reduced-motion`).
- **Font size** control (− / % / +) — scales the grid text in both views, 80–180%, persisted to
  `localStorage` (applied via the `--fs` CSS variable).
- **Day-column width** — resized directly by **dragging the right edge of any column** in the date
  header (28–120px, persisted to `localStorage`); no toolbar slider.
- **Max row** control (− / value / +) — caps **weekly** row height at 80–800px (or **Off**); rows
  whose content is taller scroll within the cap. Persisted (`--max-row-h` CSS variable). (In the
  **main** view, row height is set per-lane by dragging the lane's bottom edge instead.)
- **Hide empty lanes** toggle (*weekly view only*) — hides swim lanes with no task/event in the
  visible fortnight. Persisted.
- **Fill** color swatches — *both views*. Recolors the currently selected **lane** (click a lane's
  label cell) or **event/task**; with nothing selected, sets the color for the next created event.
- **⚙️ Settings** — Google sign-in/out, calendar toggles, and swim-lane management.

---

## Layout (both views)

### Header
- **Month row**: Grouped month labels spanning the correct number of day columns.
- **Day-of-week row**: Abbreviated day names (Mon, Tue, Weds, Thurs, Fri, Sat, Sun).
- **Date number row**: Numeric date aligned under each day column.
- Weekends (Sat/Sun) get a light gray column tint; today's column is highlighted.
- The header is sticky on vertical scroll; the left sidebar is sticky on horizontal scroll.

### Left sidebar
- **Column A** (notes): Bullet task notes, editable in place. In the main view it also shows an
  accumulated **to-do list** of the lane's subtasks (from the weekly view), grouped by task, with
  live checkboxes.
- **Column B** (label): Swim lane label. **Click** selects the lane (so the Fill swatches recolor
  it); **double-click** renames it in place. A `⠿` grip drags the lane to reorder it.
- Each lane is tinted by its color in **both** views — a light wash on the row/track and a stronger
  wash behind the lane label — so the swim lanes read consistently across the main and weekly views.

---

## Swim Lanes (initial set)

| Lane | Notes / Sub-tasks | Color |
|------|-------------------|-------|
| July 4th Show | Story board show, Figure out sound ideas, Make prelim dj set, Real time phone research, Lighting debug | Peach/salmon |
| Floating Points Install | (none) | Salmon/red |
| Web Clat | publish ambient set, publish emptyset, publish win95 | Light blue |
| General Todos | Remake websites | Light gray |
| Screenprint | Buy more shirts, Make more designs, Buy camis, underwear for hot for eggs | Light yellow |
| Film Festival | (none) | Pink/rose |
| Poster for Ushara | (none) | Salmon |
| Open Calls | (none) | Light gray |
| **Life** | *(auto-populated from Google Calendar)* | Light teal |

Swim lanes are reorderable, renamable, recolorable, addable, and deletable — from the settings
panel and (reorder) by dragging the sidebar grip in either view. The **Life** lane is locked: it
can't be deleted or moved off the last position.

---

## Main View

### Event blocks (tasks)
- Colored filled rectangles spanning from start date to end date column; short label centered inside.
- Multi-day events span columns; overlapping events stack vertically within a lane.
- Color is per-event (falling back to the lane color).

### Direct manipulation (spreadsheet-style)
- **Click an empty cell** → inline input → Enter creates a single-day event in that lane/date.
- **Drag an event body** → move it across dates and/or into another lane (4px drag threshold so a
  plain click still selects).
- **Drag either edge** → resize into a multi-day span.
- **Double-click** → rename inline; clearing the text deletes the event.
- **Click** selects; **Delete/Backspace** removes the selection; **Esc** cancels/deselects.
- **Drag a lane's bottom edge** → set that lane's row height; taller content scrolls within it.
  Double-click the edge to reset to auto. Persisted per lane (`rowHeight`).
- GCal (Life lane) events are read-only.

### Date range
- Default view: current month + next month (~8 weeks visible), horizontal scroll for the rest.

---

## Weekly View

A two-week (14-day) window for day planning.

- Each swim lane renders a header band followed by its **tasks as sub-lanes**. A task appears if its
  date range overlaps the visible fortnight **OR** it has a subtask dated within the window.
- Each task's date span is drawn as a **colored bar** on its own line with the **title written inside
  it**, followed below by the per-day subtask cells. (When a task is kept in view only by an
  out-of-window subtask and has no visible bar, its title falls back to the sidebar.)
- **Task bar (manual tasks):** **click** selects it (so the Fill swatches recolor it); **drag** it —
  sideways to reschedule its dates, up/down to reorder within its lane or move it to another lane
  (all reflected in the main view); **double-click** to add a subtask on the clicked day.
- The left column shows the task title heading and accumulates its whole **to-do list** (subtasks,
  with live checkboxes).
- **Subtasks** are per-day checklist items (`title` + `done`) that stack within a day cell. Click an
  empty day under a task → type → **Enter** adds it and opens the next input. Checkbox toggles done
  (strikethrough); click text to rename; clear + Enter deletes; Esc cancels. (No `+` buttons.)
- **Reorganize:** drag the `⠿` grip on a lane header to reorder lanes; drag a task (its bar, or the
  row grip) up/down to reorder it within its lane or move it to another lane.
- The **Life** lane renders like the main view: its GCal events are packed into a single stacked band
  of read-only colored bars — **no subtasks**, no per-event rows.

---

## Google Calendar Integration

### Auth
- Google OAuth 2.0 via `next-auth` + `googleapis`, scope `.../auth/calendar.readonly`.
- Credentials in `.env.local` (never committed): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. JWT session with access-token refresh.

### Data flow
1. On load / date navigation, `/api/calendar` fetches GCal events for the visible range.
2. Each event maps to the Life lane: `summary` → label; `start`/`end` → columns (all-day end dates
   are exclusive, so 1 day is subtracted).
3. A "syncing" indicator shows while fetching.

### Multiple calendars
- Defaults to the primary calendar; the settings panel toggles which calendars feed the Life lane
  (fetched from `calendarList`).

---

## Color Palette (per swim lane / event)

Soft, desaturated fills similar to the Google Sheets original:

| Name | Hex | Name | Hex |
|------|-----|------|-----|
| Peach | `#FBCFB0` | Mint | `#A8E6D0` |
| Salmon | `#F4A79D` | Lemon | `#FAF09E` |
| Rose | `#F2A7B8` | Lavender | `#D5C5F0` |
| Sky | `#B3D9F5` | Gray | `#DDDBD5` |

---

## Persistence

Local data is in `localStorage`; Google Calendar is fetched live (not stored).

| Key | Contents |
|-----|----------|
| `gantt:lanes` | Swim lanes (label, color, notes, order, `rowHeight`) |
| `gantt:events` | Manual events |
| `gantt:subtasks` | Weekly-view subtasks (`taskId`, `date`, `title`, `done`) |
| `gantt:colWidth` | Day-column width |
| `gantt:fontScale` | Grid font scale (0.8–1.8) |
| `gantt:maxRowHeight` | Max weekly row height in px (0 = off) |
| `gantt:hideEmptyWeekly` | Hide empty lanes in the weekly view (`"1"`/`"0"`) |

---

## Known behaviors / future work
- A task fully outside the visible fortnight with no subtasks won't appear in the weekly view until
  you navigate to a window it overlaps.
- Manual task order within a lane is encoded by event array position (`gantt:events` order), set by
  dragging the row grip.
- The Life lane in the weekly view relies on the main-view fetch range; navigating the weekly window
  far past the main range may show an empty Life lane until that span is visited in the main view.
- Not yet implemented: dragging subtasks between days.
