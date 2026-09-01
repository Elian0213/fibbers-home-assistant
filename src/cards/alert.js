/* ================================================================== *
 * fibbers-alert — "Aandacht nodig" from real checks (offline lights, low
 * batteries, updates, stale backups). Green tick when everything's clear.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { moreInfo, isUnavail } from "../util.js";
import "../icon.js";

const friendly = (s) =>
  (s.attributes && s.attributes.friendly_name) || s.entity_id;

// Precompile a check's `exclude_pattern` once (case-insensitive) and validate it
// in setConfig, so a bad pattern is a clear config error, not a per-render throw.
function compileCheck(check) {
  if (!check || !check.exclude_pattern) return check;
  try {
    return { ...check, _excludeRe: new RegExp(check.exclude_pattern, "i") };
  } catch (e) {
    throw new Error(
      `fibbers-alert: invalid exclude_pattern "${check.exclude_pattern}" — ${e.message}`,
    );
  }
}

// The pattern is written from what's on screen, so match id AND friendly name.
const excludedBy = (re, s) =>
  re && (re.test(s.entity_id) || re.test(friendly(s)));

function runCheck(check, hass, hl) {
  const states = Object.values(hass.states);
  const out = [];
  switch (check.type) {
    case "unavailable_lights": {
      const exclude = check.exclude || [];
      const re = check._excludeRe;
      const offline = states.filter(
        (s) =>
          s.entity_id.startsWith("light.") &&
          !exclude.includes(s.entity_id) &&
          !excludedBy(re, s) &&
          isUnavail(s),
      );
      if (offline.length)
        out.push({
          label: t(hl, "alert.lights_offline", { count: offline.length }),
          detail: offline.map(friendly).join(", "),
          entity: offline[0].entity_id,
        });
      break;
    }
    case "low_battery": {
      const below = check.below != null ? check.below : 20;
      const re = check._excludeRe;
      states
        .filter(
          (s) =>
            (s.attributes || {}).device_class === "battery" &&
            !isNaN(parseFloat(s.state)) &&
            parseFloat(s.state) < below &&
            !excludedBy(re, s),
        )
        .forEach((s) =>
          out.push({
            label: t(hl, "alert.low_battery"),
            detail: `${friendly(s)} (${s.state}%)`,
            entity: s.entity_id,
          }),
        );
      break;
    }
    case "updates": {
      const ups = states.filter(
        (s) => s.entity_id.startsWith("update.") && s.state === "on",
      );
      if (ups.length)
        out.push({
          label: t(hl, "alert.updates"),
          detail: t(hl, "alert.updates_available", {
            n: ups.length,
            count: ups.length,
          }),
          entity: ups[0].entity_id,
        });
      break;
    }
    case "backup_age": {
      const st = hass.states[check.entity];
      const max = check.max_hours != null ? check.max_hours : 26;
      if (st && !isUnavail(st)) {
        const t = Date.parse(st.state);
        if (!isNaN(t)) {
          const hours = (Date.now() - t) / 3.6e6;
          if (hours > max)
            out.push({
              label: t(hl, "alert.backup"),
              detail: t(hl, "common.hours_ago", { n: Math.round(hours) }),
              entity: check.entity,
            });
        }
      }
      break;
    }
  }
  return out;
}

export class FibbersAlert extends LitElement {
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
      type: "custom:fibbers-alert",
      checks: [{ type: "unavailable_lights" }, { type: "updates" }],
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.checks)) {
      throw new Error("fibbers-alert: `checks` must be a list");
    }
    this._config = config;
    this._checks = config.checks.map(compileCheck);
  }

  _findings() {
    if (!this.hass) return [];
    const out = [];
    const hl = this._config.language || this.hass;
    this._checks.forEach((c) => {
      try {
        out.push(...runCheck(c, this.hass, hl));
      } catch (_) {
        /* a bad check never breaks the card */
      }
    });
    return out;
  }

  _moreInfo(entity) {
    moreInfo(this, entity);
  }

  render() {
    if (!this._config) return html``;
    const findings = this._findings();
    const hl = this._config.language || this.hass;
    const alert = findings.length > 0;
    return html`<div
      class="rounded-xl border p-3
             ${alert ? "border-amberline bg-amberbg" : "border-line bg-card"}"
    >
      <div class="flex items-center gap-2">
        <fib-icon
          class="h-4 w-4 [--mdc-icon-size:16px] ${
            alert ? "text-amber" : "text-green"
          }"
          icon=${
            alert
              ? "solar:danger-triangle-bold-duotone"
              : "solar:check-circle-bold-duotone"
          }
        ></fib-icon>
        <span
          class="text-[12px] font-semibold ${
            alert ? "text-amber" : "text-green"
          }"
          >${alert ? t(hl, "alert.attention_needed") : t(hl, "alert.all_clear")}</span
        >
      </div>
      ${
        alert
          ? html`<div class="mt-2 flex flex-col gap-[5px]">
              ${findings.map(
                (f) =>
                  html`<div
                    class="cursor-pointer text-[11.5px] leading-[1.42] text-ambertx"
                    @click=${() => this._moreInfo(f.entity)}
                  >
                    <b class="font-semibold text-amber">${f.label}</b> —
                    ${f.detail}
                  </div>`,
              )}
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
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
