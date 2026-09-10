/* ================================================================== *
 * fibbers-light-row — the light row for sheets: icon, name, live value
 * (`Warm · 70%`), and a drag slider bound to brightness_pct.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  runAction,
  setLightBrightness,
  type ActionConfig,
} from "@shared/actions";
import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import {
  sliderTrack,
  setupSlider,
  pillSwitch,
  activateOnKey,
  type SliderController,
} from "@shared/ui";
import {
  moreInfo,
  isUnavail,
  brightnessPct,
  pctFromX,
  pickEntity,
} from "@shared/util";
import { cx, iconBox, pressable } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: { domain: "light" } } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
];

/** YAML/editor config accepted by `fibbers-light-row`. */
export interface LightRowConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  icon?: string;
  icon_entity?: string;
  icon_tap_action?: ActionConfig;
  compact?: boolean;
  siblings?: string[];
  groupName?: string;
  language?: string;
}

/**
 * fibbers-light-row — the light row for sheets: icon, name, live value
 * (`Warm · 70%`), and a drag slider bound to brightness_pct.
 */
@customElement("fibbers-light-row")
export class FibbersLightRow extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() private config!: LightRowConfig;

  private _slider?: SliderController;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** HA calls this to seed a fresh card — pick a real light so the default isn't empty. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): LightRowConfig {
    return {
      type: "custom:fibbers-light-row",
      entity: pickEntity("light", entities, entitiesFallback, "light.example"),
    };
  }

  /** The visual editor: hand HA a shared form-editor driven by this card's schema. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & {
      schema?: unknown;
    };
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Validate + store the config; throws on a missing entity / malformed action so the editor surfaces it. */
  setConfig(config: LightRowConfig): void {
    if (!config || !config.entity) {
      throw new Error("fibbers-light-row: `entity` is required");
    }
    if (
      config.icon_tap_action != null &&
      (typeof config.icon_tap_action !== "object" ||
        typeof config.icon_tap_action.action !== "string")
    ) {
      throw new Error(
        "fibbers-light-row: `icon_tap_action` must be a HA action object (with an `action`)",
      );
    }
    this.config = config;
    // Construct the control once and reuse it — a fresh SliderHold per setConfig
    // (HA calls it per editor keystroke) would stack controllers on the element.
    // The callbacks close over `this`, so a re-config needs no rebuild.
    if (!this._slider)
      this._slider = setupSlider({
        host: this,
        guard: () => this._unavail(),
        read: (e) =>
          Math.round(pctFromX(e.clientX, e.currentTarget as Element)),
        base: () => this._displayPct(),
        commit: (v) => setLightBrightness(this.hass, this.config.entity, v),
      });
    else this._slider.hold.clear();
  }

  /** Drop any trailing debounced write so a torn-down row can't fire late. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._slider) this._slider.dispose();
  }

  // on/off-only light (supported_color_modes === ["onoff"]) → plain toggle, not a
  // slider; no attribute (legacy) means dimmable.
  private _dimmable(): boolean {
    const st = this._st();
    const modes = st && st.attributes.supported_color_modes;
    return !Array.isArray(modes) || modes.some((m: string) => m !== "onoff");
  }

  private _st(): HassEntity | undefined {
    return this.hass && this.hass.states[this.config.entity];
  }

  private _unavail(): boolean {
    return isUnavail(this._st());
  }

  private _pctFromHass(): number {
    return brightnessPct(this._st());
  }

  private _displayPct(): number {
    return this._slider!.value(this._pctFromHass(), this._unavail());
  }

  private _warmth(): string {
    const st = this._st();
    if (!st) return "";
    const hl = this.config.language || this.hass;
    const mode = st.attributes.color_mode;
    if (mode && ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode))
      return t(hl, "light_row.color");
    const k =
      st.attributes.color_temp_kelvin ||
      (st.attributes.color_temp
        ? Math.round(1e6 / st.attributes.color_temp)
        : null);
    if (k == null) return "";
    if (k < 3000) return t(hl, "light_row.warm");
    if (k < 4600) return t(hl, "light_row.neutral");
    return t(hl, "light_row.cool");
  }

  private _toggle(): void {
    if (!this.hass || this._unavail()) return;
    this.hass.callService("light", "toggle", {
      entity_id: this.config.entity,
    });
  }

  private _iconAction(): ActionConfig {
    return this.config.icon_tap_action || { action: "toggle" };
  }

  private _moreInfo(): void {
    const cfg = this.config;
    // A group member carries its siblings so the modal can switch lamps in place.
    const extra = Array.isArray(cfg.siblings)
      ? { siblings: cfg.siblings, groupName: cfg.groupName }
      : undefined;
    moreInfo(this, cfg.entity, extra);
  }

  // --- render helpers ------------------------------------------------

  private _renderIcon(
    icon: string,
    name: string,
    on: boolean,
    unavail: boolean,
  ): TemplateResult {
    const cfg = this.config;
    const act = (): void =>
      runAction(
        this._iconAction(),
        this.hass,
        this,
        cfg.icon_entity || cfg.entity,
      );
    return html`<div
      role="button"
      tabindex=${unavail ? -1 : 0}
      aria-label=${name}
      class="${cx(
        iconBox({ tone: "plain", flexNone: false }),
        "fib-hit row-span-2 transition-transform active:scale-90",
        on ? "bg-accentbg" : "bg-card2",
        unavail ? "pointer-events-none" : pressable({ hover: "bright" }),
      )}"
      @click=${act}
      @keydown=${activateOnKey(act)}
    >
      <fib-icon
        class="${cx(
          "h-[17px] w-[17px] [--mdc-icon-size:17px]",
          on ? "text-accent" : "text-muted",
        )}"
        icon=${icon}
      ></fib-icon>
    </div>`;
  }

  private _renderNameRow(
    hl: unknown,
    name: string,
    val: string,
    compact: boolean,
  ): TemplateResult {
    return html`<div
      role="button"
      tabindex="0"
      aria-label=${`${name} — ${t(hl, "common.more_info")}`}
      class="${cx(
        "flex items-center justify-between gap-2 rounded-md px-1 transition-colors",
        pressable({ hover: "tint" }),
        compact ? "min-h-[26px]" : "min-h-[var(--fib-hit)]",
      )}"
      @click=${() => this._moreInfo()}
      @keydown=${activateOnKey(() => this._moreInfo())}
    >
      <span class="flex min-w-0 items-center gap-1.5">
        <span class="truncate text-[12px] font-medium text-ink">${name}</span>
        <fib-icon
          class="h-3 w-3 flex-none [--mdc-icon-size:12px] text-muted opacity-60"
          icon="solar:colour-tuning-bold-duotone"
        ></fib-icon>
      </span>
      <span class="whitespace-nowrap text-[10.5px] text-muted">${val}</span>
    </div>`;
  }

  private _renderSlider(
    pct: number,
    name: string,
    unavail: boolean,
  ): TemplateResult {
    const s = this._slider!;
    return sliderTrack({
      pct,
      disabled: unavail,
      dragging: s.dragging,
      label: name,
      value: pct,
      min: 0,
      max: 100,
      step: 5,
      valueText: `${pct}%`,
      onInput: (v) => s.input(Math.round(v)),
      onDown: s.drag.down,
      onMove: s.drag.move,
      onUp: s.drag.up,
      onCancel: s.drag.cancel,
      onLost: s.drag.lost,
    });
  }

  private _renderToggleRow(on: boolean, name: string): TemplateResult {
    return html`<div class="flex min-h-[var(--fib-hit)] items-center">
      ${pillSwitch({
        on,
        label: name,
        onClick: () => this._toggle(),
      })}
    </div>`;
  }

  /** Draw the row: icon action, name → more-info, and a dimmer slider or plain toggle. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const st = this._st();
    const hl = cfg.language || this.hass;
    const unavail = this._unavail();
    const on = !unavail && st!.state === "on";
    const dimmable = this._dimmable();
    const pct = this._displayPct();
    const name = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:lightbulb-bold-duotone";

    let val;
    if (unavail) val = t(hl, "light_row.unavailable");
    else if (on && !dimmable) val = t(hl, "light_row.on");
    else if (on) {
      const w = this._warmth();
      val = w ? `${w} · ${pct}%` : `${pct}%`;
    } else val = t(hl, "light_row.off");

    // Compact = a group member: drop the 44px name-row min-height (it stacks on top
    // of the 44px slider, doubling each row's height) so an expanded group is tight.
    const compact = !!cfg.compact;
    return html`
      <div
        class="${cx(
          "grid grid-cols-[28px_1fr] grid-rows-[auto_auto] items-center gap-x-2.5 gap-y-0",
          compact && "py-0.5",
          unavail && "opacity-50",
        )}"
      >
        ${this._renderIcon(icon, name, on, unavail)}
        ${this._renderNameRow(hl, name, val, compact)}
        ${
          dimmable
            ? this._renderSlider(pct, name, unavail)
            : this._renderToggleRow(on, name)
        }
      </div>
    `;
  }

  /** Masonry height hint — a single-line row. */
  getCardSize(): number {
    return 1;
  }

  /** Sections-view layout: full-width, one row tall. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 1 };
  }

  /** Grid-view sizing: full-width, auto height. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
