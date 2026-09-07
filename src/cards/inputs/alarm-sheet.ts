/* ================================================================== *
 * fibbers-alarm-sheet — the body of the alarm bottom sheet (opened by
 * fibbers-alarm via openModal, in the shared sheet chrome). Holds the settings
 * that change week to week: master toggle, an inline ± time stepper, day chips,
 * and a "Wekradio" block (on/off, station list, volume). Not a picker card —
 * defined here and imported for its side-effect from index.ts.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { closeSheet } from "@core/body-sheet";
import { t } from "@shared/i18n";
import { radioLogo } from "@shared/radio-logo";
import { twSheet } from "@shared/tw";
import {
  pillSwitch,
  sliderTrack,
  setupSlider,
  activateOnKey,
  type SliderController,
} from "@shared/ui";
import {
  isUnavail,
  pctFromX,
  snapToStep,
  clamp,
  navigate,
  debounce,
  type Debounced,
} from "@shared/util";
import { cx, pressable, sectionLabel } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
} from "@/types/home-assistant";
import {
  assertAlarmConfig,
  hhmm,
  stepTime,
  type AlarmConfig,
} from "@cards/inputs/alarm-config";
import "@shared/icon";

/**
 * fibbers-alarm-sheet — the alarm sheet body (master toggle, ± time stepper, day
 * chips, wake-radio on/off + station + volume). Rendered inside the shared sheet.
 */
