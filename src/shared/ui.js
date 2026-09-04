/* ================================================================== *
 * UI — shared lit-html widget templates + keyboard/slider helpers.
 * One source for each control's look; import what you need. Templates are
 * presentational — the caller always owns the value mapping and service call.
 * ================================================================== */
import { html, nothing } from "lit";

import { t } from "./i18n.js";

/**
 * Enter/Space → activate, for elements carrying role="button" instead of a real
 * <button> (native buttons get this free). Pair with tabindex="0".
 * @param {Function} fn — invoked with the keyboard event
 * @returns {Function} keydown handler
 */
export function activateOnKey(fn) {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn(e);
    }
  };
}

/**
 * Fixes the "slider snaps back for one round trip" bug once, for every slider.
 * After a commit we HOLD the committed value on screen until the entity catches
 * up (within `tolerance`) or `timeout` elapses — so releasing at 70% on a lamp
 * still reporting 5% doesn't flash 70 → 5 → 70. A Lit ReactiveController so the
 * timeout can re-render, and it cleans up on disconnect.
 *
 *   this._hold = new SliderHold(this, { tolerance: 2 });     // in setConfig
 *   this._hold.hold(pct);                                    // in commit, before callService
 *   this._hold.value(hassPct, { dragging, dragValue, gone }) // when computing the display
 */
export class SliderHold {
  /**
   * Attach the hold to `host` as a reactive controller.
   * @param {object} host — the Lit host to attach the controller to.
   * @param {object} [opts] — `{ tolerance, timeout }`.
   */
  constructor(host, { tolerance = 2, timeout = 2000 } = {}) {
    this.host = host;
    host.addController(this);
    this.tolerance = tolerance;
    this.timeout = timeout;
    this._pending = null;
    this._timer = null;
  }

  /** Hold `value` on screen and start the release timer. @param {number} value */
  hold(value) {
    this._pending = value;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._pending = null;
      this._timer = null;
      this.host.requestUpdate();
    }, this.timeout);
  }

  /**
   * The value to display: drag value while dragging → held value until the entity
   * lands (or vanishes) → the entity value. Never compares for equality —
   * `tolerance` absorbs brightness_pct↔0-255 rounding and seek drift.
   * @param {number} entityValue
   * @param {object} [opts] — `{ dragging, dragValue, gone }`
   * @returns {number} the value to render
   */
  value(entityValue, { dragging, dragValue, gone } = {}) {
    if (dragging) return dragValue;
    if (this._pending == null) return entityValue;
    const landed =
      entityValue != null &&
      Math.abs(entityValue - this._pending) <= this.tolerance;
    if (gone || landed) {
      // already rendering the entity value — clear silently, no requestUpdate
      this._pending = null;
      clearTimeout(this._timer);
      this._timer = null;
      return entityValue;
    }
    return this._pending;
  }

  /**
   * Drop a pending hold without waiting for the entity to land — call from a failed
   * commit (`.catch`) so a service error doesn't freeze the display on the
   * optimistic value until the timeout.
   */
  clear() {
    if (this._pending == null && this._timer == null) return;
    this._pending = null;
    clearTimeout(this._timer);
    this._timer = null;
    this.host.requestUpdate();
  }

  /** ReactiveController teardown — cancel the timer and deregister from the host. */
  hostDisconnected() {
    this._pending = null;
    clearTimeout(this._timer);
    this._timer = null;
    // Lit does have removeController — deregister so the host doesn't retain the
    // controller after unmount. (Cards still reuse one hold across setConfig; that
    // guard prevents stacking a fresh controller per editor keystroke, which
    // hostDisconnected can't help with since it only fires on unmount.)
    if (this.host.removeController) this.host.removeController(this);
  }
}

/**
 * The shared pointer-drag gesture for the value sliders (brightness / number /
 * remote volume): capture on down, live-track through the caller's debounce once
 * the pointer clears a ~4px slop (leading-suppressed — a stationary tap commits
 * exactly once, on release), final value wins on release. One implementation of
 * the bookkeeping that was previously copy-pasted per card.
 *
 *   this._drag = sliderDrag({
 *     guard: () => this._unavail(),                             // optional
 *     read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget)),
 *     frame: (v, dragging) => { this._dragging = dragging; if (v != null) this._dragPct = v; },
 *     live: (v) => this._debouncedCommit(v),                    // streamed mid-drag
 *     end: (v) => { this._debouncedCommit.cancel(); if (v != null) this._commit(v); },
 *   });
 *   // wire: onDown: drag.down, onMove: drag.move, onUp: drag.up, onCancel: drag.cancel
 *
 * `end(null)` signals a cancelled gesture (pointercancel / external abort): drop
 * the pending debounced write, commit nothing. `abort()` is for host-side resets
 * (e.g. the remote switching devices mid-drag).
 * @param {object} opts — `{ read, frame, live, end, guard? }`
 * @returns {object} `{ down, move, up, cancel, abort }` pointer handlers
 */
