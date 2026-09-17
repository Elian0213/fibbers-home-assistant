/* ================================================================== *
 * fibbers-remote — a read-only host proxy bound to a NON-selected device, used to
 * render the neighbouring panel that slides in during a page swipe. Every read
 * resolves `devices[index]` (reusing the same pure device accessors the real host
 * uses); every action and every stateful controller is inert, because the neighbour
 * is a transient preview the user never interacts with mid-slide. Once the swipe
 * commits, the real host takes over the now-selected device and this proxy is dropped.
 *
 * Typed against the `RemoteHost` interface (not the element) so there's no import
 * cycle — it reads `devices`, `hass` and `kindOf` back off the real host.
 * ================================================================== */
import type { SliderController } from "@shared/ui";
import type { HassEntity } from "@/types/home-assistant";

import {
  cmdFor,
  deviceUnavail,
  volumeEntityId,
  volumeDelegated,
} from "./device";
import type { RemoteDevice } from "./config";
import type { RailSwipe } from "./rail-swipe";
import type { TouchpadController } from "./touchpad-controller";
import type { RemoteHost } from "./host";

const noop = (): void => {};

// A SliderController-shaped stub: the neighbour's volume slider renders static (no
// hold, no live drag). Only the members renderVolRow reads are present.
const INERT_VOL = {
  dragging: false,
  input: noop,
  drag: {
    down: noop,
    move: noop,
    up: noop,
    cancel: noop,
    lost: noop,
  },
} as unknown as SliderController;

// A TouchpadController-shaped stub. Crucially its `attach` is a no-op ref: reusing the
// REAL touchpad here would let the neighbour's surface hijack the live controller's
// cached nodes (its rAF painter writes straight to them).
const INERT_TOUCHPAD = {
  attach: noop,
  down: noop,
  move: noop,
  up: noop,
  cancel: noop,
  lost: noop,
} as unknown as TouchpadController;

const INERT_SWIPE = { start: noop, end: noop, cancel: noop };

// A RailSwipe-shaped stub — the switcher renders outside the deck (never against
// this proxy), but the host contract carries it, so satisfy it inertly.
const INERT_RAIL = {
  attach: noop,
  down: noop,
  move: noop,
  up: noop,
  cancel: noop,
  lost: noop,
} as unknown as RailSwipe;

const INERT_SCRUB = {
  step: noop,
  stepThrottled: noop,
  down: noop,
  move: noop,
  up: noop,
  active: () => false,
};

/**
 * A read-only `RemoteHost` for the neighbour device at `index`: reads resolve that
 * device, everything else is inert.
 * @param real — the live host (source of `devices`, `hass`, `kindOf`)
 * @param index — the neighbour device index to render
 */
export function makePeekHost(real: RemoteHost, index: number): RemoteHost {
  const dev = (): RemoteDevice => real.devices[index] || {};
  const state = (id: string | undefined): HassEntity | null =>
    id && real.hass ? real.hass.states[id] : null;

  return {
    get hass() {
      return real.hass;
    },
    get devices() {
      return real.devices;
    },
    sel: index,
    flash: null,
    srcOpen: false,
    vol: INERT_VOL,
    touchpad: INERT_TOUCHPAD,
    swipe: INERT_SWIPE,
    scrub: INERT_SCRUB,
    rail: INERT_RAIL,

    // reads — resolve the neighbour device
    dev,
    mp: () => state(dev().media_player),
    volMp: () => state(volumeEntityId(dev())),
    volDelegated: () => volumeDelegated(dev()),
    kindOf: (d) => real.kindOf(d),
    cmd: (key) => cmdFor(dev(), real.kindOf(dev()), key),
    unavail: () => deviceUnavail(real.hass, dev()),
    volPct: () => {
      const mp = state(volumeEntityId(dev()));
      return mp && mp.attributes.volume_level != null
        ? Math.round(Number(mp.attributes.volume_level) * 100)
        : 0;
    },

    // actions — inert (the neighbour is a preview, never interactive mid-slide)
    send: () => Promise.resolve(),
    power: noop,
    mpDo: noop,
    volDo: noop,
    select: noop,
    hold: noop,
    release: noop,
    toggleSrc: noop,

    // controls panel — not rendered inside the deck, inert for completeness
    ctlSlider: () => undefined,
    ctlValue: () => 0,
    ctlDo: noop,
    ctlOpen: () => false,
    ctlToggle: noop,
  };
}
