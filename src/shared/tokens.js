/* ================================================================== *
 * TOKENS
 * ================================================================== */
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
  red: "#EC8377",
  sheet: "#171E20",
  nav: "#161C1E",
  grab: "#3E4A4D",
  rowLine: "#262F31",
};

/**
 * The palette as `:host` custom properties, emitted once per shadow root.
 * Later cards (Phase 2+) drop `styleBlock()` at the top of their `<style>` and
 * read `var(--fib-x)` instead of interpolating `T.x` into every rule — one
 * source of truth for the tokens. The nav bar predates this and keeps its own
 * interpolated CSS on purpose; it is iOS-tuned and not worth disturbing.
 */
export function styleBlock() {
  return `:host {
    --fib-bg: ${T.bg};
    --fib-card: ${T.card};
    --fib-card-2: ${T.card2};
    --fib-line: ${T.line};
    --fib-ink: ${T.ink};
    --fib-ink-2: ${T.ink2};
    --fib-muted: ${T.muted};
    --fib-accent: ${T.accent};
    --fib-accent-soft: ${T.accentSoft};
    --fib-accent-bg: ${T.accentBg};
    --fib-accent-line: ${T.accentLine};
    --fib-accent-tx: ${T.accentTx};
    --fib-amber: ${T.amber};
    --fib-amber-bg: ${T.amberBg};
    --fib-amber-line: ${T.amberLine};
    --fib-amber-tx: ${T.amberTx};
    --fib-blue: ${T.blue};
    --fib-blue-bg: ${T.blueBg};
    --fib-blue-line: ${T.blueLine};
    --fib-blue-ink: ${T.blueInk};
    --fib-green: ${T.green};
    --fib-red: ${T.red};
    --fib-sheet: ${T.sheet};
    --fib-nav: ${T.nav};
    --fib-grab: ${T.grab};
    --fib-row-line: ${T.rowLine};
  }`;
}
