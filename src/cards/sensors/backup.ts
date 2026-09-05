/* ================================================================== *
 * fibbers-backup — last/next backup and result; amber when stale
 * (> `stale_hours`) or the `result` entity reports a failure.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t, langOf } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { isUnavail } from "@shared/util";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import "@shared/icon";

/** YAML/editor config accepted by `fibbers-backup`. */
export interface BackupConfig extends LovelaceCardConfig {
  entity: string;
  name?: string;
  result?: string;
  next?: string;
  stale_hours?: number;
  language?: string;
}

/** Relative "N ago" text plus raw `hours` for a timestamp; a non-timestamp reports Infinity hours so the caller can warn. */
function ago(
  iso: string,
  hl: HomeAssistant | string | undefined,
): { text: string; hours: number } {
  const time = Date.parse(iso);
  // A non-timestamp state (a broken sensor) counts as infinitely stale so the
  // card warns, rather than hours:0 masquerading as a fresh backup.
  if (Number.isNaN(time)) return { text: String(iso), hours: Infinity };
  const hours = (Date.now() - time) / 3.6e6;
  const mins = Math.round(hours * 60);
  let text;
  if (mins < 60) text = t(hl, "common.minutes_ago", { n: mins });
  else if (hours < 24)
    text = t(hl, "common.hours_ago", { n: Math.round(hours) });
  else text = t(hl, "common.days_ago", { n: Math.round(hours / 24) });
  return { text, hours };
}
/** Localised HH:MM for a timestamp; echoes the raw string when it isn't one. */
const clock = (iso: string, lang: string): string => {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return String(iso);
  return new Date(time).toLocaleTimeString(lang || "en", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * fibbers-backup — last/next backup and result; amber when stale
 * (> `stale_hours`) or the `result` entity reports a failure.
 */
@customElement("fibbers-backup")
export class FibbersBackup extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: BackupConfig;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the card picker — a placeholder last-backup sensor. */
  static getStubConfig(): BackupConfig {
    return { type: "custom:fibbers-backup", entity: "sensor.backup_last" };
  }

  /** Validate + store the config; throws when the last-backup `entity` is missing so the editor surfaces it. */
  setConfig(config: BackupConfig): void {
    if (!config || !config.entity) {
      throw new Error(
        "fibbers-backup: `entity` (last-backup timestamp) is required",
      );
    }
    this.config = config;
  }

  /** Render the tile — computes staleness/failure and paints amber when either trips. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const st = this.hass && this.hass.states[cfg.entity];

    let value: string;
    let sub: string;
    let warn: boolean;
    if (isUnavail(st)) {
      value = "—";
      sub = t(hl, "backup.none");
      warn = true;
    } else {
      const a = ago(st!.state, hl);
      const stale = a.hours > (cfg.stale_hours != null ? cfg.stale_hours : 26);
      let failed = false;
      if (cfg.result) {
        const r = this.hass!.states[cfg.result];
        failed =
          !!r && ["off", "failed", "error", "false"].includes(String(r.state));
      }
      value = a.text;
      const bits = [t(hl, failed ? "backup.failed" : "backup.succeeded")];
      if (cfg.next) {
        const n = this.hass!.states[cfg.next];
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

  /** Masonry height in rows. */
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
