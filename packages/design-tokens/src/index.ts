/** Token values for places that need raw colours (SVG charts, OG images). */
export const colors = {
  primary: "#ff852f",
  primaryInk: "#b5520f",
  onPrimary: "#1c2452",
  ink: "#1c2452",
  night: "#0f1330",
  paper: "#f4f5f9",
} as const;

/**
 * Sequential single-hue ramp (primary orange), light → dark, for magnitude
 * encodings such as occupancy heatmaps.
 */
export const sequentialPrimary = [
  "#fff0e4",
  "#ffd2ad",
  "#ffb07a",
  "#ff852f",
  "#d9661a",
  "#a84a0e",
] as const;
