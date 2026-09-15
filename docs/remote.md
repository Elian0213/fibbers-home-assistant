# fibbers-remote — commands & Philips TV notes

`fibbers-remote` sends via `remote.send_command`, and every integration uses its
own command spelling. The card derives the family from the entity's integration,
so you normally don't set anything. If your device isn't recognised, set `device:`
or supply a `commands:` map.

## Built-in families

| `device:`   | derived from | command names                                                                                                                                                |
| ----------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `appletv`   | `apple_tv`   | pyatv lowercase: `up` `down` `left` `right` `select` `menu` `home` `play_pause` `next` `previous` `volume_up` `volume_down` `turn_on` `turn_off`             |
| `philips`   | `philips_js` | `CursorUp` `CursorDown` `CursorLeft` `CursorRight` `Confirm` `Back` `Home` `VolumeUp` `VolumeDown` `Mute` `Standby` `ChannelStepUp` `ChannelStepDown` `Play` |
| `androidtv` | `androidtv`  | `DPAD_UP` `DPAD_DOWN` `DPAD_LEFT` `DPAD_RIGHT` `DPAD_CENTER` `BACK` `HOME` `MENU` `VOLUME_UP` `VOLUME_DOWN` `MUTE` `CHANNEL_UP` `CHANNEL_DOWN` `MEDIA_*`     |
| `generic`   | (unknown)    | none — you must supply `commands:`                                                                                                                           |

Buttons a platform can't do aren't rendered (no channel on Apple TV, no menu on
Philips). A rejected command is logged once (`console.warn`) with the command and
the platform, and the button flashes.

## Overriding

```yaml
type: custom:fibbers-remote
entity: remote.living_room
device: appletv # override the guess
commands: # override individual keys (merged over the device map)
  home: top_menu
```

## Finding the names for a new device

Some integrations (e.g. `philips_js`) accept any string and fail **silently** — a
successful service call is not proof the key exists. Confirm with a visible effect
on the device. Run this in the browser console on your dashboard:

```js
const hass = document.querySelector("home-assistant").hass;
const E = "remote.living_room"; // your entity
for (const c of ["up", "DPAD_UP", "select", "DPAD_CENTER", "home", "HOME"]) {
  try {
    await hass.callService("remote", "send_command", {
      entity_id: E,
      command: c,
    });
    console.log(c, "OK");
  } catch (e) {
    console.log(c, "ERR", e.message);
  }
  await new Promise((r) => setTimeout(r, 350));
}
```

The platform is under **Developer Tools → Entities → your remote → (settings) →**
or `config/entity_registry/get`.

## Card options

A card is one device (flat config) or several behind a switcher (`devices:`). Each
device takes:

| key             | type             | what it does                                                                                                                                                                     |
| --------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entity`        | `remote.*`       | the remote the d-pad / nav / transport / volume send through. Omit for a speaker.                                                                                                |
| `media_player`  | `media_player.*` | drives now-playing, the volume **slider** (when it reports `volume_level`), source chips, and lets transport prefer the player's own services.                                   |
| `volume_entity` | `media_player.*` | delegate **only the volume row** to another player — see [Delegated volume](#delegated-volume).                                                                                  |
| `device`        | enum             | `appletv` \| `philips` \| `androidtv` \| `generic` — override the platform guess.                                                                                                |
| `commands`      | map              | per-key command overrides, merged over the device family.                                                                                                                        |
| `dpad`          | enum             | `swipe` \| `buttons` \| `both` \| `grid` — d-pad interaction/shape.                                                                                                              |
| `sources`       | `"auto"` \| list | source chips (needs `media_player`). `auto` uses the player's `source_list`.                                                                                                     |
| `favourites`    | list             | the subset shown collapsed before "All N".                                                                                                                                       |
| `name`, `icon`  | string           | device label / icon.                                                                                                                                                             |
| `remember`      | bool             | persist the selected device (default `true`).                                                                                                                                    |
| `auto_select`   | `"playing"`      | on mount, open the device whose `media_player` is playing.                                                                                                                       |
| `swipe`         | bool             | card-level; horizontal drag pages between `devices:` (default `true`). `false` disables the gesture — the switcher rail always works regardless.                                 |
| `keyboard`      | bool             | card-level; when the card has focus, arrows/Enter/Escape drive the d-pad, `+`/`-`/`m` the volume, `[`/`]` the device (default `true`). See [accessibility.md](accessibility.md). |
| `haptics`       | bool             | card-level; a short vibration on each discrete key press (default `false`; no effect on iOS, which has no `navigator.vibrate`). The touchpad has its own `touchpad.haptics`.     |
| `controls`      | list             | an extra controls panel — see below.                                                                                                                                             |
| `language`      | string           | override HA's language for on-screen strings.                                                                                                                                    |

Volume degrades honestly: a `media_player` that reports `volume_level` gets a
positional slider; one that doesn't (many Apple TVs) gets a **scrub strip** — drag
to change, the ends are Volume−/Volume+ buttons — because there is no level to place
a thumb at.

### Delegated volume

`volume_entity` points this device's volume row at a **different** `media_player`.
Use it when the box you're controlling has no volume of its own — an Apple TV, a
Chromecast — and the sound actually leaves a TV, a soundbar or an AVR:

```yaml
- name: Apple TV
  device: appletv
  entity: remote.living_room
  media_player: media_player.living_room
  volume_entity: media_player.43pus7608_12 # sound leaves the Philips, not the Apple TV
