/* ================================================================== *
 * fibbers-remote — pure value-space math for the optional `controls:` sliders:
 * a light is always 0–100 (brightness_pct); a number uses its own min/max/step.
 * (hass, entity) in, numbers out — no element state, so unit-testable.
 * ================================================================== */
import { pctFromX, brightnessPct, clamp } from "@shared/util";
import type { HomeAssistant } from "@/types/home-assistant";

/** Slider value-space for a control: lights are 0–100, numbers use their own min/max/step. */
export function ctlBounds(
  hass: HomeAssistant | undefined,
  entity: string,
): { min: number; max: number; step: number } {
  if (entity.split(".")[0] === "light") return { min: 0, max: 100, step: 1 };
  const st = hass && hass.states[entity];
  const a = (st && st.attributes) || {};
  const min = Number(a.min != null ? a.min : 0);
  const max = Number(a.max != null ? a.max : 100);
  const raw = Number(a.step);
  const step = Number.isFinite(raw) && raw > 0 ? raw : 1;
  return { min, max: max > min ? max : min + 1, step };
}

/** The entity's real value in slider-space: a light's brightness_pct (0 off), else the number's state. */
export function ctlRawValue(
  hass: HomeAssistant | undefined,
  entity: string,
): number {
  const st = hass && hass.states[entity];
  if (entity.split(".")[0] === "light") return brightnessPct(st);
  const n = Number(st && st.state);
  return Number.isFinite(n) ? n : ctlBounds(hass, entity).min;
}

/** Snap a value to the entity's step and clamp it into range. */
export function ctlSnap(
  hass: HomeAssistant | undefined,
  entity: string,
  v: number,
): number {
  const { min, max, step } = ctlBounds(hass, entity);
  const snapped = Math.round((v - min) / step) * step + min;
  return clamp(Number(snapped.toFixed(4)), min, max);
}

/** The value as a 0–100 percent of the entity's range (for the track fill). */
export function ctlPct(
  hass: HomeAssistant | undefined,
  entity: string,
  v: number,
): number {
  const { min, max } = ctlBounds(hass, entity);
  return clamp(((v - min) / (max - min)) * 100, 0, 100);
}

/** The snapped value at a pointer x-position along a track element. */
export function ctlValFromX(
  hass: HomeAssistant | undefined,
  entity: string,
  clientX: number,
  track: Element,
): number {
  const { min, max } = ctlBounds(hass, entity);
  return ctlSnap(
    hass,
    entity,
    min + (pctFromX(clientX, track) / 100) * (max - min),
  );
}
