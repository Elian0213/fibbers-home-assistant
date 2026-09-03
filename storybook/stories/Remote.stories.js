import { story } from "../src/story.js";

export default {
  title: "Cards/Remote",
  tags: ["autodocs"],
};

/** Apple TV: wheel + a distinct Back/Home nav row, transport (⏮ ▶ ⏭), and — because
 * the player reports no volume level — the slider-shaped **scrub** strip. Sources
 * collapse to favourites. */
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
 * speaker — no d-pad. */
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

/** A media_player-only speaker: no remote entity, so no d-pad — just now-playing,
 * transport, a volume slider and sources. */
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
