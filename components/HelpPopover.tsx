"use client";

import { useState } from "react";
import { HelpIcon } from "./icons";

const SECTIONS: { title: string; items: [string, string][] }[] = [
  {
    title: "Timeline",
    items: [
      ["Create an event", "drag across empty days in a lane"],
      ["Rename / delete", "double-click an event (empty text deletes)"],
      ["Resize", "drag an event's left or right edge"],
      ["Move", "drag the event body (also across lanes)"],
      ["Recolor", "click an event or lane label, then a color swatch"],
      ["Rename a lane", "double-click its label"],
      ["Lane notes", "click the notes column to edit, one per line"],
    ],
  },
  {
    title: "Weekly",
    items: [
      ["Add a subtask", "double-click a task bar, or click under it"],
      ["Rapid entry", "Enter commits and starts the next subtask"],
      ["Reschedule", "drag a task bar sideways"],
      ["Move / reorder", "drag the grip at the row's left edge"],
    ],
  },
  {
    title: "Everywhere",
    items: [
      ["Reorder lanes", "drag a lane's grip handle"],
      ["Column width", "drag a column edge in the date header"],
      ["Row height", "drag a row's bottom edge (double-click resets)"],
      ["Undo / redo", "Ctrl+Z / Ctrl+Y"],
      ["Delete selection", "Delete or Backspace"],
      ["Clear selection", "Esc"],
    ],
  },
];

/** A "?" toolbar button revealing every gesture and keyboard shortcut. */
export default function HelpPopover() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          "flex h-7 w-7 items-center justify-center rounded border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800",
          open
            ? "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100"
            : "text-neutral-500 dark:text-neutral-400",
        ].join(" ")}
        title="Tips & shortcuts"
        aria-label="Tips and shortcuts"
        aria-expanded={open}
      >
        <HelpIcon />
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-neutral-200 bg-white p-3 text-xs shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
            {SECTIONS.map((section) => (
              <div key={section.title} className="mb-3 last:mb-0">
                <h3 className="mb-1 font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  {section.title}
                </h3>
                <dl className="space-y-0.5">
                  {section.items.map(([action, how]) => (
                    <div key={action} className="flex gap-2">
                      <dt className="w-28 shrink-0 font-medium text-neutral-700 dark:text-neutral-300">
                        {action}
                      </dt>
                      <dd className="text-neutral-500 dark:text-neutral-400">{how}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
