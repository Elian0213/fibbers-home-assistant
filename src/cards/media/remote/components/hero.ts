/* ================================================================== *
 * fibbers-remote — the "now playing" hero: the primary zone for a device with no
 * d-pad (a speaker, a media_player-only entry). It fills the same vertical space a
 * TV's wheel/touchpad would, so every remote in a swipe deck is the same height and
 * a sparse remote reads as a proper now-playing card rather than an empty stub.
 * Pure view function over a RemoteHost.
 * ================================================================== */
import { html, nothing, type TemplateResult } from "lit";

import { t } from "@shared/i18n";

import { isDeviceOn, deviceIcon, nowPlaying } from "../device";
import type { RemoteHost } from "../host";

/** The now-playing hero — cover art (or a large device icon) + title + subtitle. */
export function renderHero(host: RemoteHost, hl: unknown): TemplateResult {
  const d = host.dev();
  const mp = host.mp();
  const np = nowPlaying(mp);
  const on = isDeviceOn(host.hass, d);
  const title = np.title || d.name || t(hl, "remote.default_name");
  const subtitle = np.subtitle || t(hl, on ? "remote.on" : "remote.off");
  const cover = np.active && np.art;
  return html`<div
    class="hero"
    role="group"
    aria-label=${d.name || t(hl, "remote.default_name")}
  >
    <div
      class="art ${cover ? "on" : ""}"
      style=${cover ? `background-image:url("${np.art}")` : nothing}
    >
      ${
        cover
          ? nothing
          : html`<fib-icon icon=${deviceIcon(d, host.kindOf(d))}></fib-icon>`
      }
    </div>
    <div class="htitle">${title}</div>
    <div class="hsub">${subtitle}</div>
  </div>`;
}
