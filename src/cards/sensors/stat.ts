/* ================================================================== *
 * fibbers-stat — value tile: icon, label, value + unit, optional trend.
 * Reads `entity` or a literal `value`; tap runs `tap_action` (default more-info).
 * ================================================================== */
import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { runAction, type ActionConfig } from "@shared/actions";
import { twSheet } from "@shared/tw";
import { activateOnKey } from "@shared/ui";
import { fmtNum, fmtState, isUnavail, pickEntity } from "@shared/util";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon"; // registers <fib-icon>

/** YAML/editor config accepted by `fibbers-stat`. */
export interface StatConfig extends LovelaceCardConfig {
  entity?: string;
  value?: string | number;
  name?: string;
  icon?: string;
  unit?: string;
  color?: string;
  decimals?: number;
  sub?: string;
  trend?: string;
  tap_action?: ActionConfig;
  absolute_time?: boolean;
}

const COLORS = ["accent", "amber", "blue", "green", "red"];

/** Icon-box background + foreground per colour — full class strings so Tailwind's scanner keeps them. */
const IC: Record<string, string> = {
  accent: "bg-accentbg text-accent",
  amber: "bg-amberbg text-amber",
  blue: "bg-bluebg text-blueink",
  green: "bg-accentbg text-green",
  red: "bg-amberbg text-red",
};

/** Locale-aware number formatting; leaves non-numeric states intact. */
const fmt = (
  hass: HomeAssistant | undefined,
  raw: string | number,
  decimals?: number,
): string => {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) ? fmtNum(hass, n, decimals) : String(raw);
};

// ha-form schema for the visual editor (getConfigElement). Unlisted keys (value,
// sub, trend, tap_action) pass through untouched — a YAML config round-trips.
const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: {} } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "unit", selector: { text: {} } },
  {
    name: "color",
    selector: {
      select: {
        mode: "dropdown",
        options: COLORS.map((c) => ({ value: c, label: c })),
      },
    },
  },
  { name: "decimals", selector: { number: { min: 0, max: 4, mode: "box" } } },
];

/**
 * fibbers-stat — value tile: icon, label, value + unit, optional trend. Reads
 * `entity` or a literal `value`; tap runs `tap_action` (default more-info).
 */
