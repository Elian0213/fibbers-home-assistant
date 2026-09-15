/* ================================================================== *
 * fibbers-remote — the device switcher (segmented tablist) and the card header
 * (badge · name/now-playing · power). Pure view functions over a RemoteHost.
 * ================================================================== */
import { html, nothing, type TemplateResult } from "lit";

import { t } from "@shared/i18n";

import { isDeviceOn, deviceIcon, nowPlaying } from "../device";
import type { RemoteHost } from "../host";

// The short state chip label: playing/paused/idle when the player reports it, else
// the plain on/off the header already used.
function stateText(hl: unknown, state: string | null, on: boolean): string {
  if (state === "playing") return t(hl, "remote.playing");
  if (state === "paused") return t(hl, "remote.paused");
  if (state === "idle") return t(hl, "remote.idle");
  return t(hl, on ? "remote.on" : "remote.off");
}

// Roving focus for the switcher tablist; Left/Right/Home/End, activate on move.
function switcherKey(host: RemoteHost, e: KeyboardEvent): void {
  const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
  const tabs = [
    ...(e.currentTarget as Element).querySelectorAll('[role="tab"]'),
  ];
  const cur = e.composedPath().find((el) => tabs.includes(el as Element));
  const idx = tabs.indexOf(cur as Element);
  if (idx < 0) return;
  let next: number;
  if (e.key in delta) next = (idx + delta[e.key] + tabs.length) % tabs.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = tabs.length - 1;
  else return;
  e.preventDefault();
  (tabs[next] as HTMLElement).focus();
  host.select(next);
}

/** The segmented device tablist; renders nothing for a single-device card. */
export function renderSwitcher(
  host: RemoteHost,
  hl: unknown,
): TemplateResult | string {
  if (host.devices.length <= 1) return "";
  return html`<div
    class="rail"
    role="tablist"
    aria-label=${t(hl, "remote.devices")}
    @keydown=${(e: KeyboardEvent) => switcherKey(host, e)}
  >
    ${host.devices.map((d, i) => {
      const sel = i === host.sel;
      return html`<button
        type="button"
        role="tab"
        id="fibtab-${i}"
        class=${isDeviceOn(host.hass, d) ? "live" : nothing}
        aria-selected=${sel ? "true" : "false"}
        aria-controls="fibpanel"
        tabindex=${sel ? 0 : -1}
        @click=${() => host.select(i)}
      >
        <span class="dot"></span>
        <span class="nm">${d.name || `#${i + 1}`}</span>
      </button>`;
    })}
  </div>`;
}

/** The card header: device badge (cover art when playing), name, a state chip +
 *  now-playing line, and (for a remote) power. */
export function renderHeader(host: RemoteHost, hl: unknown): TemplateResult {
  const d = host.dev();
  const mp = host.mp();
  const on = isDeviceOn(host.hass, d);
  const np = nowPlaying(mp);
  const cover = np.active && np.art;
  // A state chip only reads when the device actually has a state to show.
  const hasState = !!(mp || d.entity);
  let chipState = on ? "on" : "off";
  if (mp) chipState = mp.state;
  const chip = hasState
    ? html`<span class="chip ${np.playing ? "live" : ""}"
        >${stateText(hl, chipState, on)}</span
      >`
    : "";
  return html`<div class="head">
    <div
      class="badge ${on ? "" : "off"} ${cover ? "art" : ""}"
      style=${cover ? `background-image:url("${np.art}")` : nothing}
    >
      ${
        cover
          ? nothing
          : html`<fib-icon
              class="h-[21px] w-[21px] [--mdc-icon-size:21px]"
              icon=${deviceIcon(d, host.kindOf(d))}
            ></fib-icon>`
      }
    </div>
    <div class="who">
      <b>${d.name || t(hl, "remote.default_name")}</b>
      <span class="sub">
        ${chip}${np.title ? html`<span class="tt">${np.title}</span>` : ""}
      </span>
    </div>
    ${
      d.entity
        ? html`<button
            type="button"
            class="power ${on ? "on" : ""}"
            aria-label="Power"
            @click=${() => host.power()}
          >
            <fib-icon
              class="h-5 w-5 [--mdc-icon-size:22px]"
              icon="solar:power-bold-duotone"
            ></fib-icon>
          </button>`
        : ""
    }
  </div>`;
}