@customElement("fibbers-alarm-sheet")
export class FibbersAlarmSheet extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: AlarmConfig;

  // Optimistic HH:MM shown while a burst of ± taps settles; cleared once the
  // entity reports the committed value (or by a safety timer).
  @state() private _pendingTime: string | null = null;

  private _slider?: SliderController; // volume

  private _commitTime!: Debounced<[string]>;

  private _pendingClear?: ReturnType<typeof setTimeout>;

  private _repeatTimer?: ReturnType<typeof setTimeout>;

  private _repeatInterval?: ReturnType<typeof setInterval>;

  // Station logo URLs that failed to load — fall back to the icon for these.
  private _logoBroken = new Set<string>();

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Validate + wire the volume slider once. */
  setConfig(config: AlarmConfig): void {
    assertAlarmConfig(config, "fibbers-alarm-sheet");
    this.config = config;
    this._commitTime = debounce((v: string) => this._writeTime(v), 500);
    if (!this._slider && config.volume)
      this._slider = setupSlider({
        host: this,
        guard: () => this._volDisabled(),
        read: (e) => this._volFromX(e.clientX, e.currentTarget as Element),
        base: () => this._volValue(),
        clampValue: (v) => {
          const b = this._volBounds();
          return snapToStep(v, b.min, b.max, b.step);
        },
        commit: (v) => this._writeVolume(v),
        hold: { tolerance: 0.5, timeout: 5000 },
      });
    else if (this._slider) this._slider.hold.clear();
  }

  /** Tear down the repeat/commit/hold timers so a torn-down sheet can't fire late. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopRepeat();
    if (this._commitTime) this._commitTime.cancel();
    if (this._pendingClear) clearTimeout(this._pendingClear);
    if (this._slider) this._slider.dispose();
  }

  // --- entity helpers ----------------------------------------------------------

  private _st(id: string | undefined): HassEntity | null {
    return id && this.hass ? this.hass.states[id] : null;
  }

  private _on(id: string | undefined, dflt = false): boolean {
    const st = this._st(id);
    return st ? st.state === "on" : dflt;
  }

  private _svc(
    domain: string,
    service: string,
    data: Record<string, unknown>,
  ): void {
    if (this.hass)
      Promise.resolve(this.hass.callService(domain, service, data)).catch(
        () => {},
      );
  }

  private _toggle(id: string | undefined): void {
    if (id) this._svc("homeassistant", "toggle", { entity_id: id });
  }

  // --- time stepper ------------------------------------------------------------

  private _displayTime(): string {
    return this._pendingTime ?? hhmm(this._st(this.config.time)?.state);
  }

  /**
   * Drop the optimistic time once the entity has caught up — after render, not
   * during it, so we never schedule an update mid-render.
   */
  protected updated(): void {
    if (
      this._pendingTime &&
      this._pendingTime === hhmm(this._st(this.config.time)?.state)
    ) {
      this._pendingTime = null;
      if (this._pendingClear) clearTimeout(this._pendingClear);
    }
  }

  private _step(dHours: number, dMinutes: number): void {
    const cur = this._displayTime();
    if (!cur) return;
    const next = stepTime(cur, dHours, dMinutes);
    this._pendingTime = next;
    this._commitTime(next);
    // Safety: never let an unsaved optimistic value stick past a few seconds.
    if (this._pendingClear) clearTimeout(this._pendingClear);
    this._pendingClear = setTimeout(() => {
      this._pendingTime = null;
      this.requestUpdate();
    }, 6000);
    this.requestUpdate();
  }

  private _writeTime(v: string): void {
    if (v)
      this._svc("input_datetime", "set_datetime", {
        entity_id: this.config.time,
        time: `${v}:00`,
      });
  }

  // Press-and-hold repeat for the ± buttons: fire once now, then repeat after a
  // short delay until release. Keyboard uses a single activateOnKey step instead.
  private _startRepeat(fn: () => void): void {
    this._stopRepeat();
    fn();
    this._repeatTimer = setTimeout(() => {
      this._repeatInterval = setInterval(fn, 110);
    }, 400);
  }

  private _stopRepeat(): void {
    if (this._repeatTimer) clearTimeout(this._repeatTimer);
    if (this._repeatInterval) clearInterval(this._repeatInterval);
    this._repeatTimer = undefined;
    this._repeatInterval = undefined;
  }

  // --- volume ------------------------------------------------------------------

  private _volBounds(): { min: number; max: number; step: number } {
    const a = this._st(this.config.volume)?.attributes || {};
    const min = Number(a.min != null ? a.min : 0);
    const max = Number(a.max != null ? a.max : 100);
    const raw = Number(a.step);
    const step = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return { min, max: max > min ? max : min + 1, step };
  }

  private _volDisabled(): boolean {
    return (
      isUnavail(this._st(this.config.volume)) ||
      (!!this.config.radio_enable && !this._on(this.config.radio_enable, true))
    );
  }

  private _volRaw(): number {
    const st = this._st(this.config.volume);
    const n = Number(st?.state);
    return Number.isFinite(n) ? n : this._volBounds().min;
  }

  private _volValue(): number {
    const { step } = this._volBounds();
    if (this._slider) this._slider.hold.tolerance = Math.max(step / 2, 0.5);
    return this._slider
      ? this._slider.value(this._volRaw(), this._volDisabled())
      : this._volRaw();
  }

  private _volFromX(clientX: number, track: Element): number {
    const { min, max, step } = this._volBounds();
    return snapToStep(
      min + (pctFromX(clientX, track) / 100) * (max - min),
      min,
      max,
      step,
    );
  }

  private _volPct(v: number): number {
    const { min, max } = this._volBounds();
    return clamp(((v - min) / (max - min)) * 100, 0, 100);
  }

  private _writeVolume(v: number): Promise<unknown> | undefined {
    if (!this.hass || !this.config.volume) return undefined;
    return this.hass.callService("input_number", "set_value", {
      entity_id: this.config.volume,
      value: v,
    });
  }

  // --- render ------------------------------------------------------------------

  /** The sheet body: master toggle, ± time stepper, day chips, wake-radio block. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    return html`<div class="flex flex-col gap-4 pt-1">
      ${this._renderMaster(hl)} ${this._renderTime(hl)} ${this._renderDays(hl)}
      ${this._renderRadio(hl)} ${this._renderFooter(hl)}
    </div>`;
  }

  private _renderMaster(hl: unknown): TemplateResult | string {
    const cfg = this.config;
    if (!cfg.enable) return "";
    const on = this._on(cfg.enable, true);
    return html`<div class="flex items-center justify-between gap-3">
      <span class="text-[13px] font-medium text-ink"
        >${t(hl, "alarm.alarm_on")}</span
      >
      ${pillSwitch({
        on,
        label: t(hl, "alarm.alarm_on"),
        onClick: () => this._toggle(cfg.enable),
      })}
    </div>`;
  }

  private _renderTime(hl: unknown): TemplateResult {
    const cfg = this.config;
    const time = this._displayTime();
    const disabled = !time;
    const dur = Number(this._st(cfg.duration)?.state);
    const bri = Number(this._st(cfg.brightness)?.state);
    const fadeStart = hhmm(this._st(cfg.light_start)?.state);
    // Helper text: "licht vanaf 08:40 · 20 min → 100%".
    const bits: string[] = [];
    if (fadeStart) bits.push(t(hl, "alarm.light_from", { time: fadeStart }));
    const lightBits: string[] = [];
    if (Number.isFinite(dur)) lightBits.push(`${dur} min`);
    if (Number.isFinite(bri)) lightBits.push(`→ ${bri}%`);
    if (lightBits.length) bits.push(lightBits.join(" "));
    return html`<div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-center gap-3">
        ${this._stepper(time, "h")} ${this._stepper(time, "m")}
      </div>
      ${
        bits.length && !disabled
          ? html`<div class="text-center text-[11px] text-muted">
              ${bits.join(" · ")}
            </div>`
          : ""
      }
    </div>`;
  }

  // One HH or MM column: up button, the two big digits, down button.
  private _stepper(time: string, field: "h" | "m"): TemplateResult {
    const hl = this.config.language || this.hass;
    const value = time ? time.split(":")[field === "h" ? 0 : 1] : "--";
    const dH = field === "h" ? 1 : 0;
    const dM = field === "m" ? 1 : 0;
    const up = t(hl, field === "h" ? "alarm.hour_up" : "alarm.minute_up");
    const down = t(hl, field === "h" ? "alarm.hour_down" : "alarm.minute_down");
    const arrow = (
      icon: string,
      label: string,
      dhr: number,
      dmin: number,
    ): TemplateResult =>
      html`<button
        type="button"
        class="${cx(
          "fib-hit flex h-9 w-12 items-center justify-center rounded-[10px] bg-card2 text-accent",
          "transition-transform active:scale-90",
          pressable({ hover: "bright" }),
          !time && "pointer-events-none opacity-40",
        )}"
        aria-label=${label}
        @pointerdown=${() => this._startRepeat(() => this._step(dhr, dmin))}
        @pointerup=${() => this._stopRepeat()}
        @pointerleave=${() => this._stopRepeat()}
        @pointercancel=${() => this._stopRepeat()}
        @keydown=${activateOnKey(() => this._step(dhr, dmin))}
      >
        <fib-icon
          class="h-5 w-5 [--mdc-icon-size:20px]"
          icon=${icon}
        ></fib-icon>
      </button>`;
    return html`<div class="flex flex-col items-center gap-1.5">
      ${arrow("solar:alt-arrow-up-bold-duotone", up, dH, dM)}
      <span
        class="w-12 text-center text-[34px] font-semibold leading-none tabular-nums text-ink"
        >${value}</span
      >
      ${arrow("solar:alt-arrow-down-bold-duotone", down, -dH, -dM)}
    </div>`;
  }

  private _renderDays(hl: unknown): TemplateResult | string {
    const cfg = this.config;
    const st = this._st(cfg.days);
    const options = (st?.attributes.options as string[]) || [];
    if (!cfg.days || !options.length) return "";
    const current = st?.state;
    return html`<div class="flex flex-col gap-1.5">
      <span class="text-[11px] text-muted">${t(hl, "alarm.days")}</span>
      <div class="flex flex-wrap gap-x-2 gap-y-[14px]">
        ${options.map((o) => {
          const active = o === current;
          return html`<button
            type="button"
            class="${cx(
              "fib-hit rounded-full border px-2.5 py-1 text-[11px] font-medium",
              pressable({ hover: "bright" }),
              active
                ? "border-accentline bg-accentbg text-accent"
                : "border-line bg-card2 text-ink2",
            )}"
            aria-pressed=${active ? "true" : "false"}
            @click=${() =>
              this._svc("input_select", "select_option", {
                entity_id: cfg.days,
                option: o,
              })}
          >
            ${o}
          </button>`;
        })}
      </div>
    </div>`;
  }

  private _renderRadio(hl: unknown): TemplateResult | string {
    const cfg = this.config;
    // The whole block is absent when no radio entities are configured.
    if (!cfg.radio_enable && !cfg.station && !cfg.volume) return "";
    const radioOn = this._on(cfg.radio_enable, true);
    return html`<div class="flex flex-col gap-3 border-t border-line pt-3">
      <span class="${sectionLabel()}">${t(hl, "alarm.radio_section")}</span>
      ${
        cfg.radio_enable
          ? html`<div class="flex items-center justify-between gap-3">
              <span class="text-[12px] font-medium text-ink"
                >${t(hl, "alarm.radio_on")}</span
              >
              ${pillSwitch({
                on: radioOn,
                label: t(hl, "alarm.radio_on"),
                onClick: () => this._toggle(cfg.radio_enable),
              })}
            </div>`
          : ""
      }
      ${this._renderStations(hl, radioOn)} ${this._renderVolume(hl, radioOn)}
    </div>`;
  }

  // The station's logo (from the radio-browser directory) in a fixed slot, or a
  // radio-wave icon while it resolves / when there's none / if the image fails.
  private _stationLogo(station: string): TemplateResult {
    const url = this._logoBroken.has(station)
      ? null
      : radioLogo(station, () => this.requestUpdate());
    return html`<span
      class="flex h-5 w-5 flex-none items-center justify-center overflow-hidden rounded-[4px] bg-card2"
    >
      ${
        url
          ? html`<img
              src=${url}
              alt=""
              class="h-5 w-5 object-contain"
              @error=${() => {
                this._logoBroken.add(station);
                this.requestUpdate();
              }}
            />`
          : html`<fib-icon
              class="h-3 w-3 [--mdc-icon-size:12px] text-muted"
              icon="solar:soundwave-bold-duotone"
            ></fib-icon>`
      }
    </span>`;
  }

  private _renderStations(
    hl: unknown,
    radioOn: boolean,
  ): TemplateResult | string {
    const cfg = this.config;
    const st = this._st(cfg.station);
    const options = (st?.attributes.options as string[]) || [];
    if (!cfg.station || !options.length) return "";
    const current = st?.state;
    return html`<div class=${cx(!radioOn && "pointer-events-none opacity-50")}>
      <span class="mb-1 block text-[11px] text-muted"
        >${t(hl, "alarm.station")}</span
      >
      <div
        class="fib-scroll max-h-[200px] overflow-auto overscroll-contain rounded-[10px] border border-line bg-card p-1"
        role="listbox"
        aria-label=${t(hl, "alarm.station")}
      >
        ${options.map(
          (o) =>
            html`<button
              type="button"
              role="option"
              aria-selected=${o === current ? "true" : "false"}
              class="${cx(
                "flex w-full items-center justify-between gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[12px]",
                pressable({ hover: "tint" }),
                o === current ? "text-accent" : "text-ink",
              )}"
              @click=${() =>
                this._svc("input_select", "select_option", {
                  entity_id: cfg.station,
                  option: o,
                })}
            >
              <span class="flex min-w-0 items-center gap-2">
                ${this._stationLogo(o)}
                <span class="truncate">${o}</span>
              </span>
              ${
                o === current
                  ? html`<fib-icon
                      class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-accent"
                      icon="solar:check-circle-bold-duotone"
                    ></fib-icon>`
                  : ""
              }
            </button>`,
        )}
      </div>
    </div>`;
  }

  private _renderVolume(
    hl: unknown,
    radioOn: boolean,
  ): TemplateResult | string {
    const cfg = this.config;
    if (!cfg.volume || !this._slider) return "";
    const s = this._slider;
    const disabled = this._volDisabled();
    const v = Math.round(this._volValue());
    const b = this._volBounds();
    return html`<div class=${cx(!radioOn && "opacity-50")}>
      <div class="mb-0.5 flex items-center justify-between text-[11px]">
        <span class="text-muted">${t(hl, "alarm.volume")}</span>
        <span class="tabular-nums text-ink2">${disabled ? "" : `${v}%`}</span>
      </div>
      ${sliderTrack({
        pct: this._volPct(v),
        disabled,
        dragging: s.dragging,
        label: t(hl, "alarm.volume"),
        value: v,
        min: b.min,
        max: b.max,
        step: b.step,
        valueText: `${v}%`,
        onInput: (nv) => s.input(snapToStep(nv, b.min, b.max, b.step)),
        onDown: s.drag.down,
        onMove: s.drag.move,
        onUp: s.drag.up,
        onCancel: s.drag.cancel,
        onLost: s.drag.lost,
      })}
    </div>`;
  }

  private _renderFooter(hl: unknown): TemplateResult | string {
    const cfg = this.config;
    if (!cfg.config_path) return "";
    return html`<button
      type="button"
      class="${cx(
        "flex w-full items-center justify-between gap-2 rounded-[10px] border border-line bg-card2 px-3 py-2.5",
        "text-[12px] font-medium text-ink2",
        pressable({ hover: "bright" }),
      )}"
      @click=${() => this._openConfig()}
    >
      <span>${t(hl, "alarm.full_config")}</span>
      <fib-icon
        class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-muted"
        icon="solar:alt-arrow-right-bold-duotone"
      ></fib-icon>
    </button>`;
  }

  // Close the sheet first (so back-navigation from the target lands on a clean
  // Huis tab, not a reopened sheet), then navigate.
  private _openConfig(): void {
    const path = this.config.config_path;
    closeSheet();
    if (path) navigate(path);
  }

  /** Loosely sized — the modal lays this out, not HA's grid. */
  getCardSize(): number {
    return 6;
  }
}
