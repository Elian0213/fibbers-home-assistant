/* ================================================================== *
 * fibbers-light-row — the light row for sheets: icon, name, live value
 * (`Warm · 70%`), and a drag slider bound to brightness_pct.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { runAction, type ActionConfig } from "@shared/actions";
import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import {
  sliderTrack,
  sliderDrag,
  pillSwitch,
  activateOnKey,
  SliderHold,
  type SliderDragHandlers,
} from "@shared/ui";
import {
  moreInfo,
  isUnavail,
  pctFromX,
  pickEntity,
  debounce,
  type Debounced,
} from "@shared/util";
import { cx, iconBox } from "@shared/variants";
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

  @state() private config!: LightRowConfig;

  @state() private _dragging = false;

  @state() private _dragPct = 0;

  private _hold?: SliderHold;

  private _drag!: SliderDragHandlers;

  private _debouncedCommit!: Debounced<[number]>;

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
    this._dragging = false;
    this._dragPct = 0;
    this._debouncedCommit = debounce((v: number) => this._commit(v), 150);
    // Shared drag gesture: live-track past the slop, final value wins on release.
    this._drag = sliderDrag({
      guard: () => this._unavail(),
      read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget as Element)),
      frame: (v, dragging) => {
        this._dragging = dragging;
        if (v != null) this._dragPct = v;
      },
      live: (v) => this._debouncedCommit(v),
      end: (v) => {
        if (v == null) {
          this._debouncedCommit.cancel();
          return;
        }
        this._debouncedCommit(v); // pending = release value
        this._debouncedCommit.flush(); // commit now (deduped vs the live commit)
      },
    });
    // Construct the hold once and reuse it — a fresh controller per setConfig (HA
    // calls it per editor keystroke) would stack controllers on the element.
    if (!this._hold)
      this._hold = new SliderHold(this, { tolerance: 2, timeout: 5000 });
    else this._hold.clear();
  }

  /** Drop any trailing debounced write so a torn-down row can't fire late. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._debouncedCommit) this._debouncedCommit.cancel();
  }

  /**
   * Optimistically show `pct` until this row's own entity catches up — called by a
   * parent light-group so member sliders track a master change immediately instead
   * of lagging HA's per-member state push and then jumping ("teleport").
   * @param pct
   */
  holdDisplay(pct: number): void {
    if (!this._hold) return;
    this._hold.hold(pct);
    this.requestUpdate();
  }

  /** Drop the optimistic hold (e.g. the parent's group service call failed). */
  clearDisplay(): void {
    if (this._hold) this._hold.clear();
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
    const st = this._st();
    if (!st || st.state !== "on") return 0;
    const b = st.attributes.brightness;
    return b != null ? Math.round((b / 255) * 100) : 100;
  }

  private _displayPct(): number {
    return this._hold!.value(this._pctFromHass(), {
      dragging: this._dragging,
      dragValue: this._dragPct,
      gone: this._unavail(),
    });
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

  private _commit(pct: number): void {
    if (!this.hass) return;
    this._hold!.hold(pct); // show the committed value until the bulb catches up
    const entityId = this.config.entity;
    const p =
      pct <= 0
        ? this.hass.callService("light", "turn_off", { entity_id: entityId })
        : this.hass.callService("light", "turn_on", {
            entity_id: entityId,
            brightness_pct: pct,
          });
    // A failed service call must not freeze the display on the optimistic value.
    Promise.resolve(p).catch(() => this._hold!.clear());
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
        unavail ? "pointer-events-none" : "cursor-pointer",
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
        "flex cursor-pointer items-center justify-between gap-2",
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
    return sliderTrack({
      pct,
      disabled: unavail,
      dragging: this._dragging,
      label: name,
      value: pct,
      min: 0,
      max: 100,
      step: 5,
      valueText: `${pct}%`,
      // Keyboard: arm the hold now (display advances, held keys keep
      // stepping) but debounce the write — auto-repeat fired ~30
      // light.turn_on calls a second straight at the committer.
      onInput: (v) => {
        const p = Math.round(v);
        this._hold!.hold(p);
        this._debouncedCommit(p);
      },
      onDown: this._drag.down,
      onMove: this._drag.move,
      onUp: this._drag.up,
      onCancel: this._drag.cancel,
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
