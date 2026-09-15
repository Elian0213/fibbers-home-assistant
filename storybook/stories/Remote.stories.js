import { story } from "../src/story.js";
import { makeHass } from "../src/hass.js";

export default {
  title: "Cards/Devices & Media/Remote",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Universal remote — D-pad and buttons.",
      },
    },
  },
};

/** Apple TV: the **touchpad** (the default d-pad for Apple TV) — drag to move focus,
 * tap to select, hold for the context menu; while playing, a horizontal drag pauses
 * and scrubs the timeline. Plus a distinct Back/Home nav row, transport (⏮ ▶ ⏭), and
 * — because the player reports no volume level — the slider-shaped **scrub** strip.
 * Sources collapse to favourites. */
export const AppleTV = story({
  type: "custom:fibbers-remote",
  device: "appletv",
  entity: "remote.appletv",
  media_player: "media_player.appletv",
  icon: "solar:display-bold-duotone",
  name: "Apple TV",
  sources: "auto",
  favourites: ["Netflix", "YouTube", "Prime Video", "Spotify"],
});

/** Netflix on the Apple TV: the app reports **no position/duration and no SEEK**
 * to Home Assistant, so a real timeline scrub is impossible over standard HA
 * services. A horizontal drag while playing is therefore **inert** — it is
 * consumed (no accidental 10s left/right skips) but takes no media action; the
 * finger dot still follows. Vertical drags navigate and edge-taps still skip.
 * A faithful continuous scrub for these apps needs the native-touch backend hook
 * (`touchpad.native_touch`). */
export const AppleTVNetflix = story({
  type: "custom:fibbers-remote",
  device: "appletv",
  entity: "remote.appletv",
  media_player: "media_player.appletv_netflix",
  icon: "solar:display-bold-duotone",
  name: "Apple TV",
  sources: "auto",
  favourites: ["Netflix", "YouTube", "Prime Video", "Spotify"],
});

/** Netflix on the Apple TV **with the [Fibbers Bridge](https://github.com/Elian0213/fibbers-bridge)
 * backend installed**: the touchpad now streams a real 1:1 **native touch** to the
 * Apple TV's own surface (`fibbers_bridge/atv_touch` over the websocket), so a
 * horizontal drag while playing scrubs Netflix's *own* timeline — the exact
 * physical-Siri-Remote behaviour, in any app. Feature-detected: this story's mock
 * advertises the bridge (`makeHass({ bridge: true })`); the plain
 * `AppleTVNetflix` story above has no bridge and stays inert. Watch the console for
 * the `press → hold… → release` stream. */
export const AppleTVNetflixBridge = story(
  {
    type: "custom:fibbers-remote",
    device: "appletv",
    entity: "remote.appletv",
    media_player: "media_player.appletv_netflix",
    icon: "solar:display-bold-duotone",
    name: "Apple TV",
    sources: "auto",
    favourites: ["Netflix", "YouTube", "Prime Video", "Spotify"],
  },
  { hass: makeHass({ bridge: true }) },
);

/** The same Apple TV with the classic SVG **wheel** instead of the touchpad
 * (`dpad: both` — tap a sector, swipe, or arrow-key). */
export const AppleTVWheel = story({
  type: "custom:fibbers-remote",
  device: "appletv",
  entity: "remote.appletv",
  media_player: "media_player.appletv",
  icon: "solar:display-bold-duotone",
  name: "Apple TV",
  dpad: "both",
  sources: "auto",
  favourites: ["Netflix", "YouTube", "Prime Video", "Spotify"],
});

/** Apple TV with **delegated volume** (`volume_entity`): the box itself reports no
 * `volume_level`, so on its own it falls to the scrub strip — but the sound leaves
 * the **Philips**, which does report a level. Pointing `volume_entity` at the Philips
 * gives the row a real positional slider at the TV's level, drives the TV's
 * volume/mute, and names it in a `.via` chip — while the header, transport and
 * sources stay on the Apple TV. */
export const DelegatedVolume = story({
  type: "custom:fibbers-remote",
  device: "appletv",
  entity: "remote.appletv",
  media_player: "media_player.appletv",
  volume_entity: "media_player.philips",
  icon: "solar:display-bold-duotone",
  name: "Apple TV",
  sources: "auto",
  favourites: ["Netflix", "YouTube", "Prime Video", "Spotify"],
});

/** Philips: reports a volume level → a positional slider (+ mute) and a channel
 * stepper, plus a **controls panel** — a picture-style select as preset chips, a
 * backlight number slider, and a screen-off toggle. */
