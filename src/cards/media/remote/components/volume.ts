/* ================================================================== *
 * fibbers-remote — the volume row (mute · slider-or-scrub · percentage) and the
 * channel stepper. Pure view functions over a RemoteHost.
 * ================================================================== */
import { html, nothing, type TemplateResult } from "lit";

import { t } from "@shared/i18n";
import { sliderTrack } from "@shared/ui";
import type { HassEntity } from "@/types/home-assistant";

import { mpSupports } from "../device";
import { GONE_STATES, MF_VOLUME_MUTE, MF_VOLUME_STEP } from "../const";
import type { RemoteHost } from "../host";

// The scrub strip for a device with no `volume_level`. The two ends are real
// buttons (Volume down / up): tap steps once, press-and-hold repeats via the shared
// `hold`, and keyboard activation (Enter/Space) is native — so a held key can't
// outrun the throttle. The middle groove is a decorative, aria-hidden drag surface
// driven by the `scrub` bundle. No absolute position is ever shown: the device
// reports none.
function volScrub(host: RemoteHost, hl: unknown): TemplateResult {
  const s = host.scrub;
  // Each end button: pointer press repeats via `hold`; a keyboard Enter/Space
  // arrives as a detail-0 click and steps once (throttled).
  const edge = (dir: number, label: string, icon: string) =>
    html`<button
      type="button"
      class="edge"
      aria-label=${label}
      @pointerdown=${() => host.hold(() => s.step(dir))}
      @pointerup=${() => host.release()}
      @pointercancel=${() => host.release()}
      @pointerleave=${() => host.release()}
      @lostpointercapture=${() => host.release()}
      @click=${(e: MouseEvent) => e.detail === 0 && s.stepThrottled(dir)}
    >
      <fib-icon icon=${icon}></fib-icon>
    </button>`;
  return html`<div
    class="scrub ${s.active() ? "dragging" : ""}"
    role="group"
    aria-label=${t(hl, "remote.volume")}
  >
    ${edge(-1, "Volume down", "solar:volume-small-bold-duotone")}
    <div
      class="groove"
      aria-hidden="true"
      data-fib-gesture="own"
      @pointerdown=${s.down}
      @pointermove=${s.move}
      @pointerup=${s.up}
      @pointercancel=${s.up}
      @lostpointercapture=${s.up}
    >
      <span class="grip"></span>
    </div>
    ${edge(1, "Volume up", "solar:volume-loud-bold-duotone")}
  </div>`;
}

function volMid(
  host: RemoteHost,
  mp: HassEntity | null,
  hasSlider: boolean | null,
  hl: unknown,
): TemplateResult {
  if (hasSlider && mp) {
    // If the player drops out mid-hold, release the optimistic value.
    const gone = !mp || GONE_STATES.includes(mp.state);
    const vol = Math.round(host.volPct());
    const s = host.vol;
    return html`${sliderTrack({
        pct: vol,
        disabled: gone,
        dragging: s.dragging,
        cls: "flex-1",
        label: t(hl, "remote.volume"),
        value: vol,
        min: 0,
        max: 100,
        step: 5,
        valueText: `${vol}%`,
        onInput: (v) => s.input(v),
        onDown: s.drag.down,
        onMove: s.drag.move,
        onUp: s.drag.up,
        onCancel: s.drag.cancel,
        onLost: s.drag.lost,
      })}<span class="pct">${vol}%</span>`;
  }
  // No level to position a thumb at → a slider-shaped scrub strip instead of a
  // cramped stepper: drag to change, tap a side to step, hold to repeat. Full
  // width (no % cell), so nothing jumps if a TV that *did* report a level sleeps.
  return volScrub(host, hl);
}

