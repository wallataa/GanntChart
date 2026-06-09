import { useCallback, useState } from "react";
import type { Event, Subtask, SwimLane } from "@/types";

/** The undoable document: everything persisted to localStorage as user data. */
export interface Doc {
  lanes: SwimLane[];
  events: Event[];
  subtasks: Subtask[];
}

export interface History {
  doc: Doc;
  /** Apply a new doc, pushing the previous one onto the undo stack. */
  commit: (next: Doc) => void;
  /** Replace the doc without recording history (hydration / external load). */
  reset: (next: Doc) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/** Cap the undo depth so long sessions don't grow memory without bound. */
const LIMIT = 100;

/**
 * Undo/redo for the app's data document. Every user mutation goes through
 * `commit`, which snapshots the previous doc; `undo`/`redo` walk the stacks.
 * `persist` is called with whatever doc becomes current so localStorage stays
 * in sync on commit, undo, and redo alike. `reset` swaps the doc and clears
 * both stacks (used for hydration), so loading from storage isn't undoable.
 *
 * Updaters are kept pure (no nested setState) so React StrictMode's double
 * invocation in development can't corrupt the stacks.
 */
export function useHistory(initial: Doc, persist: (doc: Doc) => void): History {
  const [doc, setDoc] = useState<Doc>(initial);
  const [past, setPast] = useState<Doc[]>([]);
  const [future, setFuture] = useState<Doc[]>([]);

  const commit = useCallback(
    (next: Doc) => {
      const trimmed = past.length >= LIMIT ? past.slice(past.length - LIMIT + 1) : past;
      setPast([...trimmed, doc]);
      setFuture([]);
      setDoc(next);
      persist(next);
    },
    [past, doc, persist],
  );

  const reset = useCallback((next: Doc) => {
    setPast([]);
    setFuture([]);
    setDoc(next);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture([doc, ...future]);
    setDoc(prev);
    persist(prev);
  }, [past, future, doc, persist]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast([...past, doc]);
    setDoc(next);
    persist(next);
  }, [past, future, doc, persist]);

  return {
    doc,
    commit,
    reset,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
