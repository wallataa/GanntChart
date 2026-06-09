"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { startDrag } from "./drag";

export interface RowHeightDrag {
  /** Height to render right now: the live drag preview, else the committed value. */
  effHeight: number | undefined;
  /** Attach to the row's bottom-edge handle (pointerdown). */
  onResizeRow: (e: ReactPointerEvent) => void;
}

/**
 * Drag a row's bottom edge to set a fixed height. The live preview is local
 * state; only the final height is committed (one history step per drag).
 * Shared by the main view's lanes and the weekly task rows.
 */
export function useRowHeightDrag(
  committed: number | undefined,
  /** Fallback starting height when nothing is committed (e.g. the element's current height). */
  measure: () => number,
  onCommit: (height: number) => void,
  minHeight: number,
): RowHeightDrag {
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragHeightRef = useRef<number | null>(null);
  const effHeight = dragHeight ?? committed;

  const onResizeRow = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startY = e.clientY;
    const startH = effHeight ?? measure();
    startDrag(e, {
      onMove: (ev) => {
        const h = Math.max(minHeight, Math.round(startH + (ev.clientY - startY)));
        dragHeightRef.current = h;
        setDragHeight(h);
      },
      onUp: () => {
        if (dragHeightRef.current != null) onCommit(dragHeightRef.current);
        dragHeightRef.current = null;
        setDragHeight(null);
      },
    });
  };

  return { effHeight, onResizeRow };
}
