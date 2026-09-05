/* ================================================================== *
 * fibbers-greeting — time-of-day header + a lights/presence/sensor subline
 * ("4 of 7 lights on · 2 offline · Elian home · 19.2 °C").
 * A light group is expanded to its members; offline lights counted separately.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { fmtNum, fmtState, isUnavail, pickEntity } from "@shared/util";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import "@shared/icon";

interface Period {
  until: number;
  key: string;
  icon: string;
}

const PERIODS: Period[] = [
  { until: 6, key: "night", icon: "solar:moon-stars-bold-duotone" },
  { until: 12, key: "morning", icon: "solar:sunrise-bold-duotone" },
  { until: 18, key: "afternoon", icon: "solar:sun-bold-duotone" },
  { until: 23, key: "evening", icon: "solar:moon-bold-duotone" },
  { until: 24, key: "night", icon: "solar:moon-stars-bold-duotone" },
];

const friendly = (st: HassEntity | undefined, id: string): string =>
  (st && st.attributes && (st.attributes.friendly_name as string)) || id;

// Join names as "A", "A and B", "A, B and C" (the conjunction is localised).
function joinNames(names: string[], and: string): string {
  if (names.length <= 1) return names[0] || "";
  return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/** YAML/editor config accepted by `fibbers-greeting`. */
export interface GreetingConfig extends LovelaceCardConfig {
  lights?: string | string[];
  people?: string[];
  sensors?: string[];
  name_from?: string;
  language?: string;
}

/**
 * fibbers-greeting — time-of-day header plus a lights/presence/sensor subline
 * ("4 of 7 lights on · 2 offline · Elian home · 19.2 °C"). Light groups expand to
 * members; offline lights are counted separately.
 */
@customElement("fibbers-greeting")
export class FibbersGreeting extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: GreetingConfig;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Starter config for the picker; seeds a light from the dashboard's entities. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): GreetingConfig {
    return {
      type: "custom:fibbers-greeting",
      lights: pickEntity("light", entities, entitiesFallback, "light.example"),
    };
  }

  /** Store the config (all fields optional beyond its presence). */
  setConfig(config: GreetingConfig): void {
    if (!config) throw new Error("fibbers-greeting: config required");
    this.config = config;
  }

  private _period(): Period {
    const h = new Date().getHours();
    return PERIODS.find((p) => h < p.until) || PERIODS[PERIODS.length - 1];
  }

  private _lightMembers(): string[] {
    const l = this.config.lights;
    if (Array.isArray(l)) return l;
    if (typeof l === "string") {
      const st = this.hass && this.hass.states[l];
      const grp = st && st.attributes && st.attributes.entity_id;
      return Array.isArray(grp) ? grp : [l];
    }
    return [];
  }

  private _people(): string[] {
    const cfg = this.config;
    if (Array.isArray(cfg.people)) return cfg.people;
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter((id) => id.startsWith("person."))
      .sort();
  }

  private _subline(): string {
    const { hass } = this;
    if (!hass) return "";
    const hl = this.config.language || hass;
    const parts: string[] = [];

    const members = this._lightMembers();
    if (members.length) {
      let on = 0;
      let offline = 0;
      members.forEach((id) => {
        const st = hass.states[id];
        if (isUnavail(st)) offline++;
        else if (st.state === "on") on++;
      });
      parts.push(t(hl, "greeting.lights_on", { on, total: members.length }));
      if (offline) parts.push(t(hl, "greeting.offline_count", { n: offline }));
    }

    const home = this._people()
      .map((id) => hass.states[id])
      .filter((st) => st && st.state === "home")
      .map((st, i, arr) => friendly(st, arr[i].entity_id));
    parts.push(
      home.length
        ? t(hl, "greeting.someone_home", {
            names: joinNames(home, t(hl, "common.and")),
          })
        : t(hl, "greeting.nobody_home"),
    );

    (this.config.sensors || []).forEach((id) => {
      const st = hass.states[id];
      if (!st) return;
      const unit = st.attributes.unit_of_measurement || "";
      const n = Number(st.state);
      const val = Number.isFinite(n)
        ? `${fmtNum(hass, n)}${unit ? ` ${unit}` : ""}`
        : fmtState(hass, st);
      if (val) parts.push(val);
    });

    return parts.join(" · ");
  }

  /** Period icon + greeting title (optionally ", <name>") over the live subline. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const period = this._period();
    let title = t(hl, `greeting.${period.key}`);
    if (cfg.name_from) {
      const st = this.hass && this.hass.states[cfg.name_from];
      const nm = st && st.attributes && st.attributes.friendly_name;
      if (nm) title += `, ${nm}`;
    }

    return html`<div class="flex items-center gap-3 px-1 py-2">
      <fib-icon
        class="h-7 w-7 flex-none [--mdc-icon-size:28px] text-accent"
        icon=${period.icon}
      ></fib-icon>
      <div class="min-w-0">
        <div class="text-[20px] font-semibold leading-tight text-ink">
          ${title}
        </div>
        <div class="truncate text-[12px] text-muted">${this._subline()}</div>
      </div>
    </div>`;
  }

  /** One masonry row. */
  getCardSize(): number {
    return 1;
  }

  /** Full-width, single-row footprint in the sections/grid layout. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 1 };
  }

  /** Span the full grid width; height follows content. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
