/* ================================================================== *
 * fibbers-entities — the auto-entities replacement: a list filled from `filters`
 * (domain/state/attribute/entity_id regex/threshold/staleness). Row → more-info.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { twSheet } from "../tw.js";
import { moreInfo } from "../util.js";
import "../icon.js";

const DOMAIN_ICON = {
  light: "solar:lightbulb-bold-duotone",
  switch: "solar:socket-bold-duotone",
  automation: "solar:bolt-circle-bold-duotone",
  sensor: "solar:widget-bold-duotone",
  binary_sensor: "solar:widget-bold-duotone",
  person: "solar:user-bold-duotone",
  media_player: "solar:speaker-bold-duotone",
};

const num = (s) => parseFloat(String(s).replace(",", "."));

function ago(iso) {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 6e4));
  if (mins < 60) return `${mins} min geleden`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} uur geleden`;
  return `${Math.round(hrs / 24)} dagen geleden`;
}

// Precompile each filter's `entity_id` regex once (in setConfig), validating it
// there so a bad pattern is a clear config error instead of a per-render throw.
function compileFilters(filters, label) {
  return (filters || []).map((f) => {
    if (!f.entity_id) return f;
    try {
      return { ...f, _re: new RegExp(f.entity_id) };
    } catch (e) {
      throw new Error(
        `fibbers-entities: invalid ${label} entity_id regex "${f.entity_id}" — ${e.message}`,
      );
    }
  });
}

function matches(st, f) {
  if (f.domain && !st.entity_id.startsWith(`${f.domain}.`)) return false;
  if (f._re && !f._re.test(st.entity_id)) return false;
  if (f.state != null) {
    const want = Array.isArray(f.state) ? f.state : [f.state];
    if (!want.map(String).includes(String(st.state))) return false;
  }
  if (f.state_not != null) {
    const no = Array.isArray(f.state_not) ? f.state_not : [f.state_not];
    if (no.map(String).includes(String(st.state))) return false;
  }
  if (f.attributes) {
    for (const [k, v] of Object.entries(f.attributes)) {
      if (String((st.attributes || {})[k]) !== String(v)) return false;
    }
  }
  if (f.below != null && !(num(st.state) < f.below)) return false;
  if (f.above != null && !(num(st.state) > f.above)) return false;
  if (f.stale_hours != null) {
    const t = Date.parse(st.last_changed);
    if (isNaN(t) || (Date.now() - t) / 3.6e6 < f.stale_hours) return false;
  }
  return true;
}

export class FibbersEntities extends LitElement {
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
      type: "custom:fibbers-entities",
      title: "Onbereikbaar",
      filters: [{ domain: "light", state: ["unavailable", "unknown"] }],
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.filters) || !config.filters.length) {
      throw new Error("fibbers-entities: `filters` must be a non-empty list");
    }
    this._config = config;
    this._filters = compileFilters(config.filters, "filter");
    this._exclude = compileFilters(config.exclude, "exclude");
  }

  _matched() {
    const hass = this.hass;
    if (!hass) return [];
    const seen = new Set();
    const out = [];
    for (const st of Object.values(hass.states)) {
      if (!this._filters.some((f) => matches(st, f))) continue;
      if (this._exclude.some((f) => matches(st, f))) continue;
      if (seen.has(st.entity_id)) continue;
      seen.add(st.entity_id);
      out.push(st);
    }
    if (this._config.sort === "last_changed") {
      out.sort(
        (a, b) => Date.parse(a.last_changed) - Date.parse(b.last_changed),
      );
    } else {
      out.sort((a, b) => this._name(a).localeCompare(this._name(b), "nl"));
    }
    const max = this._config.max;
    return max ? out.slice(0, max) : out;
  }

  _name(st) {
    return (st.attributes && st.attributes.friendly_name) || st.entity_id;
  }
  _icon(st) {
    if (st.attributes && st.attributes.icon) return st.attributes.icon;
    if ((st.attributes || {}).device_class === "battery")
      return "solar:battery-low-bold-duotone";
    return (
      DOMAIN_ICON[st.entity_id.split(".")[0]] || "solar:widget-bold-duotone"
    );
  }
  _secondary(st) {
    const s = this._config.secondary || "state";
    if (s === "last_changed") return ago(st.last_changed);
    if (s.startsWith("attribute:")) {
      const k = s.slice("attribute:".length);
      return String((st.attributes || {})[k] ?? "");
    }
    const u = (st.attributes || {}).unit_of_measurement;
    return u ? `${st.state} ${u}` : st.state;
  }
  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const rows = this._matched();
    return html`<div
      class="rounded-[14px] border border-line bg-card px-1 py-1.5"
    >
      ${
        cfg.title
          ? html`<div
              class="flex items-center gap-[7px] px-2.5 pb-1.5 pt-[7px] text-[10px]
                   font-semibold uppercase tracking-[0.08em] text-muted"
            >
              ${
                cfg.icon
                  ? html`<fib-icon
                      class="h-3.5 w-3.5 [--mdc-icon-size:14px] text-muted"
                      icon=${cfg.icon}
                    ></fib-icon>`
                  : ""
              }
              <span>${cfg.title}</span>
            </div>`
          : ""
      }
      ${
        rows.length
          ? rows.map(
              (st) =>
                html`<div
                  role="button"
                  class="grid cursor-pointer grid-cols-[28px_1fr_auto] items-center gap-x-2.5
                     rounded-[10px] px-2.5 py-2 hover:bg-card2"
                  @click=${() => moreInfo(this, st.entity_id)}
                >
                  <div
                    class="flex h-7 w-7 items-center justify-center rounded-lg bg-card2"
                  >
                    <fib-icon
                      class="h-4 w-4 [--mdc-icon-size:16px] text-muted"
                      icon=${this._icon(st)}
                    ></fib-icon>
                  </div>
                  <span
                    class="overflow-hidden text-ellipsis whitespace-nowrap text-[12px]
                       font-medium text-ink"
                    >${this._name(st)}</span
                  >
                  <span class="whitespace-nowrap text-[10.5px] text-muted"
                    >${this._secondary(st)}</span
                  >
                </div>`,
            )
          : cfg.empty
            ? html`<div
                class="flex items-center gap-[7px] px-2.5 py-3 text-[11.5px] text-muted"
              >
                <fib-icon
                  class="h-[15px] w-[15px] [--mdc-icon-size:15px] text-green"
                  icon="solar:check-circle-bold-duotone"
                ></fib-icon>
                <span>${cfg.empty}</span>
              </div>`
            : ""
      }
    </div>`;
  }

  getCardSize() {
    return 2;
  }
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 2 };
  }
}
