import type { SwimLane } from "@/types";
import { loadJSON, saveJSON } from "./storage";

export const LANES_STORAGE_KEY = "gantt:lanes";

/** Stable id for the GCal-powered lane so it can be found regardless of order. */
export const LIFE_LANE_ID = "life";

/**
 * Default swim lanes for a fresh board: a few generic starters the user can
 * rename or delete, plus the locked Life lane (Google Calendar). These only
 * seed first runs and "Clear all data" — boards already in storage are
 * unaffected.
 */
export const DEFAULT_LANES: SwimLane[] = [
  {
    id: "projects",
    label: "Projects",
    color: "sky",
    notes: [],
  },
  {
    id: "work",
    label: "Work",
    color: "peach",
    notes: [],
  },
  {
    id: "personal",
    label: "Personal",
    color: "lemon",
    notes: [],
  },
  {
    id: LIFE_LANE_ID,
    label: "Life",
    color: "mint",
    notes: [],
    isLifeLane: true,
  },
];

/** Read lanes from localStorage, falling back to defaults (SSR-safe). */
export function loadLanes(): SwimLane[] {
  const parsed = loadJSON<SwimLane[] | null>(LANES_STORAGE_KEY, null);
  if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LANES;
  // Guarantee exactly one locked Life lane exists, pinned to the end.
  const withoutLife = parsed.filter((l) => !l.isLifeLane);
  const life = parsed.find((l) => l.isLifeLane) ?? DEFAULT_LANES.find((l) => l.isLifeLane)!;
  return [...withoutLife, life];
}

/** Persist lanes to localStorage. No-op during SSR. */
export function saveLanes(lanes: SwimLane[]): void {
  saveJSON(LANES_STORAGE_KEY, lanes);
}

export function isLifeLane(lane: SwimLane): boolean {
  return Boolean(lane.isLifeLane) || lane.id === LIFE_LANE_ID;
}

/**
 * Ask before deleting a lane that still has events (deleting also cascades to
 * its events). Empty lanes delete without a prompt.
 */
export function confirmDeleteLane(label: string, eventCount: number): boolean {
  return (
    eventCount === 0 ||
    window.confirm(`Delete "${label}" and its ${eventCount} event(s)?`)
  );
}

/**
 * Keep the locked Life lane pinned to the last position regardless of how the
 * other lanes are ordered. Used after any reorder.
 */
export function pinLifeLast(lanes: SwimLane[]): SwimLane[] {
  const others = lanes.filter((l) => !isLifeLane(l));
  const life = lanes.find((l) => isLifeLane(l));
  return life ? [...others, life] : others;
}