export const PhilipsTV = story({
  type: "custom:fibbers-remote",
  device: "philips",
  entity: "remote.philips",
  media_player: "media_player.philips",
  icon: "solar:tv-bold-duotone",
  name: "Philips TV",
  controls: [
    { entity: "input_select.tv_picture_style", name: "Beeldstijl" },
    { entity: "input_number.tv_backlight", name: "Achtergrondlicht" },
    { entity: "switch.tv_screen_off", name: "Scherm uit" },
  ],
});

/** Several devices behind a segmented switcher; `auto_select: playing` opens on the
 * device that's currently playing. A media_player-only entry (the Sonos) is a
 * speaker — no d-pad. On a touch device you can also **swipe left/right** on the body
 * to page between them (`swipe:`, on by default); the rail stays the click/keyboard
 * alternative. */
export const MultiDevice = story({
  type: "custom:fibbers-remote",
  remember: false,
  auto_select: "playing",
  devices: [
    {
      name: "Apple TV",
      device: "appletv",
      entity: "remote.appletv",
      media_player: "media_player.appletv",
      icon: "solar:display-bold-duotone",
      sources: "auto",
      favourites: ["Netflix", "YouTube", "Prime Video", "Spotify"],
    },
    {
      name: "Philips TV",
      device: "philips",
      entity: "remote.philips",
      media_player: "media_player.philips",
      icon: "solar:tv-bold-duotone",
      controls: [
        { entity: "input_select.tv_picture_style", name: "Beeldstijl" },
        { entity: "switch.tv_screen_off", name: "Scherm uit" },
      ],
    },
    {
      name: "Keuken",
      media_player: "media_player.keuken_sonos",
      icon: "solar:soundwave-bold-duotone",
      sources: "auto",
    },
  ],
});

/** The real living-room setup, and the point of the swipe deck: three devices of
 * very different shapes, one card height. Swipe (or use the rail) between the
 * **Philips TV** (wheel · channel · controls panel), the **Apple TV** (touchpad; its
 * volume is delegated to the Philips via `volume_entity`, named in the `.via` chip),
 * and the **Sonos speaker** (no d-pad → a now-playing hero fills its primary zone).
 * The card reserves the tallest panel, so paging never jumps. */
export const LivingRoom = story({
  type: "custom:fibbers-remote",
  language: "nl",
  remember: false,
  devices: [
    {
      name: "Philips TV",
      device: "philips",
      entity: "remote.philips",
      media_player: "media_player.philips",
      icon: "solar:tv-bold-duotone",
      controls: [
        { entity: "input_select.tv_picture_style", name: "Beeldstijl" },
        { entity: "switch.tv_screen_off", name: "Scherm uit" },
      ],
    },
    {
      name: "Apple TV",
      device: "appletv",
      entity: "remote.appletv",
      media_player: "media_player.appletv",
      volume_entity: "media_player.philips",
      icon: "solar:display-bold-duotone",
      sources: "auto",
      favourites: ["Netflix", "YouTube", "Prime Video", "Spotify"],
    },
    {
      name: "Keuken",
      media_player: "media_player.keuken_sonos",
      icon: "solar:soundwave-bold-duotone",
      sources: "auto",
    },
  ],
});

/** A media_player-only speaker: no remote entity, so no d-pad — its primary zone is
 * the **now-playing hero** (cover art · title · artist), sized to stand as tall as a
 * TV's wheel so it holds the deck's height. Below it: transport, a volume slider and
 * sources. */
export const SpeakerOnly = story({
  type: "custom:fibbers-remote",
  media_player: "media_player.keuken_sonos",
  name: "Keuken",
  icon: "solar:soundwave-bold-duotone",
  sources: "auto",
});

/** The 3×3 grid d-pad instead of the SVG wheel (`dpad: grid`). */
export const GridDpad = story({
  type: "custom:fibbers-remote",
  device: "appletv",
  entity: "remote.appletv",
  media_player: "media_player.appletv",
  icon: "solar:display-bold-duotone",
  name: "Apple TV",
  dpad: "grid",
});

/** An unknown platform: `device: generic` makes no assumptions, so every key is
 * spelled out in a `commands:` map. */
export const Generic = story({
  type: "custom:fibbers-remote",
  device: "generic",
  entity: "remote.beamer",
  name: "Beamer",
  icon: "solar:videocamera-record-bold-duotone",
  commands: {
    up: "KEY_UP",
    down: "KEY_DOWN",
    left: "KEY_LEFT",
    right: "KEY_RIGHT",
    ok: "KEY_OK",
    back: "KEY_BACK",
    home: "KEY_HOME",
    play: "KEY_PLAY",
    volume_up: "KEY_VOLUP",
    volume_down: "KEY_VOLDOWN",
  },
});
