"use client";

import { useEffect, useState } from "react";

/**
 * True below the given viewport width (Tailwind's `sm` breakpoint by default).
 * Starts false so SSR and the first paint match the desktop layout, then
 * corrects after mount and tracks resizes.
 */
export function useIsMobile(query = "(max-width: 639px)"): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return mobile;
}
