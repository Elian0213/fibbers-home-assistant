/* ================================================================== *
 * fibbers-greeting — Dutch time-of-day header + a lights/presence/sensor subline
 * ("4 van 7 lampen aan · 2 offline · Elian thuis · 19,2 °C").
 * A light group is expanded to its members; offline lights counted separately.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { twSheet } from "../tw.js";
import { nl, fmtState, isUnavail } from "../util.js";
import "../icon.js";

const PERIODS = [
  { until: 6, word: "Goedenacht", icon: "solar:moon-stars-bold-duotone" },
  { until: 12, word: "Goedemorgen", icon: "solar:sunrise-bold-duotone" },
  { until: 18, word: "Goedemiddag", icon: "solar:sun-bold-duotone" },
  { until: 23, word: "Goedenavond", icon: "solar:moon-bold-duotone" },
  { until: 24, word: "Goedenacht", icon: "solar:moon-stars-bold-duotone" },
];

const friendly = (st, id) =>
  (st && st.attributes && st.attributes.friendly_name) || id;

// Join names as "A", "A en B", "A, B en C".
function joinNames(names) {
  if (names.length <= 1) return names[0] || "";
  return `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
}

export class FibbersGreeting extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
  };

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  static getStubConfig() {
    return {
      type: "custom:fibbers-greeting",
      lights: "light.all_color_lights",
    };
  }

  setConfig(config) {
    if (!config) throw new Error("fibbers-greeting: config required");
    this._config = config;
  }

  _period() {
    const h = new Date().getHours();
    return PERIODS.find((p) => h < p.until) || PERIODS[PERIODS.length - 1];
  }

  _lightMembers() {
    const l = this._config.lights;
    if (Array.isArray(l)) return l;
    if (typeof l === "string") {
      const st = this.hass && this.hass.states[l];
      const grp = st && st.attributes && st.attributes.entity_id;
      return Array.isArray(grp) ? grp : [l];
    }
    return [];
  }

  _people() {
    const cfg = this._config;
    if (Array.isArray(cfg.people)) return cfg.people;
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter((id) => id.startsWith("person."))
      .sort();
  }

  _subline() {
    const hass = this.hass;
    if (!hass) return "";
    const parts = [];

    const members = this._lightMembers();
    if (members.length) {
      let on = 0;
      let offline = 0;
      members.forEach((id) => {
        const st = hass.states[id];
        if (isUnavail(st)) offline++;
        else if (st.state === "on") on++;
      });
      parts.push(`${on} van ${members.length} lampen aan`);
      if (offline) parts.push(`${offline} offline`);
    }

    const home = this._people()
      .map((id) => hass.states[id])
      .filter((st) => st && st.state === "home")
      .map((st, i, arr) => friendly(st, arr[i].entity_id));
    parts.push(home.length ? `${joinNames(home)} thuis` : "Niemand thuis");

    (this._config.sensors || []).forEach((id) => {
      const st = hass.states[id];
      if (!st) return;
      const unit = st.attributes.unit_of_measurement || "";
      const n = Number(st.state);
      const val = Number.isFinite(n)
        ? `${nl(n)}${unit ? ` ${unit}` : ""}`
        : fmtState(hass, st);
      if (val) parts.push(val);
    });

    return parts.join(" · ");
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const period = this._period();
    let title = period.word;
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

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 1 };
  }
}
