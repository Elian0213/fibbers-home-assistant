/* ================================================================== *
 * UI — shared lit-html widget templates + keyboard/slider helpers.
 * One source for each control's look; import what you need. Templates are
 * presentational — the caller always owns the value mapping and service call.
 * ================================================================== */
import {
  html,
  nothing,
  type TemplateResult,
  type ReactiveController,
  type ReactiveControllerHost,
} from "lit";

import { t } from "@shared/i18n";
import { capturePointer } from "@shared/util";

/**
 * Enter/Space → activate, for elements carrying role="button" instead of a real
 * <button> (native buttons get this free). Pair with tabindex="0".
 * @param fn — invoked with the keyboard event
 * @returns keydown handler
 */
export function activateOnKey(
  fn: (e: KeyboardEvent) => void,
): (e: KeyboardEvent) => void {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn(e);
    }
  };
}

/** Options for a {@link SliderHold}. */
export interface SliderHoldOptions {
  tolerance?: number;
  timeout?: number;
}

/** Options for {@link SliderHold.value} — the current drag/display state. */
export interface SliderHoldValueOptions {
  dragging?: boolean;
  dragValue?: number;
  gone?: boolean;
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
export class SliderHold implements ReactiveController {
  private host: ReactiveControllerHost;

  /** Landing tolerance — cards retune it per entity (e.g. step/2 for numbers). */
  tolerance: number;

  private timeout: number;

  private _pending: number | null;

  private _timer: ReturnType<typeof setTimeout> | null;

  /**
   * Attach the hold to `host` as a reactive controller.
   * @param host — the Lit host to attach the controller to.
   * @param opts — `{ tolerance, timeout }`.
   */
  constructor(
    host: ReactiveControllerHost,
    { tolerance = 2, timeout = 2000 }: SliderHoldOptions = {},
  ) {
    this.host = host;
    host.addController(this);
    this.tolerance = tolerance;
    this.timeout = timeout;
    this._pending = null;
    this._timer = null;
  }

