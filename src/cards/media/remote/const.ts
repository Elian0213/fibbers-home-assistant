/* ================================================================== *
 * fibbers-remote — shared constants: per-platform command maps, device kinds,
 * icons, media_player feature bits, control-panel kinds, and the SVG donut
 * geometry for the d-pad wheel. Plain data, no state — imported by the element,
 * the pure helpers, and the view components.
 * ================================================================== */
import type { ChipItem } from "@shared/ui";

// Per-platform command names. A key absent here (and from `commands:`) means the
// device can't do it, so that control doesn't render.
export const COMMANDS: Record<string, Record<string, string>> = {
  appletv: {
    up: "up",
    down: "down",
    left: "left",
    right: "right",
    ok: "select",
    menu: "menu",
    home: "home",
    back: "menu",
    play: "play_pause",
    next: "next",
    previous: "previous",
    volume_up: "volume_up",
    volume_down: "volume_down",
  },
  philips: {
    up: "CursorUp",
    down: "CursorDown",
    left: "CursorLeft",
    right: "CursorRight",
    ok: "Confirm",
    back: "Back",
    home: "Home",
    play: "Play",
    volume_up: "VolumeUp",
    volume_down: "VolumeDown",
    volume_mute: "Mute",
    channel_up: "ChannelStepUp",
    channel_down: "ChannelStepDown",
    power: "Standby",
  },
  androidtv: {
    power: "POWER",
    up: "DPAD_UP",
    down: "DPAD_DOWN",
    left: "DPAD_LEFT",
    right: "DPAD_RIGHT",
    ok: "DPAD_CENTER",
    back: "BACK",
    home: "HOME",
    menu: "MENU",
    volume_up: "VOLUME_UP",
    volume_down: "VOLUME_DOWN",
    volume_mute: "MUTE",
    channel_up: "CHANNEL_UP",
    channel_down: "CHANNEL_DOWN",
    previous: "MEDIA_PREVIOUS",
    next: "MEDIA_NEXT",
    play: "MEDIA_PLAY_PAUSE",
  },
  generic: {},
};

export const PLATFORM_DEVICE: Record<string, string> = {
  apple_tv: "appletv",
  philips_js: "philips",
  androidtv: "androidtv", // the media_player platform
  androidtv_remote: "androidtv", // the remote.* platform that uses these keycodes
};

export const DEVICE_ICON: Record<string, string> = {
  appletv: "solar:tv-bold-duotone",
  philips: "solar:tv-bold-duotone",
  androidtv: "solar:tv-bold-duotone",
  generic: "solar:gamepad-bold-duotone",
};
// A device with a media_player but no remote entity is a speaker, not a TV.
export const SPEAKER_ICON = "solar:smart-speaker-bold-duotone";

// A remote/player is "off" in any of these — so `unknown` isn't treated as on
// (used for the header/switcher dots and the Apple TV power direction).
export const OFF_STATES = ["off", "standby", "unavailable", "unknown"];
export const GONE_STATES = ["unavailable", "unknown", "off"];

// media_player supported_features bits (HA core) — route a control down the path
// the player actually advertises, not just "a media_player exists".
export const MF_PAUSE = 1;
export const MF_SEEK = 2;
export const MF_VOLUME_MUTE = 8;
export const MF_PREV = 16;
export const MF_NEXT = 32;
export const MF_VOLUME_STEP = 1024;
export const MF_SELECT_SOURCE = 2048;
export const MF_PLAY = 16384;

export const DPAD_MODES = ["swipe", "buttons", "both", "grid", "touchpad"];

// Optional `controls:` panel — surface extra entities the remote can't infer (a
// picture-style select, a brightness slider, a screen-off switch). Entity domain →
// render kind; `type:` on the control overrides. Slider kinds (light/number) get a
// per-entity SliderHold + drag gesture built in setConfig.
export const CONTROL_TYPE: Record<string, string> = {
  select: "select",
  input_select: "select",
  light: "light",
  number: "number",
  input_number: "number",
  switch: "toggle",
  input_boolean: "toggle",
  button: "button",
  scene: "scene",
};
export const CONTROL_TYPES = [
  "select",
  "light",
  "number",
  "toggle",
  "button",
  "scene",
];
export const SLIDER_CONTROLS = ["light", "number"];

// SVG donut geometry (viewBox -104..104): outer radius 100, hub hole 40, four 76°
// sectors on ±90/0/180° with a 7° gap either side; `ix/iy` is the chevron anchor.
export const SEG: Record<string, { d: string; ix: number; iy: number }> = {
  up: {
    d: "M -61.57 -78.80 A 100 100 0 0 1 61.57 -78.80 L 24.63 -31.52 A 40 40 0 0 0 -24.63 -31.52 Z",
    ix: 0,
    iy: -72,
  },
  right: {
    d: "M 78.80 -61.57 A 100 100 0 0 1 78.80 61.57 L 31.52 24.63 A 40 40 0 0 0 31.52 -24.63 Z",
    ix: 72,
    iy: 0,
  },
  down: {
    d: "M 61.57 78.80 A 100 100 0 0 1 -61.57 78.80 L -24.63 31.52 A 40 40 0 0 0 24.63 31.52 Z",
    ix: 0,
    iy: 72,
  },
  left: {
    d: "M -78.80 61.57 A 100 100 0 0 1 -78.80 -61.57 L -31.52 -24.63 A 40 40 0 0 0 -31.52 24.63 Z",
    ix: -72,
    iy: 0,
  },
};
// Outward-pointing chevron glyphs, drawn in wheel units at each sector's anchor.
export const CHEV: Record<string, string> = {
  up: "M -7 3.5 L 0 -3.5 L 7 3.5",
  down: "M -7 -3.5 L 0 3.5 L 7 -3.5",
  left: "M 3.5 -7 L -3.5 0 L 3.5 7",
  right: "M -3.5 -7 L 3.5 0 L -3.5 7",
};
export const ARROW: Record<string, string> = {
  up: "solar:alt-arrow-up-bold-duotone",
  down: "solar:alt-arrow-down-bold-duotone",
  left: "solar:alt-arrow-left-bold-duotone",
  right: "solar:alt-arrow-right-bold-duotone",
};

// Re-exported so `const.ts` is the single import site for the chip type the
// source/control lists build on.
export type { ChipItem };
