/* ================================================================== *
 * fibbers-light-group — a master light control, heavier than a row: card
 * surface, room icon, a power toggle, and a taller master slider driving
 * `brightness_pct` on the group (or an `entities` list). Tapping anywhere else
 * on the tile opens the multi-lamp light-detail sheet for the members.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

import { setLightBrightness } from "@shared/actions";
import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import {
  stepFromKey,
  setupSlider,
  pillSwitch,
  type SliderController,
} from "@shared/ui";
import {
  isUnavail,
  brightnessPct,
  moreInfo,
  pctFromX,
  pickEntity,
} from "@shared/util";
import { cx } from "@shared/variants";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

const isLight = (id: unknown): id is string =>
  typeof id === "string" && id.startsWith("light.");

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: { domain: "light" } } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
];

/** Aggregate state derived from the group's members. */
interface GroupState {
  on: number;
  total: number;
  off: number;
  pct: number;
  mixed: boolean;
  allOff: boolean;
}

/** YAML/editor config accepted by `fibbers-light-group`. Unknown keys (e.g. the
 * retired `expanded`/`show_scenes`) are ignored. */
export interface LightGroupConfig extends LovelaceCardConfig {
  entity?: string;
  entities?: string[];
  members?: string[];
  name?: string;
  icon?: string;
}

/**
 * fibbers-light-group — a master light control, heavier than a row: card surface,
 * room icon, a power toggle, and a taller master slider. Tapping anywhere except
 * the slider or the toggle opens the multi-lamp light-detail sheet.
 */
