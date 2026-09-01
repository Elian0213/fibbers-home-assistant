/* ================================================================== *
 * CARD — fibbers-alert  (Lit + Tailwind)
 *
 * The "Aandacht nodig" card as real logic instead of 20 lines of Jinja. Runs a
 * list of checks against hass; shows an amber-tinted card with one line per
 * finding when anything fires, or a neutral card with a green tick and "Alles
 * in orde" when all is well. Tapping a finding opens more-info for its entity.
 * ================================================================== */
import { LitElement, html, css } from "lit";
import { twSheet } from "../tw.js";
import { moreInfo, isUnavail } from "../util.js";
import "../icon.js";

const friendly = (s) =>
  (s.attributes && s.attributes.friendly_name) || s.entity_id;

function runCheck(check, hass) {
  const states = Object.values(hass.states);
  const out = [];
  switch (check.type) {
    case "unavailable_lights": {
      const exclude = check.exclude || [];
      const offline = states.filter(
        (s) =>
          s.entity_id.startsWith("light.") &&
          !exclude.includes(s.entity_id) &&
          isUnavail(s),
      );
      if (offline.length)
        out.push({
          label: offline.length === 1 ? "Lamp offline" : "Lampen offline",
          detail: offline.map(friendly).join(", "),
          entity: offline[0].entity_id,
        });
      break;
    }
    case "low_battery": {
      const below = check.below != null ? check.below : 20;
      const pat = check.exclude_pattern
        ? new RegExp(check.exclude_pattern)
        : null;
      states
        .filter(
          (s) =>
            (s.attributes || {}).device_class === "battery" &&
            !isNaN(parseFloat(s.state)) &&
            parseFloat(s.state) < below &&
            !(pat && pat.test(s.entity_id)),
        )
        .forEach((s) =>
          out.push({
            label: "Batterij laag",
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
          label: "Updates",
          detail:
            ups.length === 1
              ? `1 update beschikbaar`
              : `${ups.length} updates beschikbaar`,
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
              label: "Back-up",
              detail: `${Math.round(hours)} uur geleden`,
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
  }

  _findings() {
    if (!this.hass) return [];
    const out = [];
    this._config.checks.forEach((c) => {
      try {
        out.push(...runCheck(c, this.hass));
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
          >${alert ? "Aandacht nodig" : "Alles in orde"}</span
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
}
