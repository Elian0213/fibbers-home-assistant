/* ================================================================== *
 * fibbers-remote — the touchpad surface: a static template whose feedback nodes
 * (edge flashes, finger dot, scrub overlay) are mutated directly by the
 * TouchpadController's rAF painter, never by Lit. Pointer handlers and the
 * arrow-key handler are wired here; all gesture logic lives in the controller.
 * ================================================================== */
import { html, type TemplateResult } from "lit";
import { ref } from "lit/directives/ref.js";

import type { TouchpadController } from "../touchpad-controller";

/** The Apple-TV-style touchpad surface for `dpad: touchpad`. */
export function renderTouchpad(o: {
  ctrl: TouchpadController;
  onKey: (e: KeyboardEvent) => void;
  label: string;
  disabled: boolean;
}): TemplateResult {
  const { ctrl } = o;
  return html`<div
    class="tpad ${o.disabled ? "off" : ""}"
    role="application"
    tabindex="0"
    data-fib-gesture="own"
    aria-label=${o.label}
    ${ref(ctrl.attach)}
    @keydown=${o.onKey}
    @pointerdown=${ctrl.down}
    @pointermove=${ctrl.move}
    @pointerup=${ctrl.up}
    @pointercancel=${ctrl.cancel}
    @lostpointercapture=${ctrl.lost}
  >
    <div class="tp-edge up" aria-hidden="true"></div>
    <div class="tp-edge right" aria-hidden="true"></div>
    <div class="tp-edge down" aria-hidden="true"></div>
    <div class="tp-edge left" aria-hidden="true"></div>
    <div class="tp-dot" aria-hidden="true"></div>
    <div class="tp-scrub" aria-hidden="true">
      <span class="tp-time">0:00</span>
      <div class="tp-bar"><div class="tp-fill"></div></div>
      <span class="tp-dur">0:00</span>
    </div>
  </div>`;
}
