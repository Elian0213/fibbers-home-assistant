/* ================================================================== *
 * fibbers-entities — the auto-entities replacement: a list filled from `filters`
 * (domain/state/attribute/entity_id regex/threshold/staleness). Row → more-info.
 * ================================================================== */
import {
  LitElement,
  html,
  css,
  type TemplateResult,
  type PropertyValues,
} from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t, langOf } from "@shared/i18n";
import { cardShell, iconBoxTpl, sectionLabel } from "@shared/shells";
import { twSheet } from "@shared/tw";
import { activateOnKey } from "@shared/ui";
import { moreInfo, fmtState } from "@shared/util";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import { compileFilters, matches, type EntityFilter } from "./entities-filter";
import "@shared/icon";

// Pure filter logic lives in entities-filter.ts (DOM-free, unit-tested);
// re-exported here so existing importers keep their entry point.
export { compileFilters, matches };
export type { EntityFilter };

/** YAML/editor config accepted by `fibbers-entities`. */
export interface EntitiesConfig extends LovelaceCardConfig {
  filters: EntityFilter[];
  exclude?: EntityFilter[];
  title?: string;
  icon?: string;
  empty?: string;
  sort?: string;
  secondary?: string;
  max?: number;
  language?: string;
}

const DOMAIN_ICON: Record<string, string> = {
  light: "solar:lightbulb-bold-duotone",
  switch: "solar:socket-bold-duotone",
  automation: "solar:bolt-circle-bold-duotone",
  sensor: "solar:widget-bold-duotone",
  binary_sensor: "solar:widget-bold-duotone",
  person: "solar:user-bold-duotone",
  media_player: "solar:speaker-bold-duotone",
};

/** Relative "N minutes/hours/days ago" for a timestamp, localised via `t(hl, …)`; "" on a non-timestamp. */
function ago(iso: string, hl: HomeAssistant | string | undefined): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  const mins = Math.max(0, Math.round((Date.now() - parsed) / 6e4));
  if (mins < 60) return t(hl, "common.minutes_ago", { n: mins });
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return t(hl, "common.hours_ago", { n: hrs });
  return t(hl, "common.days_ago", { n: Math.round(hrs / 24) });
}

/**
 * fibbers-entities — the auto-entities replacement: a list filled from `filters`
 * (domain/state/attribute/entity_id regex/threshold/staleness). Row → more-info.
 */
