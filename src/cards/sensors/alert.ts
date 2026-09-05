/* ================================================================== *
 * fibbers-alert — an "attention needed" card from real checks (offline lights,
 * low batteries, updates, stale backups). Green tick when everything's clear.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { activateOnKey } from "@shared/ui";
import { moreInfo, isUnavail } from "@shared/util";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
} from "@/types/home-assistant";
import "@shared/icon";

/** A single check in a `fibbers-alert` config; `_excludeRe` is the compiled `exclude_pattern`. */
export interface AlertCheck {
  type?: string;
  exclude?: string[];
  exclude_pattern?: string;
  below?: number;
  entity?: string;
  max_hours?: number;
  _excludeRe?: RegExp;
}

/** YAML/editor config accepted by `fibbers-alert`. */
export interface AlertConfig extends LovelaceCardConfig {
  checks: AlertCheck[];
  language?: string;
}

/** One rendered finding row — a label, its detail line, and the entity it taps through to. */
interface Finding {
  label: string;
  detail: string;
  entity: string;
}

/** Display name for a state — friendly_name, falling back to the entity_id. */
const friendly = (s: HassEntity): string =>
  (s.attributes && s.attributes.friendly_name) || s.entity_id;

/**
 * Precompile a check's `exclude_pattern` once (case-insensitive) and validate it
 * in setConfig, so a bad pattern is a clear config error, not a per-render throw.
 * @param check
 */
function compileCheck(check: AlertCheck): AlertCheck {
  if (!check || !check.exclude_pattern) return check;
  try {
    return { ...check, _excludeRe: new RegExp(check.exclude_pattern, "i") };
  } catch (e) {
    throw new Error(
      `fibbers-alert: invalid exclude_pattern "${check.exclude_pattern}" — ${(e as Error).message}`,
    );
  }
}

/** True when a compiled exclude regex hits the state — matches id AND friendly name, since the pattern is written from what's on screen. */
const excludedBy = (re: RegExp | undefined, s: HassEntity): boolean =>
  !!re && (re.test(s.entity_id) || re.test(friendly(s)));

/** Run one check against all states, returning `{label, detail, entity}` findings (empty when clear). */
function runCheck(
  check: AlertCheck,
  hass: HomeAssistant,
  hl: HomeAssistant | string | undefined,
): Finding[] {
  const states = Object.values(hass.states);
  const out: Finding[] = [];
  // eslint-disable-next-line default-case -- an unknown check type is an intentional no-op
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
            !Number.isNaN(parseFloat(s.state)) &&
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
      const st = check.entity ? hass.states[check.entity] : undefined;
      const max = check.max_hours != null ? check.max_hours : 26;
      if (st && !isUnavail(st)) {
        const ts = Date.parse(st.state);
        if (!Number.isNaN(ts)) {
          const hours = (Date.now() - ts) / 3.6e6;
          if (hours > max)
            out.push({
              label: t(hl, "alert.backup"),
              detail: t(hl, "common.hours_ago", { n: Math.round(hours) }),
              entity: check.entity as string,
            });
        }
      }
      break;
    }
  }
  return out;
}

/**
 * fibbers-alert — an "attention needed" card from real checks (offline lights,
 * low batteries, updates, stale backups). Green tick when everything's clear.
 */
@customElement("fibbers-alert")
export class FibbersAlert extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: AlertConfig;

  private _checks: AlertCheck[] = [];

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Seed config for the card picker — offline-lights and updates checks. */
  static getStubConfig(): AlertConfig {
    return {
      type: "custom:fibbers-alert",
      checks: [{ type: "unavailable_lights" }, { type: "updates" }],
    };
  }

  /** Validate + store the config and precompile each check's exclude regex; throws when `checks` isn't a list so the editor surfaces it. */
  setConfig(config: AlertConfig): void {
    if (!config || !Array.isArray(config.checks)) {
      throw new Error("fibbers-alert: `checks` must be a list");
    }
    this.config = config;
    this._checks = config.checks.map(compileCheck);
  }

  private _findings(): Finding[] {
    if (!this.hass) return [];
    const { hass } = this;
    const out: Finding[] = [];
    const hl = this.config.language || this.hass;
    this._checks.forEach((c) => {
      try {
        out.push(...runCheck(c, hass, hl));
      } catch (_) {
        /* a bad check never breaks the card */
      }
    });
    return out;
  }

  private _moreInfo(entity: string): void {
    moreInfo(this, entity);
  }

  /** Render the all-clear tick or the amber findings list, each row tapping through to more-info. */
  render(): TemplateResult {
    if (!this.config) return html``;
    const findings = this._findings();
    const hl = this.config.language || this.hass;
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
                    role="button"
                    tabindex="0"
                    aria-label=${`${f.label} — ${t(hl, "common.more_info")}`}
                    class="fib-hit cursor-pointer text-[11.5px] leading-[1.42] text-ambertx"
                    @click=${() => this._moreInfo(f.entity)}
                    @keydown=${activateOnKey(() => this._moreInfo(f.entity))}
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
