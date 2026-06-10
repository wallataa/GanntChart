"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { SwimLane } from "@/types";
import { isLifeLane, pinLifeLast } from "./lanes";
import { startDrag } from "./drag";

/** Pixels the pointer must travel before a click becomes a drag. */
export const DRAG_THRESHOLD = 4;

export interface LaneReorder {
  /** Register a lane's representative element (track / group) for hit-testing. */
  registerLane: (laneId: string, el: HTMLElement | null) => void;
  /** Attach to a lane's drag grip (pointerdown). No-op on the locked Life lane. */
  onLanePointerDown: (laneId: string, e: ReactPointerEvent) => void;
  /** Lanes in render order — the live preview order while dragging. */
  orderedLanes: SwimLane[];
  /** Id of the lane being dragged (for styling), if any. */
  draggingLaneId: string | null;
  /** The non-Life lane whose registered element contains clientY, if any. */
  laneAtY: (clientY: number) => { lane: SwimLane; rect: DOMRect } | null;
}

/**
 * Drag-to-reorder swim lanes, shared by the main grid and the weekly view.
 * Each lane registers one element (its track / group); the dragged lane is
 * re-inserted before the lane whose vertical midpoint the cursor is above,
 * with the locked Life lane pinned last. The preview order is local state;
 * the reorder commits on drop via `onReorderLanes`.
 *
 * The element registry doubles as the hit-test surface for other cross-lane
 * drags (e.g. moving an event), exposed via `laneAtY`.
 */
export function useLaneReorder(
  lanes: SwimLane[],
  onReorderLanes: (from: number, to: number) => void,
  /** Scrollable grid container, for edge auto-scroll while dragging. */
  scrollContainer?: () => HTMLElement | null | undefined,
): LaneReorder {
  const laneRefs = useRef<Map<string, HTMLElement>>(new Map());
  const registerLane = useCallback((laneId: string, el: HTMLElement | null) => {
    if (el) laneRefs.current.set(laneId, el);
    else laneRefs.current.delete(laneId);
  }, []);

  const [draggingLaneId, setDraggingLaneId] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
  const previewOrderRef = useRef<string[] | null>(null);
  previewOrderRef.current = previewOrder;

  const laneAtY = (clientY: number): { lane: SwimLane; rect: DOMRect } | null => {
    for (const lane of lanes) {
      if (isLifeLane(lane)) continue;
      const el = laneRefs.current.get(lane.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return { lane, rect };
    }
    return null;
  };

  // Build the lane id ordering for a reorder drag: remove the dragged lane and
  // insert it where the cursor sits (before the lane whose midpoint we're above),
  // keeping the locked Life lane pinned last.
  const orderForDrag = (dragId: string, clientY: number): string[] => {
    const others = lanes.filter((l) => l.id !== dragId);
    let insert = others.length;
    for (let i = 0; i < others.length; i++) {
      const el = laneRefs.current.get(others[i].id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) {
        insert = i;
        break;
      }
    }
    const dragged = lanes.find((l) => l.id === dragId)!;
    const next = [...others];
    next.splice(insert, 0, dragged);
    return pinLifeLast(next).map((l) => l.id);
  };

  const onLanePointerDown = (laneId: string, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const lane = lanes.find((l) => l.id === laneId);
    if (!lane || isLifeLane(lane)) return; // Life lane is locked.
    startDrag(e, {
      threshold: DRAG_THRESHOLD,
      scrollContainer,
      onActivate: () => setDraggingLaneId(laneId),
      onMove: (ev) => setPreviewOrder(orderForDrag(laneId, ev.clientY)),
      onUp: (_ev, activated) => {
        const order = previewOrderRef.current;
        if (activated && order) {
          const from = lanes.findIndex((l) => l.id === laneId);
          const to = order.indexOf(laneId);
          if (from !== -1 && to !== -1 && from !== to) onReorderLanes(from, to);
        }
        setDraggingLaneId(null);
        setPreviewOrder(null);
      },
      onCancel: () => {
        setDraggingLaneId(null);
        setPreviewOrder(null);
      },
    });
  };

  const orderedLanes: SwimLane[] = previewOrder
    ? (previewOrder.map((id) => lanes.find((l) => l.id === id)).filter(Boolean) as SwimLane[])
    : lanes;

  return { registerLane, onLanePointerDown, orderedLanes, draggingLaneId, laneAtY };
}
