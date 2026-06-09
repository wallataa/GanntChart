"use client";

import { useState } from "react";
import type { ColorName, SwimLane } from "@/types";
import { COLOR_NAMES, PALETTE } from "@/lib/colors";
import { isLifeLane } from "@/lib/lanes";
import { GripIcon, LockIcon, XIcon } from "./icons";

interface LaneManagerProps {
  lanes: SwimLane[];
  onRename: (id: string, label: string) => void;
  onSetColor: (id: string, color: ColorName) => void;
  onDelete: (id: string) => void;
  /** Move the lane at `from` to index `to` (locked Life lane is re-pinned last). */
  onReorder: (from: number, to: number) => void;
  onAdd: () => void;
}

/**
 * Swim-lane management for the SettingsPanel:
 *  - rename (inline text input)
 *  - recolor (palette swatches)
 *  - reorder via drag-and-drop or ▲/▼ buttons
 *  - delete
 *  - add a new lane
 *
 * The Life lane is locked: it can't be deleted, dragged, or moved past the last
 * position.
 */
export default function LaneManager({
  lanes,
  onRename,
  onSetColor,
  onDelete,
  onReorder,
  onAdd,
}: LaneManagerProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [colorEditId, setColorEditId] = useState<string | null>(null);

  // Index of the last reorderable (non-Life) lane.
  const lastMovable = lanes.reduce((acc, l, i) => (isLifeLane(l) ? acc : i), -1);

  const handleDrop = (to: number) => {
    if (dragIndex === null || dragIndex === to) return;
    // Never allow dropping onto/after the locked Life lane.
    const target = isLifeLane(lanes[to]) ? lastMovable : to;
    onReorder(dragIndex, target);
    setDragIndex(null);
  };

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {lanes.map((lane, i) => {
          const locked = isLifeLane(lane);
          return (
            <li
              key={lane.id}
              draggable={!locked}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => setDragIndex(null)}
              className={[
                "rounded border px-2 py-1.5",
                locked
                  ? "border-teal-200 bg-teal-50/40 dark:border-teal-900 dark:bg-teal-950/40"
                  : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900",
                dragIndex === i ? "opacity-50" : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-1.5">
                {/* Drag handle */}
                <span
                  className={[
                    "select-none text-neutral-400",
                    locked ? "cursor-not-allowed" : "cursor-grab",
                  ].join(" ")}
                  title={locked ? "Life lane is locked" : "Drag to reorder"}
                >
                  {locked ? <LockIcon className="h-3.5 w-3.5" /> : <GripIcon className="h-3.5 w-3.5" />}
                </span>

                {/* Color swatch toggle */}
                <button
                  type="button"
                  onClick={() => setColorEditId(colorEditId === lane.id ? null : lane.id)}
                  className="h-4 w-4 shrink-0 rounded-sm border border-black/10"
                  style={{ backgroundColor: PALETTE[lane.color] }}
                  title="Change color"
                  aria-label={`Change color for ${lane.label}`}
                />

                {/* Rename */}
                <input
                  type="text"
                  value={lane.label}
                  onChange={(e) => onRename(lane.id, e.target.value)}
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-neutral-200 focus:border-blue-400 focus:bg-white focus:outline-none dark:hover:border-neutral-700 dark:focus:bg-neutral-800"
                />

                {/* Reorder buttons (accessible fallback to drag) */}
                {!locked && (
                  <>
                    <button
                      type="button"
                      onClick={() => onReorder(i, i - 1)}
                      disabled={i === 0}
                      className="px-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:hover:text-neutral-200"
                      aria-label="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => onReorder(i, i + 1)}
                      disabled={i >= lastMovable}
                      className="px-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:hover:text-neutral-200"
                      aria-label="Move down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(lane.id)}
                      className="px-1 text-red-400 hover:text-red-600"
                      aria-label={`Delete ${lane.label}`}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Color palette (expanded) */}
              {colorEditId === lane.id && (
                <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
                  {COLOR_NAMES.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onSetColor(lane.id, name);
                        setColorEditId(null);
                      }}
                      title={name}
                      aria-label={name}
                      className={[
                        "h-5 w-5 rounded-full border",
                        lane.color === name
                          ? "ring-2 ring-neutral-800 ring-offset-1"
                          : "border-black/10",
                      ].join(" ")}
                      style={{ backgroundColor: PALETTE[name] }}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onAdd}
        className="w-full rounded border border-dashed border-neutral-300 px-2 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        + Add lane
      </button>
    </div>
  );
}
