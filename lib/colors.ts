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

/**
 * Readable text color (near-black or near-white) for an arbitrary hex fill,
 * by perceived brightness. Google Calendar colors can be dark, unlike the
 * app's pastel palette.
 */
export function textOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#262626";
  const n = parseInt(m[1], 16);
  const brightness =
    (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return brightness >= 140 ? "#262626" : "#fafafa";
}
