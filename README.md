# Gantt Chart App

A Google Sheets–style planning app (Next.js 14, App Router, TypeScript, Tailwind) with a
GCal-powered **Life** swim lane. It has two views:

- **Main view** — a multi-month Gantt of projects (swim lanes) and tasks (events), with
  spreadsheet-style direct editing.
- **Weekly view** — a 2-week board where each task becomes a sub-lane you can break down into
  per-day **subtask** checklists for day planning.

See [SPEC.md](SPEC.md) for the full design.

## Run the dev server

```bash
npm install      # already done if you cloned with node_modules
npm run dev      # http://localhost:3000
```

Other scripts: `npm run build` (production build), `npm start` (serve the build), `npm run lint`.

## Environment variables (`.env.local`)

Copy `.env.local.example` to `.env.local` and fill in real values:

```dotenv
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
NEXTAUTH_SECRET=<random 32-byte base64 string>
NEXTAUTH_URL=http://localhost:3000
```

Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32` (or `npx auth secret`).
Everything except the Google-Calendar-backed Life lane works **without** any of these.

## Google Cloud setup (for the Life lane)

1. Go to <https://console.cloud.google.com/> → create a project (e.g. "Gantt App").
2. **APIs & Services → Library** → search "Google Calendar API" → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - Fill app name + your email; add your Google account under **Test users** (required while the
     app is in "Testing").
   - Add scope `.../auth/calendar.readonly`.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. Copy the **Client ID** and **Client secret** into `.env.local`.
6. Restart `npm run dev`, open the app, click the ⚙️ gear → **Connect Google Calendar**.

## Using it

### Toolbar
- **Main | Weekly** view toggle.
- **‹ Today ›** — navigate the active view's window (1 week at a time; Today resets it).
- **Font − % +** — scale the grid text (applies to both views, persisted).
- **Day-column width** — drag the right edge of any column in the date header (both views, persisted).
- **Left-column widths** — drag the notes/label column edges in the header's top-left corner.
- **Fit rows** — reset row heights to fit content (main = lanes, weekly = task rows). Drag a row's
  bottom edge to set a height (taller content scrolls); double-click the edge to reset just that row.
- **Hide empty lanes** (weekly only) — hide lanes with no task in the fortnight. Persisted.
- **Fill** swatches (both views) — recolor the selected lane (click its label) or event/task, or set
  the color for the next event.
- **⚙️** — settings: Google sign-in, calendar toggles, and lane add/rename/reorder/delete.

### Main view (events behave like spreadsheet cells)
- **Click an empty cell** → type → Enter to create a single-day event.
- **Drag an event body** → move it across dates and/or into another lane.
- **Drag an event edge** → resize into a multi-day span.
- **Double-click** → rename. **Click** = select; **Delete/Backspace** removes; **Esc** deselects.
- **Drag a lane's bottom edge** → set its row height (taller content scrolls); double-click to reset.
- **Sidebar** is editable in place: click the lane label to rename, the notes area to edit
  (one note per line), and the `⠿` grip to drag-reorder the lane. The sidebar also shows an
  accumulated **to-do list** of the lane's subtasks (from the weekly view), grouped by task — each
  group is a collapsible toggle (▼/▶).

### Weekly view (day planning)
- Each swim lane's tasks appear as **sub-lanes**; a task shows if it overlaps the fortnight or
  already has a subtask in it. The date span is a colored bar with the title inside; the left column
  accumulates the task's to-do checklist.
- **Task bar:** click to select (recolor via Fill), drag sideways to reschedule and up/down to
  reorder / move lanes (updates the main view too), double-click to add a subtask.
- **Click a day cell** under a task → type a **subtask** → Enter adds it and opens the next one.
  Check the box to mark done; click text to rename; clear + Enter to delete.
- **Drag the `⠿` grip on a lane header** to reorder lanes; drag a task (its bar or the row grip)
  up/down to reorder it within its lane or move it to another lane.
- The **Life lane** renders like the main view — Google Calendar events packed into one stacked band
  of read-only colored bars (no subtasks).

## Persistence

Local data lives in `localStorage`; Google Calendar is fetched live.

| Key | Contents |
|-----|----------|
| `gantt:lanes` | Swim lanes (label, color, notes, order) |
| `gantt:events` | Manual events (the Life lane comes from GCal, not stored) |
| `gantt:subtasks` | Weekly-view subtasks |
| `gantt:colWidth` | Day-column width |
| `gantt:fontScale` | Grid font scale |
| `gantt:hideEmptyWeekly` | Hide empty lanes in the weekly view |
| `gantt:sbNotesW` / `gantt:sbLabelW` | Left-column widths |

## Project structure

```
app/
  layout.tsx, providers.tsx, page.tsx, globals.css
  api/auth/[...nextauth]/route.ts   # NextAuth Google OAuth
  api/calendar/route.ts             # GCal fetch + mapping
components/
  GanttGrid, DateHeader, SwimLane, EventBlock, Sidebar, SettingsPanel, LaneManager   # main view
  WeeklyView, WeeklyLane, TaskSubLane, SubtaskItem                                    # weekly view
lib/        dates.ts, lanes.ts, events.ts, subtasks.ts, colors.ts, auth.ts
types/      index.ts, next-auth.d.ts
```
