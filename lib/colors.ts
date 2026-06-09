import type { ColorName } from "@/types";

/** SPEC.md color palette — soft, desaturated fills. */
export const PALETTE: Record<ColorName, string> = {
  peach: "#FBCFB0",
  salmon: "#F4A79D",
  rose: "#F2A7B8",
  sky: "#B3D9F5",
  mint: "#A8E6D0",
  lemon: "#FAF09E",
  lavender: "#D5C5F0",
  graytone: "#DDDBD5",
};

export const COLOR_NAMES = Object.keys(PALETTE) as ColorName[];

/** Hex fill for a color name, with a safe fallback. */
export function fillFor(color: ColorName | undefined): string {
  return (color && PALETTE[color]) || PALETTE.graytone;
}

/** A slightly darker border tone for an event block (derived from the fill). */
export function borderFor(color: ColorName | undefined): string {
  return fillFor(color);
}
