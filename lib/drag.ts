/**
 * Shared pointer-drag helper. Attaches window `pointermove` / `pointerup`
 * listeners (cleaned up on release) so call sites don't re-implement the dance.
 *
 * With a `threshold`, the drag only "activates" once the pointer moves past it;
 * `onMove` then fires only while active, `onActivate` fires once, and `onUp`
 * receives whether the gesture activated (so a sub-threshold release can be
 * treated as a click).
 *
 * With a `scrollContainer`, the container edge-auto-scrolls while the active
 * pointer hovers near its edges, and `onMove` is re-fired with the last pointer
 * event after each scroll step so previews keep tracking the (now shifted)
 * content under the cursor.
 */
export interface DragOptions {
  threshold?: number;
  onActivate?: () => void;
  onMove?: (e: PointerEvent) => void;
  onUp?: (e: PointerEvent, activated: boolean) => void;
  /**
   * The browser claimed the gesture (pointercancel — e.g. a touch turned into
   * a scroll). Discard any preview state; onUp is NOT called.
   */
  onCancel?: () => void;
  /** Scrollable ancestor to edge-auto-scroll during the drag. */
  scrollContainer?: () => HTMLElement | null | undefined;
}

/** Distance from a container edge (px) where auto-scroll kicks in. */
const SCROLL_EDGE = 36;
/** Max scroll speed in px per frame (scales with proximity to the edge). */
const SCROLL_MAX_SPEED = 14;

/** Speed for one axis: 0 outside the edge zones, scaling up toward the edge. */
function axisSpeed(pos: number, min: number, max: number): number {
  if (pos < min + SCROLL_EDGE) {
    return -Math.ceil(((min + SCROLL_EDGE - pos) / SCROLL_EDGE) * SCROLL_MAX_SPEED);
  }
  if (pos > max - SCROLL_EDGE) {
    return Math.ceil(((pos - (max - SCROLL_EDGE)) / SCROLL_EDGE) * SCROLL_MAX_SPEED);
  }
  return 0;
}

export function startDrag(
  start: { clientX: number; clientY: number },
  { threshold = 0, onActivate, onMove, onUp, onCancel, scrollContainer }: DragOptions,
): void {
  const startX = start.clientX;
  const startY = start.clientY;
  let activated = threshold === 0;
  let lastMove: PointerEvent | null = null;
  let rafId = 0;

  // Edge auto-scroll loop: runs every frame while the drag is active, scrolling
  // the container when the pointer sits in an edge zone and replaying onMove so
  // the drop target / preview recomputes against the shifted content.
  const autoScrollTick = () => {
    rafId = requestAnimationFrame(autoScrollTick);
    const el = scrollContainer?.();
    if (!el || !lastMove || !activated) return;
    const rect = el.getBoundingClientRect();
    const dx = axisSpeed(lastMove.clientX, rect.left, rect.right);
    const dy = axisSpeed(lastMove.clientY, rect.top, rect.bottom);
    if (!dx && !dy) return;
    const beforeLeft = el.scrollLeft;
    const beforeTop = el.scrollTop;
    el.scrollLeft += dx;
    el.scrollTop += dy;
    if (el.scrollLeft !== beforeLeft || el.scrollTop !== beforeTop) onMove?.(lastMove);
  };

  const move = (e: PointerEvent) => {
    if (!activated) {
      if (Math.abs(e.clientX - startX) < threshold && Math.abs(e.clientY - startY) < threshold) {
        return;
      }
      activated = true;
      onActivate?.();
    }
    lastMove = e;
    onMove?.(e);
  };
  const cleanup = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", cancel);
    if (rafId) cancelAnimationFrame(rafId);
  };
  const up = (e: PointerEvent) => {
    cleanup();
    onUp?.(e, activated);
  };
  const cancel = () => {
    cleanup();
    onCancel?.();
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", cancel);
  if (scrollContainer) rafId = requestAnimationFrame(autoScrollTick);
}
