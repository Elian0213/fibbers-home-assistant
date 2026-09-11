/* ================================================================== *
 * fibbers-remote — the device switcher (segmented tablist) and the card header
 * (badge · name/now-playing · power). Pure view functions over a RemoteHost.
 * ================================================================== */
import { html, nothing, type TemplateResult } from "lit";

import { t } from "@shared/i18n";

import { isDeviceOn, deviceIcon } from "../device";
import type { RemoteHost } from "../host";

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

/** The card header: device badge, name + now-playing line, and (for a remote) power. */
export function renderHeader(host: RemoteHost, hl: unknown): TemplateResult {
  const d = host.dev();
  const mp = host.mp();
  const on = isDeviceOn(host.hass, d);
  const onOff = t(hl, on ? "remote.on" : "remote.off");
  let nowLine: string;
  if (mp)
    nowLine =
      mp.attributes.media_title ||
      mp.attributes.app_name ||
      mp.attributes.source ||
      onOff;
  else nowLine = d.entity ? onOff : "";
  return html`<div class="head">
    <div class="badge ${on ? "" : "off"}">
      <fib-icon
        class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
        icon=${deviceIcon(d, host.kindOf(d))}
      ></fib-icon>
    </div>
    <div class="who">
      <b>${d.name || t(hl, "remote.default_name")}</b>
      <span>${nowLine}</span>
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
              class="h-5 w-5 [--mdc-icon-size:20px]"
              icon="solar:power-bold-duotone"
            ></fib-icon>
          </button>`
        : ""
    }
  </div>`;
}