@customElement("fibbers-light-group")
export class FibbersLightGroup extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() private config!: LightGroupConfig;

  private _slider?: SliderController;

  private _loggedGhosts = false;

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
  ): LightGroupConfig {
    return {
      type: "custom:fibbers-light-group",
      entities: [
        pickEntity("light", entities, entitiesFallback, "light.example"),
      ],
      name: "Lights",
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

  /** Validate + store the config; throws on a missing group/entities so the editor surfaces it. */
  setConfig(config: LightGroupConfig): void {
    if (!config || (!config.entity && !Array.isArray(config.entities))) {
      throw new Error(
        "fibbers-light-group: `entity` (a group) or `entities` is required",
      );
    }
    this.config = config;
    this._loggedGhosts = false;
    // Construct the slider control once and reuse it — a fresh SliderHold per
    // setConfig (HA calls it per editor keystroke) would stack controllers on the
    // element. The callbacks close over `this`, so a re-config needs no rebuild.
    if (!this._slider)
      this._slider = setupSlider({
        host: this,
        guard: () => this._state().allOff,
        read: (e) =>
          Math.round(pctFromX(e.clientX, e.currentTarget as Element)),
        base: () => this._displayPct(this._state()),
        commit: (v) =>
          setLightBrightness(
            this.hass,
            this.config.entity || this._members(),
            v,
          ),
      });
    else this._slider.hold.clear();
  }

  /** Drop the trailing debounced commit on unmount so a stale value never fires. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._slider) this._slider.dispose();
  }

  // Member ids: explicit `members`/`entities`, else the group's own members with
  // ghost ids (no state object — e.g. a stale Hue entry) skipped, not counted.
  private _members(): string[] {
    const cfg = this.config;
    if (Array.isArray(cfg.members)) return cfg.members.filter(isLight);
    if (Array.isArray(cfg.entities)) return cfg.entities.filter(isLight);
    const st = cfg.entity && this.hass && this.hass.states[cfg.entity];
    const ids: string[] =
      (st && st.attributes && st.attributes.entity_id) || [];
    const live = ids.filter((id) => this.hass && this.hass.states[id]);
    if (!this._loggedGhosts && live.length !== ids.length) {
      this._loggedGhosts = true;
      console.debug(
        `fibbers-light-group: skipped ${ids.length - live.length} member(s) of ${cfg.entity} with no state object`,
      );
    }
    return live;
  }

  // Aggregate: how many on, average brightness, whether they differ (mixed).
  private _state(): GroupState {
    const { hass } = this;
    const members = this._members();
    if (!hass || !members.length)
      return { on: 0, total: 0, off: 0, pct: 0, mixed: false, allOff: true };
    let on = 0;
    let avail = 0;
    let off = 0;
    let sum = 0;
    let withBrightness = 0;
    let bmin = Infinity;
    let bmax = -Infinity;
    members.forEach((id) => {
      const st = hass.states[id];
      if (isUnavail(st)) {
        off += 1;
        return;
      }
      avail += 1;
      if (st.state === "on") {
        on += 1;
        // Only members that actually report a brightness feed the average — an
        // on/off member with no `brightness` used to inject a phantom 100% and
        // drag the master slider up.
        if (st.attributes.brightness != null) {
          const pct = brightnessPct(st);
          sum += pct;
          withBrightness += 1;
          bmin = Math.min(bmin, pct);
          bmax = Math.max(bmax, pct);
        }
      }
    });
    let pct: number;
    if (withBrightness) pct = Math.round(sum / withBrightness);
    else pct = on ? 100 : 0;
    return {
      on,
      total: members.length,
      off,
      pct,
      mixed: withBrightness > 1 && bmax - bmin > 2,
      allOff: avail === 0,
    };
  }

  private _secondary(s: GroupState): string {
    const hl = this.hass;
    if (s.allOff) return t(hl, "light_group.offline");
    if (s.on === 0) return t(hl, "light_group.off");
    const base = t(hl, "light_group.state_count", {
      on: s.on,
      total: s.total,
      pct: s.pct,
    });
    return s.off
      ? `${base} · ${t(hl, "light_group.offline_count", { off: s.off })}`
      : base;
  }

  // The value the master slider shows: the group average with drag/hold applied.
  private _displayPct(s: GroupState): number {
    return Math.round(this._slider!.value(s.pct, s.allOff));
  }

  // Keyboard control for the master slider (arrows/Home/End/PageUp-Down by 5%).
  // Steps from the on-screen value (the held/dragged one) — not the raw entity —
  // so repeated key presses during a hold don't jump back to the stale brightness.
  private _onKey(e: KeyboardEvent): void {
    const s = this._state();
    if (s.allOff) return;
    const cur = this._displayPct(s);
    const next = stepFromKey(e.key, { value: cur, min: 0, max: 100, step: 5 });
    if (next == null) return;
    e.preventDefault();
    if (next !== cur) this._slider!.input(next);
  }

  // The power toggle: any member on → all off; all off → all on. Same target as
  // the master slider (the group entity when there is one, else the members).
  private _togglePower(s: GroupState): void {
    if (!this.hass || s.allOff) return;
    const target = this.config.entity || this._members();
    Promise.resolve(
      this.hass.callService("light", s.on > 0 ? "turn_off" : "turn_on", {
        entity_id: target,
      }),
    ).catch(() => {});
  }

  // Tap-through on the tile: open the multi-lamp detail sheet, focused on the
  // first lit member (else the first), carrying the members as siblings.
  private _moreInfo(): void {
    const lights = this._members();
    if (!lights.length) return;
    const id =
      lights.find((l) => {
        const st = this.hass && this.hass.states[l];
        return !!st && st.state === "on";
      }) || lights[0];
    moreInfo(this, id, { siblings: lights, groupName: this.config.name });
  }

  // --- render helpers ------------------------------------------------

  // The header row is inert content over the tap-through underlay
  // (pointer-events-none on the row, set by render); only the power toggle
  // re-enables its own pointer events on top.
  private _renderHeader(
    hl: unknown,
    s: GroupState,
    name: string,
    icon: string,
    lit: boolean,
  ): TemplateResult {
    return html`<div
      class="pointer-events-none relative flex items-center gap-3"
    >
      <div
        class="${cx(
          "flex h-9 w-9 flex-none items-center justify-center rounded-[10px]",
          lit ? "bg-accentbg" : "bg-card2",
        )}"
      >
        <fib-icon
          class="${cx(
            "h-[19px] w-[19px] [--mdc-icon-size:19px]",
            lit ? "text-accent" : "text-muted",
          )}"
          icon=${icon}
        ></fib-icon>
      </div>
      <div class="min-w-0 flex-1 text-left">
        <div class="truncate text-[13px] font-semibold text-ink">${name}</div>
        <div
          class="${cx(
            "truncate text-[11px]",
            s.allOff ? "text-red" : "text-muted",
          )}"
        >
          ${this._secondary(s)}
        </div>
      </div>
      <span class="pointer-events-auto flex items-center">
        ${pillSwitch({
          on: s.on > 0,
          label: t(hl, "light_group.toggle"),
          onClick: () => this._togglePower(s),
        })}
      </span>
    </div>`;
  }

  private _renderMasterSlider(
    name: string,
    s: GroupState,
    pct: number,
  ): TemplateResult {
    const { drag } = this._slider!;
    // touch-none, not pan-y: a slightly-vertical touch drag must stay a drag —
    // with pan-y the browser claims it for scrolling and cancels the gesture.
    return html`<div
      class="${cx(
        "group relative mt-2 flex h-[var(--fib-hit)] cursor-pointer touch-none items-center",
        s.allOff && "pointer-events-none opacity-50",
      )}"
      role="slider"
      tabindex=${s.allOff ? -1 : 0}
      aria-label=${name}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${pct}
      aria-valuetext=${`${pct}%`}
      aria-disabled=${s.allOff ? "true" : "false"}
      @pointerdown=${drag.down}
      @pointermove=${drag.move}
      @pointerup=${drag.up}
      @pointercancel=${drag.cancel}
      @lostpointercapture=${drag.lost}
      @keydown=${this._onKey}
    >
      <div
        class="pointer-events-none relative h-2.5 w-full rounded-full bg-track"
      >
        ${s.allOff ? "" : this._renderTrackFill(pct, s.mixed)}
      </div>
    </div>`;
  }

  private _renderTrackFill(pct: number, mixed: boolean): TemplateResult {
    return html`<div
        class="absolute bottom-0 left-0 top-0 rounded-full bg-accent"
        style=${styleMap({
          width: `${pct}%`,
          backgroundImage: mixed
            ? "repeating-linear-gradient(45deg,transparent 0,transparent 4px,rgba(0,0,0,.18) 4px,rgba(0,0,0,.18) 8px)"
            : undefined,
        })}
      ></div>
      <div
        class="${cx(
          `pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2
           whitespace-nowrap rounded-md border border-line bg-card2 px-2 py-1
           text-[11px] font-semibold tabular-nums text-ink
           shadow-[0_2px_10px_rgba(0,0,0,.5)] transition-[opacity,transform]
           duration-100 group-focus-visible:scale-100
           group-focus-visible:opacity-100`,
          this._slider!.dragging
            ? "scale-100 opacity-100"
            : "scale-90 opacity-0",
        )}"
        style="left:${pct}%"
      >
        ${pct}%
      </div>
      <div
        class="${cx(
          `absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full
           bg-accent shadow-[0_1px_4px_rgba(0,0,0,.5)]
           transition-[width,height] duration-100`,
          this._slider!.dragging ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]",
        )}"
        style="left:${pct}%"
      ></div>`;
  }

  /** Draw the tile: a tap-through underlay (→ the multi-lamp detail sheet) under
   * the header (icon, name, power toggle) and the master slider. Button-underlay
   * pattern: a full-size transparent button sits behind pointer-events-none
   * content, and the toggle/slider re-enable their own pointer events on top —
   * so nothing is nested inside an interactive element. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = this.hass;
    const s = this._state();
    const lit = s.on > 0;
    const pct = this._displayPct(s);
    const name = cfg.name || t(hl, "light_group.default_name");
    const icon = cfg.icon || "solar:lightbulb-bold-duotone";

    return html`<div
      class="${cx(
        "relative rounded-[15px] border p-[13px]",
        lit ? "fib-lit" : "border-line bg-card",
        s.allOff && "opacity-[.66]",
      )}"
    >
      <button
        type="button"
        class="absolute inset-0 cursor-pointer rounded-[15px] transition-colors
               hover:bg-white/[.04]"
        aria-label=${`${name} — ${t(hl, "common.more_info")}`}
        @click=${() => this._moreInfo()}
      ></button>
      ${this._renderHeader(hl, s, name, icon, lit)}
      ${this._renderMasterSlider(name, s, pct)}
    </div>`;
  }

  /** Masonry height hint (header + slider ≈ 2 rows). */
  getCardSize(): number {
    return 2;
  }

  /** Sections-view layout: full-width, two rows tall. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 2 };
  }

  /** Grid-view sizing: full-width, auto height. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
