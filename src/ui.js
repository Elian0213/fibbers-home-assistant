/* ================================================================== *
 * UI — shared lit-html widget templates (pillSwitch, sliderTrack).
 * One source for each control's look; import what you need.
 * ================================================================== */
import { html } from "lit";

/**
 * The pill toggle (as first grown inside fibbers-scheduler): a 36×20 track with
 * an animated 16px thumb. `on` drives the colour + thumb position; `onClick` is
 * the click handler. Purely presentational — the caller owns the service call.
 */
/**
 * The 6px drag track shared by the brightness / number / volume sliders: an
 * accent fill and knob positioned at `pct` (0-100), with pointer handlers wired
 * by the caller. Purely presentational — the caller owns pct↔value mapping and
 * the service call. `onCancel` defaults to `onUp` so a cancelled drag settles.
 */
export function sliderTrack({
  pct,
  disabled = false,
  cls = "",
  onDown,
  onMove,
  onUp,
  onCancel,
}) {
  return html`<div
    class="relative h-1.5 cursor-pointer touch-none rounded-[3px] bg-[#2C3639]
           ${cls} ${disabled ? "pointer-events-none" : ""}"
    @pointerdown=${onDown}
    @pointermove=${onMove}
    @pointerup=${onUp}
    @pointercancel=${onCancel || onUp}
  >
    ${
      disabled
        ? ""
        : html`<div
              class="absolute bottom-0 left-0 top-0 rounded-[3px] bg-accent"
              style="width:${pct}%"
            ></div>
            <div
              class="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2
                   rounded-full bg-accent shadow-[0_1px_3px_rgba(0,0,0,.4)]"
              style="left:${pct}%"
            ></div>`
    }
  </div>`;
}

export function pillSwitch({ on, onClick, label = "" }) {
  return html`<button
    type="button"
    class="relative h-5 w-9 flex-none rounded-full transition-colors
           ${on ? "bg-accent" : "bg-card2"}"
    role="switch"
    aria-checked=${on ? "true" : "false"}
    aria-label=${label || "toggle"}
    @click=${onClick}
  >
    <span
      class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all
             ${on ? "left-[18px]" : "left-0.5"}"
    ></span>
  </button>`;
}
