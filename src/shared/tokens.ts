/* ================================================================== *
 * TOKENS — the Fibbers palette as raw hex/rgba for interpolation (the nav bar's
 * iOS-tuned CSS). Cards read the theme-aware `--color-*` custom properties from
 * styles/tailwind.css instead, so they follow light/dark.
 * ================================================================== */

/** The Fibbers colour palette — raw hex/rgba values, keyed by role. */
export const T = {
  bg: "#111516",
  card: "#1D2426",
  card2: "#262F31",
  line: "#333E41",
  ink: "#EDF1F1",
  ink2: "#A9B6B9",
  muted: "#7D8B8E",
  // brand accent — soft forest-leaf green
  accent: "#74B98A",
  accentSoft: "rgba(116,185,138,.10)", // green wash used by the nav bar
  accentBg: "#17281C", // green tint surface (icon-on box)
  accentLine: "#2B4A34", // green tint border
  accentTx: "#CFE6D5", // text on a green tint
  // amber is now the WARNING colour (the alert card) only
  amber: "#E8A33D",
  amberSoft: "rgba(232,163,61,.09)",
  amberBg: "#3A2B12",
  amberLine: "#4E3A18",
  amberTx: "#EBD9BC",
  blue: "#5AAFD6",
  blueBg: "#152B36",
  blueLine: "#2C5A70",
  blueInk: "#9BD2EA",
  green: "#63C295",
  // red — the destructive/master colour; derivations mirror amber (tint surface,
  // tint border, lifted text) so a red tile reads the same weight as an amber one
  red: "#EC8377",
  redBg: "#3A1A17", // red tint surface (icon-on box / armed track)
  redLine: "#5A2B26", // red tint border
  redTx: "#F3C3BC", // text on a red tint
  sheet: "#171E20",
  nav: "#161C1E",
  grab: "#3E4A4D",
  rowLine: "#262F31",
} as const;
