/* ================================================================== *
 * colour — the tiny conversions the light cards share, kept pure so a
 * mixed room can commit one drag across colour and white-only lamps.
 * ================================================================== */

/**
 * hue°/sat% (full value) → [r,g,b] 0-255.
 * @param h — hue in degrees (0–360)
 * @param s — saturation percent (0–100)
 */
export function hsToRgb(h: number, s: number): [number, number, number] {
  const sat = s / 100;
  const c = sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = 1 - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * [r,g,b] → correlated colour temperature (Kelvin), McCamy's approximation. Used
 * best-effort so a white lamp in a mixed group tracks a colour drag's warmth.
 * @param rgb
 */
export function rgbToKelvin([r, g, b]: [number, number, number]): number {
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 255;
  const Y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 255;
  const sum = X + Y + Z || 1;
  const x = X / sum;
  const y = Y / sum;
  const n = (x - 0.332) / (0.1858 - y || 1e-6);
  return 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
}

/**
 * [r,g,b] 0-255 → CIE L*a*b* (D65). Lab is perceptually uniform, so a Euclidean
 * distance in it ({@link deltaE76}) matches "do these read as the same colour" far
 * better than raw RGB/hue distance — used to auto-cluster same-colour lamps.
 * @param rgb
 */
export function rgbToLab([r, g, b]: [number, number, number]): [
  number,
  number,
  number,
] {
  // sRGB companding → linear light.
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  // linear RGB → XYZ (sRGB/D65 matrix).
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  // XYZ → Lab, normalised to the D65 white point.
  const f = (t: number): number =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(X / 0.95047);
  const fy = f(Y / 1.0);
  const fz = f(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * CIE76 colour difference — the Euclidean distance between two Lab colours. ΔE≈1 is
 * the just-noticeable difference and ΔE≤~2 reads as the same colour; cheap enough to
 * run per lamp per frame.
 * @param a @param b — Lab triples from {@link rgbToLab}
 */
export function deltaE76(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