export function sliderDrag({ read, frame, live, end, guard }) {
  let active = false;
  let downX = 0;
  let moved = false;
  const cancel = () => {
    if (!active) return;
    active = false;
    frame(null, false);
    end(null);
  };
  return {
    down(e) {
      if (guard && guard()) return;
      active = true;
      downX = e.clientX;
      moved = false;
      e.currentTarget.setPointerCapture &&
        e.currentTarget.setPointerCapture(e.pointerId);
      frame(read(e), true);
    },
    move(e) {
      if (!active) return;
      const v = read(e);
      frame(v, true);
      if (!moved && Math.abs(e.clientX - downX) < 4) return;
      moved = true;
      live(v);
    },
    up(e) {
      if (!active) return;
      active = false;
      const v = read(e);
      frame(v, false);
      end(v);
    },
    cancel,
    abort: cancel,
  };
}

/**
 * Arrow/Home/End/PageUp-Down → a new value, clamped to [min,max]. Shared by every
 * slider so keyboard behaviour is identical. PageUp/Down jump by a tenth of the
 * range (or one step, whichever is larger). Returns null for keys we don't handle,
 * so the caller can ignore them.
 * @param {string} key — KeyboardEvent.key
 * @param {object} range — `{ value, min, max, step }`
 * @returns {number|null} clamped next value, or null
 */
export function stepFromKey(key, { value, min, max, step }) {
  const big = Math.max(step, (max - min) / 10);
  let next;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      next = value + step;
      break;
    case "ArrowLeft":
    case "ArrowDown":
      next = value - step;
      break;
    case "PageUp":
      next = value + big;
      break;
    case "PageDown":
      next = value - big;
      break;
    case "Home":
      next = min;
      break;
    case "End":
      next = max;
      break;
    default:
      return null;
  }
  return Math.min(max, Math.max(min, next));
}

/**
 * The 6px drag track shared by the brightness / number / volume sliders: an
 * accent fill and knob positioned at `pct` (0-100), with pointer handlers wired
 * by the caller. Purely presentational — the caller owns pct↔value mapping and
 * the service call. Passing the value-space (value/min/max/step) + onInput
 * upgrades it to a keyboard-driven role="slider". Pass `dragging` (the card's own
 * drag flag) to grow the knob and reveal the live value bubble mid-drag.
 * @param {object} opts — see destructured params
 * @returns {object} lit-html template
 */
export function sliderTrack({
  pct,
  disabled = false,
  cls = "",
  onDown,
  onMove,
  onUp,
  onCancel,
  dragging = false,
  // Accessibility (optional but recommended). Give the value-space (value/min/max/
  // step) + onInput(newValue) and the track becomes a real, keyboard-driven
  // role="slider"; label/valueText feed the screen-reader announcement.
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  valueText,
  onInput,
}) {
  const keydown =
    disabled || !onInput
      ? undefined
      : (e) => {
          const next = stepFromKey(e.key, { value, min, max, step });
          if (next == null) return;
          e.preventDefault();
          if (next !== value) onInput(next);
        };
  // The bubble text — the caller's valueText (e.g. "72%", "21.5 °C", "1:24"), else
  // the raw percentage. Shown while dragging (JS flag) or on keyboard focus (CSS).
  const bubbleText = valueText != null ? valueText : `${Math.round(pct)}%`;
  // The element carrying role="slider" + the pointer handlers is a 44px-tall
  // transparent wrapper (a real touch target); the painted 6px bar is an inert
  // child. pctFromX still measures e.currentTarget (the wrapper) — same width, so
  // the maths is unchanged. `group` lets the bubble reveal on keyboard focus.
  return html`<div
    class="group relative flex h-[var(--fib-hit)] cursor-pointer touch-pan-y items-center
           ${cls} ${disabled ? "pointer-events-none" : ""}"
    role="slider"
    tabindex=${disabled ? -1 : 0}
    aria-label=${label || "slider"}
    aria-valuemin=${min}
    aria-valuemax=${max}
    aria-valuenow=${
      disabled ? nothing : value != null ? value : Math.round(pct)
    }
    aria-valuetext=${disabled || valueText == null ? nothing : valueText}
    aria-disabled=${disabled ? "true" : "false"}
    @pointerdown=${onDown}
    @pointermove=${onMove}
    @pointerup=${onUp}
    @pointercancel=${onCancel}
    @lostpointercapture=${onCancel}
    @keydown=${keydown}
  >
    <div
      class="pointer-events-none relative h-1.5 w-full rounded-[3px] bg-[#2C3639]"
    >
      ${
        disabled
          ? ""
          : html`<div
                class="absolute bottom-0 left-0 top-0 rounded-[3px] bg-accent"
                style="width:${pct}%"
              ></div>
              <!-- live value bubble above the knob: visible while dragging or on
                   keyboard focus, tabular so digits don't jitter. -->
              <div
                class="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2
                       whitespace-nowrap rounded-md border border-line bg-card2 px-2 py-1
                       text-[11px] font-semibold tabular-nums text-ink
                       shadow-[0_2px_10px_rgba(0,0,0,.5)] transition-[opacity,transform]
                       duration-100 group-focus-visible:scale-100
                       group-focus-visible:opacity-100
                       ${dragging ? "scale-100 opacity-100" : "scale-90 opacity-0"}"
                style="left:${pct}%"
              >
                ${bubbleText}
              </div>
              <div
                class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full
                       bg-accent shadow-[0_1px_4px_rgba(0,0,0,.5)]
                       transition-[width,height] duration-100
                       ${dragging ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]"}"
                style="left:${pct}%"
              ></div>`
      }
    </div>
  </div>`;
}

