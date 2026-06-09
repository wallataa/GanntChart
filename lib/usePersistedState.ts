import { useCallback, useEffect, useState } from "react";

/**
 * `useState` that mirrors to localStorage under `key`. Starts from `initial`
 * (so SSR and first paint match), then hydrates from storage after mount.
 * `sanitize` (e.g. a clamp) is applied to both stored and incoming values.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  sanitize: (value: T) => T = (v) => v,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(sanitize(JSON.parse(raw) as T));
    } catch {
      /* ignore */
    }
    // Hydrate once per key; sanitize is assumed stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T) => {
      const clean = sanitize(next);
      setValue(clean);
      try {
        window.localStorage.setItem(key, JSON.stringify(clean));
      } catch {
        /* ignore */
      }
    },
    // sanitize is assumed stable (module-level or inline pure fn).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, set];
}