@customElement("fibbers-entities")
export class FibbersEntities extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: EntitiesConfig;

  private _filters: EntityFilter[] = [];

  private _exclude: EntityFilter[] = [];

  private _matchedHass: HomeAssistant | null = null;

  private _matchedCache: HassEntity[] | null = null;

  private _sig: string | null = null;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the card picker — an "unavailable lights" example filter. */
  static getStubConfig(): EntitiesConfig {
    return {
      type: "custom:fibbers-entities",
      title: "Unavailable",
      filters: [{ domain: "light", state: ["unavailable", "unknown"] }],
    };
  }

  /** Validate + store the config and precompile the `filters`/`exclude` regexes; throws on an empty list or a bad pattern so the editor surfaces it. */
  setConfig(config: EntitiesConfig): void {
    if (!config || !Array.isArray(config.filters) || !config.filters.length) {
      throw new Error("fibbers-entities: `filters` must be a non-empty list");
    }
    this.config = config;
    this._filters = compileFilters(config.filters, "filter");
    this._exclude = compileFilters(config.exclude, "exclude");
    this._matchedHass = null;
    this._matchedCache = null;
  }

  // Memoised by the current hass ref: shouldUpdate() and render() both need the
  // matched set, and re-scanning every state (+ sort) twice per push is wasteful
  // on a large instance.
  private _matched(): HassEntity[] {
    const { hass } = this;
    if (!hass) return [];
    if (this._matchedHass === hass) return this._matchedCache || [];
    const seen = new Set<string>();
    const out: HassEntity[] = [];
    for (const st of Object.values(hass.states)) {
      if (!this._filters.some((f) => matches(st, f))) continue;
      if (this._exclude.some((f) => matches(st, f))) continue;
      if (seen.has(st.entity_id)) continue;
      seen.add(st.entity_id);
      out.push(st);
    }
    if (this.config.sort === "last_changed") {
      out.sort(
        (a, b) => Date.parse(a.last_changed) - Date.parse(b.last_changed),
      );
    } else {
      const lang = langOf(this.config.language || this.hass);
      out.sort((a, b) => this._name(a).localeCompare(this._name(b), lang));
    }
    const { max } = this.config;
    const rows = max ? out.slice(0, max) : out;
    this._matchedHass = hass;
    this._matchedCache = rows;
    return rows;
  }

  private _name(st: HassEntity): string {
    return (st.attributes && st.attributes.friendly_name) || st.entity_id;
  }

  private _icon(st: HassEntity): string {
    if (st.attributes && st.attributes.icon) return st.attributes.icon;
    if ((st.attributes || {}).device_class === "battery")
      return "solar:battery-low-bold-duotone";
    return (
      DOMAIN_ICON[st.entity_id.split(".")[0]] || "solar:widget-bold-duotone"
    );
  }

  private _secondary(st: HassEntity): string {
    const hl = this.config.language || this.hass;
    const s = this.config.secondary || "state";
    if (s === "last_changed") return ago(st.last_changed, hl);
    if (s.startsWith("attribute:")) {
      const k = s.slice("attribute:".length);
      return String((st.attributes || {})[k] ?? "");
    }
    // HA's localised state text: enums translated, numbers formatted with the
    // unit — instead of the raw `on`/`23.4` state string.
    return fmtState(this.hass, st);
  }

  /**
   * Gate renders on a content signature of the matched rows — a card filled from
   * all of hass.states would otherwise re-render on every state push.
   */
  shouldUpdate(changed: PropertyValues): boolean {
    if (!this.config) return false;
    if (changed.has("config")) {
      this._sig = null;
      return true;
    }
    const sig = this._matched()
      .map(
        (st) =>
          `${st.entity_id}=${st.state}|${this._icon(st)}|${this._name(st)}|${this._secondary(st)}`,
      )
      .join(";");
    if (sig === this._sig) return false;
    this._sig = sig;
    return true;
  }

  // --- render helpers ------------------------------------------------

  private _renderTitle(): TemplateResult | string {
    const cfg = this.config;
    if (!cfg.title) return "";
    return sectionLabel(
      html`${
          cfg.icon
            ? html`<fib-icon
                class="h-3.5 w-3.5 [--mdc-icon-size:14px] text-muted"
                icon=${cfg.icon}
              ></fib-icon>`
            : ""
        } <span>${cfg.title}</span>`,
      { cls: "flex items-center gap-[7px] px-2.5 pb-1.5 pt-[7px]" },
    );
  }

  private _renderRow(st: HassEntity): TemplateResult {
    return html`<div
      role="button"
      tabindex="0"
      class="grid cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-x-2.5
         rounded-[10px] px-2.5 py-2 hover:bg-card2"
      @click=${() => moreInfo(this, st.entity_id)}
      @keydown=${activateOnKey(() => moreInfo(this, st.entity_id))}
    >
      ${
        // text-muted rides on the icon (not the box), so the tone stays plain
        iconBoxTpl(this._icon(st), {
          tone: "plain",
          flexNone: false,
          cls: "bg-card2",
          iconCls: "h-4 w-4 [--mdc-icon-size:16px] text-muted",
        })
      }
      <span
        class="overflow-hidden text-ellipsis whitespace-nowrap text-[12px]
           font-medium text-ink"
        >${this._name(st)}</span
      >
      <span class="whitespace-nowrap text-[10.5px] text-muted"
        >${this._secondary(st)}</span
      >
    </div>`;
  }

  private _renderEmpty(): TemplateResult | string {
    const cfg = this.config;
    if (!cfg.empty) return "";
    return html`<div
      class="flex items-center gap-[7px] px-2.5 py-3 text-[11.5px] text-muted"
    >
      <fib-icon
        class="h-[15px] w-[15px] [--mdc-icon-size:15px] text-green"
        icon="solar:check-circle-bold-duotone"
      ></fib-icon>
      <span>${cfg.empty}</span>
    </div>`;
  }

  /** Render the row list (optional title, per-row icon/name/secondary) or the `empty` all-clear line. */
  render(): TemplateResult {
    if (!this.config) return html``;
    const rows = this._matched();
    return cardShell(
      html`${this._renderTitle()}
      ${rows.length ? rows.map((st) => this._renderRow(st)) : this._renderEmpty()}`,
      { pad: "none", cls: "px-1 py-1.5" },
    );
  }

  /** Masonry height in rows. */
  getCardSize(): number {
    return 2;
  }

  /** Legacy sections-view sizing (grid_columns/grid_rows). */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 2 };
  }

  /** Current sections-view sizing — full width, auto height. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
