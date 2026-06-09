import type { SwimLane } from "@/types";

export const LANES_STORAGE_KEY = "gantt:lanes";

/** Stable id for the GCal-powered lane so it can be found regardless of order. */
export const LIFE_LANE_ID = "life";

/** Default swim lanes, mirroring the initial set in SPEC.md. */
export const DEFAULT_LANES: SwimLane[] = [
  {
    id: "july-4th-show",
    label: "July 4th Show",
    color: "peach",
    notes: [
      "Story board show",
      "Figure out sound ideas",
      "Make prelim dj set",
      "Real time phone research",
      "Lighting debug",
    ],
  },
  {
    id: "floating-points-install",
    label: "Floating Points Install",
    color: "salmon",
    notes: [],
  },
  {
    id: "web-clat",
    label: "Web Clat",
    color: "sky",
    notes: ["publish ambient set", "publish emptyset", "publish win95"],
  },
  {
    id: "general-todos",
    label: "General Todos",
    color: "graytone",
    notes: ["Remake websites"],
  },
  {
    id: "screenprint",
    label: "Screenprint",
    color: "lemon",
    notes: [
      "Buy more shirts",
      "Make more designs",
      "Buy camis",
      "underwear for hot for eggs",
    ],
  },
  {
    id: "film-festival",
    label: "Film Festival",
    color: "rose",
    notes: [],
  },
  {
    id: "poster-for-ushara",
    label: "Poster for Ushara",
    color: "salmon",
    notes: [],
  },
  {
    id: "open-calls",
    label: "Open Calls",
    color: "graytone",
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
  if (typeof window === "undefined") return DEFAULT_LANES;
  try {
    const raw = window.localStorage.getItem(LANES_STORAGE_KEY);
    if (!raw) return DEFAULT_LANES;
    const parsed = JSON.parse(raw) as SwimLane[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LANES;
    // Guarantee exactly one locked Life lane exists, pinned to the end.
    const withoutLife = parsed.filter((l) => !l.isLifeLane);
    const life = parsed.find((l) => l.isLifeLane) ??
      DEFAULT_LANES.find((l) => l.isLifeLane)!;
    return [...withoutLife, life];
  } catch {
    return DEFAULT_LANES;
  }
}

/** Persist lanes to localStorage. No-op during SSR. */
export function saveLanes(lanes: SwimLane[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LANES_STORAGE_KEY, JSON.stringify(lanes));
  } catch {
    /* storage full / disabled — ignore */
  }
}

export function isLifeLane(lane: SwimLane): boolean {
  return Boolean(lane.isLifeLane) || lane.id === LIFE_LANE_ID;
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