  /** Hold `value` on screen and start the release timer. @param value */
  hold(value: number): void {
    this._pending = value;
    if (this._timer != null) clearTimeout(this._timer);
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
   * @param entityValue
   * @param opts — `{ dragging, dragValue, gone }`
   * @returns the value to render
   */
  value(
    entityValue: number,
    { dragging, dragValue, gone }: SliderHoldValueOptions = {},
  ): number {
    if (dragging) return dragValue as number;
    if (this._pending == null) return entityValue;
    const landed =
      entityValue != null &&
      Math.abs(entityValue - this._pending) <= this.tolerance;
    if (gone || landed) {
      // already rendering the entity value — clear silently, no requestUpdate
      this._pending = null;
      if (this._timer != null) clearTimeout(this._timer);
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
  clear(): void {
    if (this._pending == null && this._timer == null) return;
    this._pending = null;
    if (this._timer != null) clearTimeout(this._timer);
    this._timer = null;
    this.host.requestUpdate();
  }

  /** ReactiveController teardown — cancel the timer and deregister from the host. */
  hostDisconnected(): void {
    this._pending = null;
    if (this._timer != null) clearTimeout(this._timer);
    this._timer = null;
    // Lit does have removeController — deregister so the host doesn't retain the
    // controller after unmount. (Cards still reuse one hold across setConfig; that
    // guard prevents stacking a fresh controller per editor keystroke, which
    // hostDisconnected can't help with since it only fires on unmount.)
    if (this.host.removeController) this.host.removeController(this);
  }
}

/** The pointer handlers returned by {@link sliderDrag}. */
export interface SliderDragHandlers {
  down(e: PointerEvent): void;
  move(e: PointerEvent): void;
  up(e: PointerEvent): void;
  cancel(): void;
  abort(): void;
}

/** Options (callbacks) for {@link sliderDrag}. */
export interface SliderDragOptions {
  read: (e: PointerEvent) => number;
  frame: (value: number | null, dragging: boolean) => void;
  live: (value: number) => void;
  end: (value: number | null) => void;
  guard?: () => boolean;
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
 * @param opts — `{ read, frame, live, end, guard? }`
 * @returns `{ down, move, up, cancel, abort }` pointer handlers
 */
export function sliderDrag({
  read,
  frame,
  live,
  end,
  guard,
}: SliderDragOptions): SliderDragHandlers {
  let active = false;
  let downX = 0;
  let moved = false;
  const cancel = (): void => {
    if (!active) return;
    active = false;
    frame(null, false);
    end(null);
  };
  return {
    down(e) {
      if (guard && guard()) return;
      capturePointer(e.currentTarget as Element, e.pointerId);
      active = true;
      downX = e.clientX;
      moved = false;
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

/** The value-space passed to {@link stepFromKey}. */
export interface StepRange {
  value: number;
  min: number;
  max: number;
  step: number;
}

/**
 * Arrow/Home/End/PageUp-Down → a new value, clamped to [min,max]. Shared by every
 * slider so keyboard behaviour is identical. PageUp/Down jump by a tenth of the
 * range (or one step, whichever is larger). Returns null for keys we don't handle,
 * so the caller can ignore them.
 * @param key — KeyboardEvent.key
 * @param range — `{ value, min, max, step }`
 * @returns clamped next value, or null
 */
export function stepFromKey(
  key: string,
  { value, min, max, step }: StepRange,
): number | null {
  const big = Math.max(step, (max - min) / 10);
  let next: number;
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

/** Options for {@link sliderTrack}. */
export interface SliderTrackOptions {
  pct: number;
  disabled?: boolean;
  cls?: string;
  onDown?: (e: PointerEvent) => void;
  onMove?: (e: PointerEvent) => void;
  onUp?: (e: PointerEvent) => void;
  onCancel?: (e: PointerEvent) => void;
  dragging?: boolean;
  gradient?: string;
  label?: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  valueText?: string;
  onInput?: (value: number) => void;
}

/**
 * The 6px drag track shared by the brightness / number / volume sliders: an
 * accent fill and knob positioned at `pct` (0-100), with pointer handlers wired
 * by the caller. Purely presentational — the caller owns pct↔value mapping and
 * the service call. Passing the value-space (value/min/max/step) + onInput
 * upgrades it to a keyboard-driven role="slider". Pass `dragging` (the card's own
 * drag flag) to grow the knob and reveal the live value bubble mid-drag.
 * @param opts — see destructured params
 * @returns lit-html template
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
  // A CSS background (e.g. a warm→cool or rainbow gradient) paints the whole track
  // instead of the accent fill — for colour-temperature / hue sliders. The knob
  // turns white-with-ring so it reads on any colour.
  gradient,
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
}: SliderTrackOptions): TemplateResult {
  const keydown =
    disabled || !onInput
      ? undefined
      : (e: KeyboardEvent) => {
          const next = stepFromKey(e.key, {
            value: value as number,
            min,
            max,
            step,
          });
          if (next == null) return;
          e.preventDefault();
          if (next !== value) onInput(next);
        };
  // The bubble text — the caller's valueText (e.g. "72%", "21.5 °C", "1:24"), else
  // the raw percentage. Shown while dragging (JS flag) or on keyboard focus (CSS).
  const bubbleText = valueText != null ? valueText : `${Math.round(pct)}%`;
  // aria-valuenow: `nothing` when disabled, else the value-space value if given,
  // else the rounded percentage. Extracted from the template so it reads as a
  // plain guard chain rather than a nested ternary — identical rendered output.
  let ariaValueNow: typeof nothing | number;
  if (disabled) ariaValueNow = nothing;
  else if (value != null) ariaValueNow = value;
  else ariaValueNow = Math.round(pct);
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
    aria-valuenow=${ariaValueNow}
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
      class="pointer-events-none relative w-full rounded-[3px]
             ${gradient ? "h-2.5" : "h-1.5 bg-[#2C3639]"}"
      style=${gradient ? `background:${gradient}` : nothing}
    >
      ${
        gradient
          ? ""
          : html`<div
              class="absolute bottom-0 left-0 top-0 rounded-[3px] bg-accent
                     ${disabled ? "opacity-40" : ""}"
              style="width:${pct}%"
            ></div>`
      }
      <!-- live value bubble above the knob: visible while dragging or on keyboard
           focus, tabular so digits don't jitter. Suppressed while disabled. -->
      ${
        disabled
          ? ""
          : html`<div
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
            </div>`
      }
      <!-- knob: always drawn (dimmed when disabled) so a disabled slider reads as
           disabled, not broken. -->
      <div
        class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full
               shadow-[0_1px_4px_rgba(0,0,0,.55)] transition-[width,height] duration-100
               ${gradient ? "border-2 border-[rgba(0,0,0,.45)] bg-white" : "bg-accent"}
               ${dragging ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]"}
               ${disabled ? "opacity-40" : ""}"
        style="left:${pct}%"
      ></div>
    </div>
  </div>`;
}

/**
 * Roving-focus keyboard nav for a chip row: arrows move focus between chips,
 * Escape runs `onClose` (shuts a drawer). composedPath() finds the focused chip
 * across the shadow boundary.
 * @param e
 * @param onClose
 */
function chipKeyNav(e: KeyboardEvent, onClose?: (() => void) | null): void {
  if (e.key === "Escape") {
    if (onClose) onClose();
    return;
  }
  const delta: Record<string, number> = {
    ArrowRight: 1,
    ArrowDown: 1,
    ArrowLeft: -1,
    ArrowUp: -1,
  };
  if (!(e.key in delta)) return;
  const btns = [...(e.currentTarget as Element).querySelectorAll("button")];
  const focused = e
    .composedPath()
    .find((el) => btns.includes(el as HTMLButtonElement));
  const idx = btns.indexOf(focused as HTMLButtonElement);
  if (idx < 0) return;
  e.preventDefault();
  btns[(idx + delta[e.key] + btns.length) % btns.length].focus();
}

/** A single chip item rendered by {@link overflowChips}. */
export interface ChipItem {
  name: string;
  source?: string;
  icon?: string;
}

/** Options for {@link overflowChips}. */
export interface OverflowChipsOptions {
  hl: unknown;
  all: ChipItem[];
  collapsed?: ChipItem[] | null;
  activeValue?: string | null;
  open?: boolean;
  onToggle?: () => void;
  onSelect: (item: ChipItem) => void;
}

/**
 * A wrapping chip row (sources / apps) that collapses to `collapsed` and, when
 * there's more, shows a drawer toggle — reusing fibbers-scene's "All {n}" / "Less"
 * wording — that reveals `all`. The active chip is highlighted the same way
 * fibbers-scene marks the active scene. `collapsed` = null shows everything with
 * no drawer. Items are `{ name, source?, icon? }`; `onSelect(item)` is the caller's.
 * @param opts — see destructured params
 * @returns lit-html template
 */
export function overflowChips({
  hl,
  all,
  collapsed,
  activeValue,
  open,
  onToggle,
  onSelect,
}: OverflowChipsOptions): TemplateResult {
  const valueOf = (s: ChipItem): string => s.source || s.name;
  // By set membership, not length: `collapsed` may synthesise favourites not in
  // `all`, so a length compare could hide real overflow.
  const shownSet = collapsed && new Set(collapsed.map(valueOf));
  const hasMore = !!shownSet && all.some((a) => !shownSet.has(valueOf(a)));
  const shown = open || !collapsed ? all : collapsed;
  const chip = (s: ChipItem): TemplateResult => {
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
    @keydown=${(e: KeyboardEvent) => chipKeyNav(e, open ? onToggle : null)}
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

/** Options for {@link pillSwitch}. */
export interface PillSwitchOptions {
  on: boolean;
  onClick: (e: Event) => void;
  label?: string;
}

/**
 * The pill toggle (first grown inside fibbers-scheduler): a 36×20 track with an
 * animated 16px thumb. `on` drives colour + thumb position. Purely presentational
 * — the caller owns the service call.
 * @param opts — `{ on, onClick, label }`
 * @returns lit-html template
 */
export function pillSwitch({
  on,
  onClick,
  label = "",
}: PillSwitchOptions): TemplateResult {
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