/**
 * Roving-focus keyboard nav for a chip row: arrows move focus between chips,
 * Escape runs `onClose` (shuts a drawer). composedPath() finds the focused chip
 * across the shadow boundary.
 * @param {KeyboardEvent} e
 * @param {Function} [onClose]
 */
function chipKeyNav(e, onClose) {
  if (e.key === "Escape") {
    if (onClose) onClose();
    return;
  }
  const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  if (!(e.key in delta)) return;
  const btns = [...e.currentTarget.querySelectorAll("button")];
  const focused = e.composedPath().find((el) => btns.includes(el));
  const idx = btns.indexOf(focused);
  if (idx < 0) return;
  e.preventDefault();
  btns[(idx + delta[e.key] + btns.length) % btns.length].focus();
}

/**
 * A wrapping chip row (sources / apps) that collapses to `collapsed` and, when
 * there's more, shows a drawer toggle — reusing fibbers-scene's "All {n}" / "Less"
 * wording — that reveals `all`. The active chip is highlighted the same way
 * fibbers-scene marks the active scene. `collapsed` = null shows everything with
 * no drawer. Items are `{ name, source?, icon? }`; `onSelect(item)` is the caller's.
 * @param {object} opts — see destructured params
 * @returns {object} lit-html template
 */
export function overflowChips({
  hl,
  all,
  collapsed,
  activeValue,
  open,
  onToggle,
  onSelect,
}) {
  const valueOf = (s) => s.source || s.name;
  // By set membership, not length: `collapsed` may synthesise favourites not in
  // `all`, so a length compare could hide real overflow.
  const shownSet = collapsed && new Set(collapsed.map(valueOf));
  const hasMore = !!shownSet && all.some((a) => !shownSet.has(valueOf(a)));
  const shown = open || !collapsed ? all : collapsed;
  const chip = (s) => {
    const active = activeValue != null && activeValue === valueOf(s);
    return html`<button
      type="button"
      aria-label=${s.name}
      aria-pressed=${active ? "true" : "false"}
      class="fib-hit inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[5px]
             text-[10.5px] font-medium ${
               active
                 ? "border-accentline bg-accentbg text-accent"
                 : "border-line bg-card2 text-ink2"
             }"
      @click=${() => onSelect(s)}
    >
      ${
        s.icon
          ? html`<fib-icon
              class="h-[13px] w-[13px] [--mdc-icon-size:13px]"
              icon=${s.icon}
            ></fib-icon>`
          : ""
      }
      ${s.name}
    </button>`;
  };
  return html`<div
    class="flex flex-wrap gap-x-1.5 gap-y-[18px]"
    @keydown=${(e) => chipKeyNav(e, open ? onToggle : null)}
  >
    ${shown.map(chip)}
    ${
      hasMore
        ? html`<button
            type="button"
            aria-expanded=${open ? "true" : "false"}
            class="fib-hit inline-flex items-center gap-1 rounded-full border border-line bg-transparent
                 px-2.5 py-[5px] text-[10.5px] font-medium text-ink2"
            @click=${onToggle}
          >
            ${
              open
                ? t(hl, "scene.show_less")
                : t(hl, "common.show_all", { n: all.length })
            }
            <fib-icon
              class="h-[13px] w-[13px] [--mdc-icon-size:13px] transition-transform ${
                open ? "rotate-180" : ""
              }"
              icon="solar:alt-arrow-down-bold-duotone"
            ></fib-icon>
          </button>`
        : ""
    }
  </div>`;
}

/**
 * The pill toggle (first grown inside fibbers-scheduler): a 36×20 track with an
 * animated 16px thumb. `on` drives colour + thumb position. Purely presentational
 * — the caller owns the service call.
 * @param {object} opts — `{ on, onClick, label }`
 * @returns {object} lit-html template
 */
export function pillSwitch({ on, onClick, label = "" }) {
  return html`<button
    type="button"
    class="fib-hit relative h-5 w-9 flex-none rounded-full transition-colors
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
