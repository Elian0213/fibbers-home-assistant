/* ================================================================== *
 * light-detail-math — pure geometry + constants for the colour/warm wheel.
 * The wheel is a DONUT: colour lamps ride an outer ring (hue = angle, saturation
 * across a [RING_IN, RING_OUT] band), warm-only lamps ride a horizontal track
 * inside the warm-white centre circle (kelvin = x). No `hass`, no state: raw
 * hue/sat/kelvin in, disc coordinates out (0–100% of the square disc, centre
 * (50,50), radius 50). The caller (WheelController) supplies *displayed* values.
 *
 * NB: the CSS in light-detail.css hard-codes the ring hole (RING_IN) and centre
 * circle (CENTER_R) as percentages — keep them in sync with the constants here.
 * ================================================================== */
import { hsToRgb, rgbToKelvin, rgbToLab, deltaE76 } from "@shared/color";
import { clamp } from "@shared/util";

// Quick swatches: three whites (kelvin) then a spread of hues (hue, saturation).
export const WHITES = [
  { key: "warm", k: 2700, css: "#ffb96b" },
  { key: "neutral", k: 4000, css: "#ffe6c2" },
  { key: "cool", k: 6500, css: "#dce8ff" },
];
export const HUES = [0, 30, 60, 120, 200, 260, 300];

// A fixed display range for the warm track so every lamp's dot sits on one scale.
export const STRIP_LO = 2000;
export const STRIP_HI = 6535;
// Colour ring band (disc-% radius): saturation 0 sits at the inner edge (near the
// white centre), saturation 100 at the outer rim.
export const RING_IN = 28;
export const RING_OUT = 47;
// The warm-white centre: circle radius, and the width of the warm↔cool track that
// crosses its horizontal diameter (kept inside the circle).
export const CENTER_R = 22;
export const CENTER_W = 34;
// Drag snap distance (px) between two markers before they merge into one group.
export const SNAP_PX = 18;
// Auto-group tolerances: two colour lamps within GROUP_DE (ΔE76 in Lab) read as the
// same colour; two warm lamps within GROUP_K kelvin. A few JND, so sensor rounding
// doesn't split identical lamps but distinct colours stay apart. (Tunable.)
export const GROUP_DE = 6;
export const GROUP_K = 180;

/** Do two hue/sat colours read as the same? (ΔE76 in Lab within GROUP_DE.) */
export function sameColour(a: [number, number], b: [number, number]): boolean {
  return (
    deltaE76(rgbToLab(hsToRgb(a[0], a[1])), rgbToLab(hsToRgb(b[0], b[1]))) <=
    GROUP_DE
  );
}

/** Shortest angular distance between two hues (degrees, 0–180). */
export function hueDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Marker centre (0–100% of the disc) for a colour on the ring by hue°/sat%. */
export function colourXY(h: number, s: number): { x: number; y: number } {
  const rad = (h * Math.PI) / 180;
  const radius = RING_IN + (clamp(s, 0, 100) / 100) * (RING_OUT - RING_IN);
  return {
    x: 50 + radius * Math.sin(rad),
    y: 50 - radius * Math.cos(rad),
  };
}

/** Kelvin → 0–1 fraction along the warm track. */
export function warmFrac(k: number): number {
  return clamp((k - STRIP_LO) / (STRIP_HI - STRIP_LO), 0, 1);
}

/**
 * Marker centre for a warm lamp on the disc. Colour temperature is not a hue —
 * it's a warm→white→cool path near the centre — so warm lamps ride a horizontal
 * track across the warm-white centre circle: warm (2000 K) at the left, cool
 * (6535 K) at the right; only x carries the value.
 */
export function warmXY(k: number): { x: number; y: number } {
  return { x: 50 - CENTER_W / 2 + warmFrac(k) * CENTER_W, y: 50 };
}

/** Pointer x → kelvin fraction along the warm centre track (y is ignored). */
export function warmFracAt(clientX: number, rect: DOMRect): number {
  const x0 = ((50 - CENTER_W / 2) / 100) * rect.width;
  return clamp(
    (clientX - rect.left - x0) / ((CENTER_W / 100) * rect.width),
    0,
    1,
  );
}

/**
 * Pointer → hue°/sat% on the ring (no snap — grouping happens on release, in the
 * wheel end). Saturation maps the pointer's radius across the [RING_IN, RING_OUT]
 * band; a pointer inside the centre clamps to 0 (colour lamps park at the inner
 * edge and never enter the warm-white centre).
 */
export function colourAt(e: PointerEvent, R: number): [number, number] {
  const r = (e.currentTarget as Element).getBoundingClientRect();
  const dx = e.clientX - (r.left + R);
  const dy = e.clientY - (r.top + R);
  let hue = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  // dist/R is 0..1 of the radius; ×50 → disc-% radius, then map across the band.
  const discR = (Math.hypot(dx, dy) / R) * 50;
  const sat = clamp(((discR - RING_IN) / (RING_OUT - RING_IN)) * 100, 0, 100);
  return [hue, sat];
}

/**
 * A colour target's nearest colour temperature — so a warm lamp in a mixed group
 * tracks a colour drag's warmth (McCamy via shared/color), clamped to the strip.
 */
export function hueToKelvin(hue: number, sat: number): number {
  return clamp(Math.round(rgbToKelvin(hsToRgb(hue, sat))), STRIP_LO, STRIP_HI);
}