```

Everything else on the card — now-playing, transport, sources — stays on
`media_player`. Only the volume row (slider/scrub, mute, percentage) follows
`volume_entity`, and a `.via` chip names the player it's driving. When it's set, the
device's own `volume_up` / `volume_down` / `volume_mute` commands are **not** used —
the delegated player's services are. The row stays put (visible but inert) while the
delegate is asleep, so nothing jumps as the TV wakes.

## Multiple devices & swiping

With `devices:`, swipe left/right on the body (or use the segmented rail) to page
between them. Because devices differ in shape, the card **reserves the tallest
panel's height** so paging never jumps. A device with no d-pad — a speaker, or a
`media_player`-only entry — fills its primary zone with a **now-playing hero** (cover
art from `entity_picture`, title and artist), so it stands the same height as a TV's
wheel/touchpad instead of collapsing to a stub. Disable the gesture with
`swipe: false`; the rail always works.

## Extra controls (`controls:`)

`controls:` renders whatever the remote can't infer — a picture-style preset, a
backlight, a screen-off switch — in the companion panel. Each entry is
`{ entity, name?, icon?, type? }`; the kind is inferred from the entity domain
(`type:` overrides):

| entity domain              | renders as        | service                            |
| -------------------------- | ----------------- | ---------------------------------- |
| `select` / `input_select`  | preset chips      | `select_option`                    |
| `light`                    | brightness slider | `light.turn_on` (`brightness_pct`) |
| `number` / `input_number`  | value slider      | `set_value`                        |
| `switch` / `input_boolean` | pill toggle       | `toggle`                           |
| `button` / `scene`         | press key         | `press` / `turn_on`                |

```yaml
type: custom:fibbers-remote
device: philips
entity: remote.tv
media_player: media_player.tv
controls:
  - entity: input_select.tv_picture_style # → preset chips
    name: Beeldstijl
  - entity: switch.tv_screen_off # → toggle
    name: Scherm uit