// One row shape whether or not the device reports a level, so nothing jumps when a
// TV sleeps: mute key · slider-or-stepper · percentage. Gated on `volume_level`
// (not the VOLUME_SET bit — a player can advertise it and never report a level).
// The whole row reads `host.volMp()`, so `volume_entity` transparently redirects it
// to another player without the transport/now-playing following.
/** The volume row: mute · (slider or scrub strip) · percentage. */
export function renderVolRow(
  host: RemoteHost,
  hl: unknown,
): TemplateResult | string {
  const mp = host.volMp();
  const delegated = host.volDelegated();
  const hasSlider = mp && mp.attributes.volume_level != null;
  // A delegated volume is always the player's; the device's own remote keys are
  // deliberately not consulted (see index.ts scrub.step).
  const remoteVol = !delegated && !!host.cmd("volume_up");
  const mpStep = mpSupports(mp, MF_VOLUME_STEP);
  // `delegated && mp` keeps the row mounted when the delegate is asleep: HA drops
  // `supported_features` and `volume_level` on an `unavailable` entity, so without
  // this the row would vanish and re-appear as the TV sleeps and wakes.
  if (!hasSlider && !remoteVol && !mpStep && !(delegated && mp)) return "";
  const muted = mp && mp.attributes.is_volume_muted;
  let canMute: boolean;
  if (hasSlider) canMute = mpSupports(mp, MF_VOLUME_MUTE);
  else if (remoteVol) canMute = !!host.cmd("volume_mute");
  else canMute = mpSupports(mp, MF_VOLUME_MUTE);
  const muteClick = remoteVol
    ? () => host.send("volume_mute")
    : () => host.volDo("volume_mute", { is_volume_muted: !muted });
  const mute = canMute
    ? html`<button
        type="button"
        class="key ${muted ? "on" : ""}"
        aria-label=${t(hl, "remote.mute")}
        aria-pressed=${muted ? "true" : "false"}
        @click=${muteClick}
      >
        <fib-icon
          icon=${
            muted
              ? "solar:volume-cross-bold-duotone"
              : "solar:volume-small-bold-duotone"
          }
        ></fib-icon>
      </button>`
    : "";
  // Delegation must be visible: name the player driving the sound in the row's
  // aria-label and in a `.via` chip after the percentage (hidden on a narrow card).
  const viaName = mp ? mp.attributes.friendly_name || mp.entity_id : "";
  const via = delegated
    ? html`<span class="via" title=${mp ? mp.entity_id : ""}>${viaName}</span>`
    : "";
  return html`<div
    class="row"
    role=${delegated ? "group" : nothing}
    aria-label=${delegated ? t(hl, "remote.volume_via", { name: viaName }) : nothing}
  >
    ${mute}${volMid(host, mp, hasSlider, hl)}${via}
  </div>`;
}

/** The channel stepper (CH − / +); nothing when the device has no channel commands. */
export function renderChannelRow(host: RemoteHost): TemplateResult | string {
  if (!host.cmd("channel_up")) return "";
  return html`<div class="steps">
    <button
      type="button"
      aria-label="Channel down"
      @pointerdown=${() => host.hold(() => host.send("channel_down"))}
      @pointerup=${() => host.release()}
      @pointercancel=${() => host.release()}
      @pointerleave=${() => host.release()}
      @lostpointercapture=${() => host.release()}
      @click=${(e: MouseEvent) => e.detail === 0 && host.send("channel_down")}
    >
      <fib-icon icon="solar:minus-circle-bold-duotone"></fib-icon>
    </button>
    <span class="lab">CH</span>
    <button
      type="button"
      aria-label="Channel up"
      @pointerdown=${() => host.hold(() => host.send("channel_up"))}
      @pointerup=${() => host.release()}
      @pointercancel=${() => host.release()}
      @pointerleave=${() => host.release()}
      @lostpointercapture=${() => host.release()}
      @click=${(e: MouseEvent) => e.detail === 0 && host.send("channel_up")}
    >
      <fib-icon icon="solar:add-circle-bold-duotone"></fib-icon>
    </button>
  </div>`;
}
