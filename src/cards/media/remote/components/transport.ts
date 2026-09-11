/* ================================================================== *
 * fibbers-remote — the navigation row (back/home/menu) and the media transport
 * strip (previous · play/pause · next). Pure view functions over a RemoteHost.
 * ================================================================== */
import { html, nothing, type TemplateResult } from "lit";

import { t } from "@shared/i18n";

import { mpSupports } from "../device";
import { MF_PLAY, MF_PAUSE, MF_PREV, MF_NEXT } from "../const";
import type { RemoteHost } from "../host";

// Navigation keys (Back / Home / Menu) as their own labelled row, sitting right
// under the wheel — nav belongs with the d-pad, not lumped into the transport
// strip (where Back/Home read as "missing"). Each cell renders only when the
// device advertises the command; Menu only when it's distinct from Back (Apple TV
// aliases Back → menu).
/** The navigation row (back/home/menu); nothing when the device advertises none. */
export function renderNav(
  host: RemoteHost,
  hl: unknown,
): TemplateResult | string {
  const navBtn = (label: string, icon: string, key: string) =>
    host.cmd(key)
      ? html`<button
          type="button"
          class=${host.flash === key ? "flash" : ""}
          aria-label=${label}
          @click=${() => host.send(key)}
        >
          <fib-icon icon=${icon}></fib-icon>${label}
        </button>`
      : nothing;
  const showMenu = host.cmd("menu") && host.cmd("menu") !== host.cmd("back");
  const cells = [
    navBtn(t(hl, "remote.back"), "solar:arrow-left-bold-duotone", "back"),
    navBtn(t(hl, "remote.home"), "solar:home-2-bold-duotone", "home"),
    showMenu
      ? navBtn(t(hl, "remote.menu"), "solar:menu-dots-bold-duotone", "menu")
      : nothing,
  ].filter((c) => c !== nothing);
  if (!cells.length) return "";
  return html`<div
    class="navrow"
    role="group"
    aria-label=${t(hl, "remote.navigation")}
  >
    ${cells}
  </div>`;
}

// One segmented strip for media transport only (previous · play/pause · next).
// Each cell is gated on the capability that would actually run it: the media_player
// feature bit if the call will route there, else the remote command. Play/pause
// takes PLAY or PAUSE. Navigation (back/home/menu) lives in renderNav, not here.
/** The media transport strip (previous · play/pause · next). */
export function renderTransport(host: RemoteHost): TemplateResult | string {
  const mp = host.mp();
  const playIcon =
    mp && mp.state === "playing"
      ? "solar:pause-bold-duotone"
      : "solar:play-bold-duotone";
  const canPlayMp = mp && (mpSupports(mp, MF_PLAY) || mpSupports(mp, MF_PAUSE));
  // Prefer the media_player path only when it advertises the bit; else the remote
  // command; else the cell doesn't render.
  const tp = (
    label: string,
    icon: string,
    key: string,
    mpService: string,
    viaMp: boolean | null,
    cls = "",
  ) => {
    if (!viaMp && !host.cmd(key)) return nothing;
    const onClick = viaMp ? () => host.mpDo(mpService) : () => host.send(key);
    return html`<button
      type="button"
      class="${cls} ${host.flash === key ? "flash" : ""}"
      aria-label=${label}
      @click=${onClick}
    >
      <fib-icon icon=${icon}></fib-icon>
    </button>`;
  };
  const cells = [
    tp(
      "Previous",
      "solar:skip-previous-bold-duotone",
      "previous",
      "media_previous_track",
      mp && mpSupports(mp, MF_PREV),
    ),
    tp("Play / pause", playIcon, "play", "media_play_pause", canPlayMp, "pp"),
    tp(
      "Next",
      "solar:skip-next-bold-duotone",
      "next",
      "media_next_track",
      mp && mpSupports(mp, MF_NEXT),
    ),
  ].filter((c) => c !== nothing);
  if (!cells.length) return "";
  return html`<div class="strip">${cells}</div>`;
}
