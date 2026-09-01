/* ================================================================== *
 * CARD — fibbers-backup  (Lit + Tailwind)
 *
 * Backup status: when the last one ran, whether it succeeded, and when the next
 * is due. Reads a timestamp `entity` for the last backup; goes amber when it's
 * older than `stale_hours` or the optional `result` entity reports a failure.
 * ================================================================== */
import { LitElement, html, css } from "lit";
import { twSheet } from "../tw.js";
import { isUnavail } from "../util.js";
import "../icon.js";

function ago(iso) {
  const t = Date.parse(iso);
  if (isNaN(t)) return { text: String(iso), hours: 0 };
  const hours = (Date.now() - t) / 3.6e6;
  const mins = Math.round(hours * 60);
  let text;
  if (mins < 60) text = `${mins} min geleden`;
  else if (hours < 24) text = `${Math.round(hours)} uur geleden`;
  else text = `${Math.round(hours / 24)} dagen geleden`;
  return { text, hours };
}
const clock = (iso) => {
  const t = Date.parse(iso);
  if (isNaN(t)) return String(iso);
  return new Date(t).toLocaleTimeString("nl-NL", {
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
    const st = this.hass && this.hass.states[cfg.entity];

    let value, sub, warn;
    if (isUnavail(st)) {
      value = "—";
      sub = "Geen back-up gevonden";
      warn = true;
    } else {
      const a = ago(st.state);
      const stale = a.hours > (cfg.stale_hours != null ? cfg.stale_hours : 26);
      let failed = false;
      if (cfg.result) {
        const r = this.hass.states[cfg.result];
        failed =
          r && ["off", "failed", "error", "false"].includes(String(r.state));
      }
      value = a.text;
      const bits = [failed ? "Mislukt" : "Geslaagd"];
      if (cfg.next) {
        const n = this.hass.states[cfg.next];
        if (n && !isUnavail(n)) bits.push(`volgende ${clock(n.state)}`);
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
        ${cfg.name || "Back-up"}
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
