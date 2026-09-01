/* ================================================================== *
 * fibbers-backup — last/next backup and result; amber when stale
 * (> `stale_hours`) or the `result` entity reports a failure.
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t, langOf } from "../i18n.js";
import { twSheet } from "../tw.js";
import { isUnavail } from "../util.js";
import "../icon.js";

function ago(iso, hl) {
  const time = Date.parse(iso);
  if (isNaN(time)) return { text: String(iso), hours: 0 };
  const hours = (Date.now() - time) / 3.6e6;
  const mins = Math.round(hours * 60);
  let text;
  if (mins < 60) text = t(hl, "common.minutes_ago", { n: mins });
  else if (hours < 24)
    text = t(hl, "common.hours_ago", { n: Math.round(hours) });
  else text = t(hl, "common.days_ago", { n: Math.round(hours / 24) });
  return { text, hours };
}
const clock = (iso, lang) => {
  const time = Date.parse(iso);
  if (isNaN(time)) return String(iso);
  return new Date(time).toLocaleTimeString(lang || "en", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export class FibbersBackup extends LitElement {
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
    return { type: "custom:fibbers-backup", entity: "sensor.backup_last" };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error(
        "fibbers-backup: `entity` (last-backup timestamp) is required",
      );
    }
    this._config = config;
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this.hass && this.hass.states[cfg.entity];

    let value, sub, warn;
    if (isUnavail(st)) {
      value = "—";
      sub = t(hl, "backup.none");
      warn = true;
    } else {
      const a = ago(st.state, hl);
      const stale = a.hours > (cfg.stale_hours != null ? cfg.stale_hours : 26);
      let failed = false;
      if (cfg.result) {
        const r = this.hass.states[cfg.result];
        failed =
          r && ["off", "failed", "error", "false"].includes(String(r.state));
      }
      value = a.text;
      const bits = [t(hl, failed ? "backup.failed" : "backup.succeeded")];
      if (cfg.next) {
        const n = this.hass.states[cfg.next];
        if (n && !isUnavail(n))
          bits.push(t(hl, "backup.next", { time: clock(n.state, langOf(hl)) }));
      }
      sub = bits.join(" · ");
      warn = stale || failed;
    }

    return html`<div
      class="grid grid-cols-[34px_1fr] items-center gap-x-[11px] gap-y-0.5
             rounded-[14px] border p-[13px]
             ${warn ? "border-amberline bg-amberbg" : "border-line bg-card"}"
    >
      <div
        class="row-span-2 flex h-[34px] w-[34px] items-center justify-center rounded-[10px]
               ${warn ? "bg-amberbg" : "bg-accentbg"}"
      >
        <fib-icon
          class="h-[19px] w-[19px] [--mdc-icon-size:19px] ${
            warn ? "text-amber" : "text-accent"
          }"
          icon="solar:diskette-bold-duotone"
        ></fib-icon>
      </div>
      <div class="text-[11px] font-medium text-muted">
        ${cfg.name || t(hl, "backup.default_name")}
      </div>
      <div class="text-[17px] font-semibold leading-[1.15] text-ink">
        ${value}
      </div>
      <div
        class="col-start-2 text-[10.5px] ${warn ? "text-ambertx" : "text-muted"}"
      >
        ${sub}
      </div>
    </div>`;
  }

  getCardSize() {
    return 1;
  }
  getLayoutOptions() {
    return { grid_columns: 6, grid_rows: 1 };
  }
}
