/* ================================================================== *
 * fibbers-number — slider/stepper for input_number & number.*
 * drag UI, debounced writes; respects entity min/max/step.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { cardShell, iconBoxTpl } from "@shared/shells";
import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import { sliderTrack, setupSlider, type SliderController } from "@shared/ui";
import { fmtNum, clamp, isUnavail, pctFromX, pickEntity } from "@shared/util";
import { cx, pressable } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

const DOMAINS = ["input_number", "number"];

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: { domain: DOMAINS } } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "unit", selector: { text: {} } },
  { name: "step", selector: { number: {} } },
  {
    name: "mode",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "slider", label: "Slider" },
          { value: "stepper", label: "Stepper" },
        ],
      },
    },
  },
];

/** YAML/editor config accepted by `fibbers-number`. */
export interface NumberConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  icon?: string;
  unit?: string;
  step?: number;
  mode?: "slider" | "stepper";
  language?: string;
}

/**
 * fibbers-number — slider/stepper for input_number & number.*, with drag UI and
 * debounced writes; respects the entity min/max/step.
 */
@customElement("fibbers-number")
export class FibbersNumber extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() private config!: NumberConfig;

  private _slider?: SliderController;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the picker — an input_number entity from the dashboard, or a placeholder. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): NumberConfig {
    return {
      type: "custom:fibbers-number",
      entity: pickEntity(
        "input_number",
        entities,
        entitiesFallback,
        "input_number.example",
      ),
    };
  }

  /** Build the shared form editor bound to this card's schema. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & {
      schema?: unknown;
    };
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Validate + store the config; throws when the entity isn't an input_number/number. */
  setConfig(config: NumberConfig): void {
    if (!config || !config.entity) {
      throw new Error("fibbers-number: `entity` is required");
    }
    if (!DOMAINS.includes(String(config.entity).split(".")[0])) {
      throw new Error(
        "fibbers-number: `entity` must be an input_number.* or number.*",
      );
    }
    this.config = config;
    // Construct the control once (a fresh SliderHold per setConfig would stack
    // controllers on the element); tolerance is set per-read in _value() from the
    // entity's own range/step. Reads a snapped entity-range value instead of a %.
    if (!this._slider)
      this._slider = setupSlider({
        host: this,
        guard: () => this._unavail(),
        read: (e) => this._valFromX(e.clientX, e.currentTarget as Element),
        base: () => this._value(),
        clampValue: (v) => this._snap(v),
        commit: (v) => this._svc(v),
        hold: { tolerance: 0.5, timeout: 5000 },
      });
    else this._slider.hold.clear();
  }

  /** Cancel the pending debounced write so a torn-down card can't fire late. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._slider) this._slider.dispose();
  }

  private _st(): HassEntity | undefined {
    return this.hass && this.hass.states[this.config.entity];
  }

  private _unavail(): boolean {
    return isUnavail(this._st());
  }

  private _bounds(): { min: number; max: number; step: number } {
    const a = (this._st() && this._st()!.attributes) || {};
    const min = Number(a.min != null ? a.min : 0);
    const max = Number(a.max != null ? a.max : 100);
    const raw = Number(this.config.step != null ? this.config.step : a.step);
    const step = Number.isFinite(raw) && raw > 0 ? raw : 1;
    return { min, max: max > min ? max : min + 1, step };
  }

  private _decimals(): number {
    const s = this._bounds().step;
    if (Number.isInteger(s)) return 0;
    const i = String(s).indexOf(".");
    return i < 0 ? 0 : String(s).length - i - 1;
  }

  private _value(): number {
    const n = Number(this._st() && this._st()!.state);
    const { min, max, step } = this._bounds();
    const entityVal = Number.isFinite(n) ? n : min;
    // Step-relative tolerance: a fixed 0.5 clears the hold on the first update for
    // an entity whose whole range is ≤ 1, bringing the snap-back back.
    this._slider!.hold.tolerance = Math.max(step / 2, (max - min) / 1000);
    return this._slider!.value(entityVal, this._unavail());
  }

  private _snap(v: number): number {
    const { min, max, step } = this._bounds();
    const snapped = Math.round((v - min) / step) * step + min;
    return clamp(Number(snapped.toFixed(4)), min, max);
  }

  private _pct(v: number): number {
    const { min, max } = this._bounds();
    return clamp(((v - min) / (max - min)) * 100, 0, 100);
  }

  private _valFromX(clientX: number, track: Element): number {
    const { min, max } = this._bounds();
    return this._snap(min + (pctFromX(clientX, track) / 100) * (max - min));
  }

  // The raw write — the slider control arms/clears the display hold around it.
  private _svc(value: number): Promise<unknown> | undefined {
    if (!this.hass) return undefined;
    const domain = this.config.entity.split(".")[0]; // input_number | number
    return this.hass.callService(domain, "set_value", {
      entity_id: this.config.entity,
      value,
    });
  }

  private _bump(dir: number): void {
    if (this._unavail()) return;
    this._slider!.commitNow(
      this._snap(this._value() + dir * this._bounds().step),
    );
  }

  /** Render the header plus either the stepper buttons or the drag slider per `mode`. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this._st();
    const unavail = this._unavail();
    const name = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:tuning-2-bold-duotone";
    const unit =
      cfg.unit != null
        ? cfg.unit
        : (st && st.attributes.unit_of_measurement) || "";
    const v = this._value();
    const val = unavail
      ? t(hl, "number.unavailable")
      : `${fmtNum(this.hass, v, this._decimals())}${unit ? ` ${unit}` : ""}`;

    return cfg.mode === "stepper"
      ? this._renderStepper(name, icon, val, unavail)
      : this._renderSlider(name, icon, val, v, unavail);
  }

  private _iconBox(icon: string, unavail: boolean): TemplateResult {
    return iconBoxTpl(icon, {
      tone: unavail ? "muted" : "accent",
      iconCls: "h-[17px] w-[17px] [--mdc-icon-size:17px]",
    });
  }

  private _renderStepper(
    name: string,
    icon: string,
    val: string,
    unavail: boolean,
  ): TemplateResult {
    return cardShell(
      html`${this._iconBox(icon, unavail)}
        <span class="flex-1 text-[12px] font-medium text-ink">${name}</span>
        ${this._stepBtn("solar:minus-circle-bold-duotone", -1, unavail)}
        <span
          class="min-w-[52px] text-center text-[13px] font-semibold text-ink"
          >${val}</span
        >
        ${this._stepBtn("solar:add-circle-bold-duotone", 1, unavail)}`,
      { cls: cx("flex items-center gap-2.5", unavail && "opacity-50") },
    );
  }

  private _renderSlider(
    name: string,
    icon: string,
    val: string,
    v: number,
    unavail: boolean,
  ): TemplateResult {
    const b = this._bounds();
    return cardShell(
      html`<div class="flex items-center gap-2.5">
          ${this._iconBox(icon, unavail)}
          <span class="flex-1 text-[12px] font-medium text-ink">${name}</span>
          <span class="whitespace-nowrap text-[11px] font-medium text-muted"
            >${val}</span
          >
        </div>
        ${sliderTrack({
          pct: this._pct(v),
          disabled: unavail,
          dragging: this._slider!.dragging,
          cls: "mt-2.5",
          label: name,
          value: v,
          min: b.min,
          max: b.max,
          step: b.step,
          valueText: val,
          onInput: (nv: number) => this._slider!.input(this._snap(nv)),
          onDown: this._slider!.drag.down,
          onMove: this._slider!.drag.move,
          onUp: this._slider!.drag.up,
          onCancel: this._slider!.drag.cancel,
          onLost: this._slider!.drag.lost,
        })}`,
      { cls: cx(unavail && "opacity-50") },
    );
  }

  private _stepBtn(
    icon: string,
    dir: number,
    unavail: boolean,
  ): TemplateResult {
    const hl = this.config.language || this.hass;
    return html`<button
      type="button"
      class="${cx(
        "fib-hit flex h-8 w-8 flex-none items-center justify-center rounded-full bg-card2 text-accent transition-transform active:scale-90",
        pressable({ hover: "bright" }),
        unavail && "pointer-events-none opacity-40",
      )}"
      aria-label=${dir > 0 ? t(hl, "number.more") : t(hl, "number.less")}
      @click=${() => this._bump(dir)}
    >
      <fib-icon
        class="h-[22px] w-[22px] [--mdc-icon-size:22px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  /** One masonry row tall. */
  getCardSize(): number {
    return 1;
  }

  /** Sections view: full width, one row. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 1 };
  }

  /** Grid layout: full width, auto height. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