```

### Picture-style presets — 🧪 beta, and TV-dependent

Picture-style presets (e.g. `Dolby Vision Dark`) and picture brightness aren't Home
Assistant entities out of the box — `philips_js` exposes no picture control — so the
card can only render them if **you expose them yourself**, and whether that's even
possible depends on your TV's OS:

- **Android-TV Philips (≈2016–2021)** — the JointSpace API has the `menuitems` module,
  so picture style/brightness _can_ be exposed as an `input_select`/`number` (via
  [`pylips`](https://github.com/eslavnov/pylips) MQTT or a `rest_command` to
  `…/menuitems/settings/update`). Point a `controls:` entry at it and the card renders
  it. The example above assumes such an entity exists.
- **Titan OS Philips (2022+, e.g. PUS7608/7609)** — the API has **no `menuitems`**, so
  picture style/brightness are **not controllable over the network by any tool**. Change
  them on the TV itself.

Check which one you have in [Philips TV capabilities](#philips-tv-capabilities) below.

## Philips TV capabilities

Everything `fibbers-remote` does goes through Home Assistant's `philips_js` integration
(over the TV's **JointSpace** JSON-API). What that API exposes depends entirely on
which **OS** your TV runs — and that decides whether picture presets (Dolby Vision
Dark/Bright), picture brightness, and Ambilight are controllable **at all**.

This section exists so we don't have to re-derive it. Short version:

| Capability                                                      | Android-TV Philips (≈2016–2021) | **Titan OS Philips (2022+)**       |
| --------------------------------------------------------------- | ------------------------------- | ---------------------------------- |
| Power / volume / mute / transport                               | ✅                              | ✅                                 |
| Source / app select                                             | ✅                              | ⚠️ often unresponsive              |
| Ambilight (light + modes)                                       | ✅                              | ❌ not exposed                     |
| **Picture style / preset** (Dolby Vision Dark/Bright, Movie, …) | 🧪 possible (see below)         | ❌ **impossible over the network** |
| **Picture brightness / contrast**                               | 🧪 possible (see below)         | ❌ **impossible over the network** |

The picture-settings controls are **🧪 beta**: even on the models that support them,
they aren't Home-Assistant entities out of the box — you have to expose them yourself
(below), and the node-IDs are per-model.

### Why: the JointSpace API is not the same on every TV

A Philips TV advertises exactly which API modules it supports. Pull the integration's
diagnostics (**Settings → Devices & services → Philips TV → ⋮ → Download diagnostics**)
and look at `data.system.featuring`:

```jsonc
"featuring": {
  "jsonfeatures": {
    // Android-TV models ALSO list: "ambilight", "menuitems", "channellist", "recordings", …
    "activities": [...], "inputkey": [...], "pointer": [...], "textentry": [...]
  },
  "systemfeatures": { "os_type": "Linux" /* Titan OS */ | "android" }
}
```

- **`menuitems`** is the module `pylips` uses for picture settings
  (`menuitems/settings/structure|current|update`). **No `menuitems` → no picture
  control, full stop.**
- **`ambilight`** gates the Ambilight light/modes the same way.
- `os_type: "Linux"` = **Titan OS**; `os_type: "android"` = Android TV.

#### Android-TV family — picture settings are 🧪 possible

`jsonfeatures` includes `menuitems` (and usually `ambilight`). Picture style, brightness
and contrast live under `menuitems/settings/*`, keyed by numeric **node-IDs that differ
per model** — discover yours with a `GET .../menuitems/settings/structure`. These aren't
HA entities, so to drive them from Fibbers you:

1. Expose each as an `input_select` (picture style) / `input_number` (brightness) — via
   [`eslavnov/pylips`](https://github.com/eslavnov/pylips) (MQTT) or a `rest_command`
   POSTing to `…/menuitems/settings/update`.
2. Point a `controls:` entry at it — see [Extra controls](#extra-controls-controls).

The card renders whatever you wire up; it can't invent the entity.

#### Titan OS family — picture settings are ❌ impossible

Titan OS (2022+ sets: PUS7608, PUS7609, The One/The Xtra, …) runs a **stripped
JointSpace v6**. Its `jsonfeatures` has **no `menuitems` and no `ambilight`** — the
picture-settings API simply isn't there. This is not a Fibbers or config problem: no
tool can reach those settings.

- `philips_js` exposes only: `media_player`, `remote`, a `switch` (screen off/on),
  recording `binary_sensor`s (and an Ambilight `light` that stays `unavailable`).
- `pylips` targets the Android-TV `menuitems` API → **doesn't apply**.
- The dedicated [OpenHAB Titan OS binding](https://community.openhab.org/t/beta-titan-os-binding-control-newer-philips-smart-tvs-jointspace-v6-5-0-0/169480)
  — the most complete Titan OS reverse-engineering — exposes **only** power, volume,
  channel and Ambilight. **No picture settings.**
- The only remaining hook is `inputkey` (send remote keys), i.e. blindly navigating the
  on-screen Quick-Menu → Picture-Style list. No state feedback, breaks on any firmware UI
  change — **not worth building**, and not something Fibbers does.

### Worked evidence — Philips 43PUS7608/12 (`TPN236E`, Titan OS)

Captured live from `philips_js` diagnostics, so the verdict above is reproducible:

```jsonc
system.api_version = { Major: 6, Minor: 1, Patch: 0 }   // JointSpace v6.1
system.model       = "TPN236E"   // 43PUS7608/12
system.featuring.systemfeatures.os_type = "Linux"       // → Titan OS

system.featuring.jsonfeatures = {
  activities: ["browser"], alexa: ["ssl_available"],
  inputkey: ["key","unicode"], pointer: ["context_based"],
  recordings: ["List","Schedule","Manage"],
  textentry: ["context_based","initial_string_available"]
  // NOTE: no "menuitems", no "ambilight", no "channellist"
}

// and, live: ambilight_modes: [], ambilight_styles: {}, applications: {}, sources: {}
```

No `menuitems` → **Dolby Vision Dark/Bright and picture brightness cannot be set over the
network on this TV, by any means.** Correct move: change picture presets on the TV itself.

### References

- Home Assistant [`philips_js`](https://www.home-assistant.io/integrations/philips_js/) —
  _"There is no support to control the standard, non-expert, styles of the TV."_
- [`eslavnov/pylips`](https://github.com/eslavnov/pylips) — Android-TV JointSpace API,
  incl. `menuitems/settings/*`.
- [`danielperna84/ha-philipsjs`](https://github.com/danielperna84/ha-philipsjs) — the
  Python wrapper `philips_js` builds on.
- [OpenHAB Titan OS binding](https://community.openhab.org/t/beta-titan-os-binding-control-newer-philips-smart-tvs-jointspace-v6-5-0-0/169480)
  — Titan OS capability ceiling.
