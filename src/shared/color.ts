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
