/**
 * Shared pointer-drag helper. Attaches window `pointermove` / `pointerup`
 * listeners (cleaned up on release) so call sites don't re-implement the dance.
 *
 * With a `threshold`, the drag only "activates" once the pointer moves past it;
 * `onMove` then fires only while active, `onActivate` fires once, and `onUp`
 * receives whether the gesture activated (so a sub-threshold release can be
 * treated as a click).
 */
export interface DragOptions {
  threshold?: number;
  onActivate?: () => void;
  onMove?: (e: PointerEvent) => void;
  onUp?: (e: PointerEvent, activated: boolean) => void;
}

export function startDrag(
  start: { clientX: number; clientY: number },
  { threshold = 0, onActivate, onMove, onUp }: DragOptions,
): void {
  const startX = start.clientX;
  const startY = start.clientY;
  let activated = threshold === 0;

  const move = (e: PointerEvent) => {
    if (!activated) {
      if (Math.abs(e.clientX - startX) < threshold && Math.abs(e.clientY - startY) < threshold) {
        return;
      }
      activated = true;
      onActivate?.();
    }
    onMove?.(e);
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener("pointermove", move);
    onUp?.(e, activated);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up, { once: true });
}