@customElement("fibbers-stat")
export class FibbersStat extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: StatConfig;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the card picker — picks a real sensor if one exists. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): StatConfig {
    return {
      type: "custom:fibbers-stat",
      entity: pickEntity(
        "sensor",
        entities,
        entitiesFallback,
        "sensor.example",
      ),
    };
  }

  /** Visual editor element, wired to EDITOR_SCHEMA. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & {
      schema?: unknown;
    };
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Validate + store the config; throws when neither `entity` nor `value` is set, or `color` is out of range, so the editor surfaces it. */
  setConfig(config: StatConfig): void {
    if (!config || (!config.entity && config.value == null)) {
      throw new Error("fibbers-stat: `entity` or `value` is required");
    }
    if (config.color != null && !COLORS.includes(config.color)) {
      throw new Error(
        `fibbers-stat: \`color\` must be one of ${COLORS.join(", ")}`,
      );
    }
    this.config = config;
  }

  private _st(): HassEntity | null {
    return this.config && this.config.entity && this.hass
      ? this.hass.states[this.config.entity]
      : null;
  }

  private _offline(): boolean {
    if (!this.config.entity) return false;
    return isUnavail(this._st());
  }

  private _tap(): void {
    const cfg = this.config;
    const tap = cfg.tap_action || (cfg.entity ? { action: "more-info" } : null);
    if (tap && tap.action !== "none")
      runAction(tap, this.hass, this, cfg.entity);
  }

  /** Render the tile — resolves value/unit/trend from config or entity state. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const st = this._st();
    const offline = this._offline();
    const color = cfg.color || "accent";

    const icon =
      cfg.icon || (st && st.attributes.icon) || "solar:widget-bold-duotone";
    const label =
      cfg.name || (st && st.attributes.friendly_name) || cfg.entity || "";
    // A literal `value` is kept verbatim through `fmt`. A timestamp entity renders
    // relative ("2 days ago", live-updating) so an absolute date can't overflow the
    // tile — `absolute_time: true` opts back into the full value. Numeric states go
    // through the locale-aware formatter; anything else (motion, enum) → HA's own
    // localiser instead of printing the raw slug.
    const deviceClass = st && st.attributes && st.attributes.device_class;
    let value = "";
    let valueTpl: TemplateResult | null = null;
    if (offline) value = "—";
    else if (cfg.value != null) value = fmt(this.hass, cfg.value, cfg.decimals);
    else if (
      deviceClass === "timestamp" &&
      !cfg.absolute_time &&
      !Number.isNaN(Date.parse(st!.state))
    ) {
      // <ha-relative-time> is HA's own element — if the frontend hasn't defined it
      // (older core, some contexts) it would render blank, so fall back to HA's
      // localised state string.
      if (customElements.get("ha-relative-time")) {
        valueTpl = html`<ha-relative-time
          .hass=${this.hass}
          .datetime=${new Date(st!.state)}
        ></ha-relative-time>`;
      } else {
        value = fmtState(this.hass, st);
      }
    } else {
      const n = Number(String(st!.state).replace(",", "."));
      value = Number.isFinite(n)
        ? fmtNum(this.hass, n, cfg.decimals)
        : fmtState(this.hass, st);
    }
    // eslint-disable-next-line no-nested-ternary -- offline → "", else explicit unit, else the entity's unit
    const unit = offline
      ? ""
      : cfg.unit != null
        ? cfg.unit
        : (st && st.attributes.unit_of_measurement) || "";
    const trend = ["up", "down", "flat"].includes(cfg.trend as string)
      ? cfg.trend
      : null;
    // eslint-disable-next-line no-nested-ternary -- up/down/flat glyph
    const trendChar = trend === "up" ? "▲" : trend === "down" ? "▼" : "—";
    const trendCls =
      // eslint-disable-next-line no-nested-ternary -- up/down/flat colour class
      trend === "up"
        ? "text-red"
        : trend === "down"
          ? "text-accent"
          : "text-muted";

    const tappable = cfg.tap_action || cfg.entity;

    return html`
      <div
        class="grid grid-cols-[34px_1fr] items-center gap-x-3 gap-y-0.5 rounded-[14px]
               border border-line bg-card p-3 shadow-[0_1px_3px_rgba(0,0,0,.35)]
               ${tappable ? "cursor-pointer" : ""}"
        role=${tappable ? "button" : "presentation"}
        tabindex=${tappable ? 0 : nothing}
        @click=${() => tappable && this._tap()}
        @keydown=${tappable ? activateOnKey(() => this._tap()) : nothing}
      >
        <div
          class="row-span-2 flex h-[34px] w-[34px] items-center justify-center rounded-[10px]
                 ${offline ? "bg-card2 text-muted" : IC[color]}"
        >
          <fib-icon
            class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
            icon=${icon}
          ></fib-icon>
        </div>

        <div class="text-[11px] font-medium text-muted">${label}</div>

        <div class="flex items-baseline gap-[5px]">
          <span
            class="text-[22px] font-semibold leading-tight tracking-tight
                   ${offline ? "text-muted" : "text-ink"}"
            >${valueTpl || value}</span
          >
          <span class="text-[12px] font-medium text-ink2">${unit}</span>
          ${
            trend
              ? html`<span class="ml-0.5 text-[11px] font-semibold ${trendCls}"
                  >${trendChar}</span
                >`
              : ""
          }
        </div>

        ${
          cfg.sub
            ? html`<div class="col-start-2 text-[10.5px] text-muted">
                ${cfg.sub}
              </div>`
            : ""
        }
      </div>
    `;
  }

  /** Masonry height in rows — one line, so 1. */
  getCardSize(): number {
    return 1;
  }

  /** Legacy sections-view sizing (grid_columns/grid_rows). */
  getLayoutOptions(): { grid_columns: number; grid_rows: number } {
    return { grid_columns: 6, grid_rows: 1 };
  }

  /** Current sections-view sizing — half-width, auto height, min 3 columns. */
  getGridOptions(): { columns: number; rows: string; min_columns: number } {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
