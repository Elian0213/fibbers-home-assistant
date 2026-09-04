# fibbers-remote — command names per device

`fibbers-remote` sends via `remote.send_command`, and every integration uses its
own command spelling. The card derives the family from the entity's integration,
so you normally don't set anything. If your device isn't recognised, set `device:`
or supply a `commands:` map.

## Built-in families

| `device:` | derived from | command names |
|---|---|---|
| `appletv` | `apple_tv` | pyatv lowercase: `up` `down` `left` `right` `select` `menu` `home` `play_pause` `next` `previous` `volume_up` `volume_down` `turn_on` `turn_off` |
| `philips` | `philips_js` | `CursorUp` `CursorDown` `CursorLeft` `CursorRight` `Confirm` `Back` `Home` `VolumeUp` `VolumeDown` `Mute` `Standby` `ChannelStepUp` `ChannelStepDown` `Play` |
| `androidtv` | `androidtv` | `DPAD_UP` `DPAD_DOWN` `DPAD_LEFT` `DPAD_RIGHT` `DPAD_CENTER` `BACK` `HOME` `MENU` `VOLUME_UP` `VOLUME_DOWN` `MUTE` `CHANNEL_UP` `CHANNEL_DOWN` `MEDIA_*` |
| `generic` | (unknown) | none — you must supply `commands:` |

Buttons a platform can't do aren't rendered (no channel on Apple TV, no menu on
Philips). A rejected command is logged once (`console.warn`) with the command and
the platform, and the button flashes.

## Overriding

```yaml
type: custom:fibbers-remote
entity: remote.living_room
device: appletv          # override the guess
commands:                # override individual keys (merged over the device map)
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
    await hass.callService("remote", "send_command", { entity_id: E, command: c });
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

| key | type | what it does |
|---|---|---|
| `entity` | `remote.*` | the remote the d-pad / nav / transport / volume send through. Omit for a speaker. |
| `media_player` | `media_player.*` | drives now-playing, the volume **slider** (when it reports `volume_level`), source chips, and lets transport prefer the player's own services. |
| `device` | enum | `appletv` \| `philips` \| `androidtv` \| `generic` — override the platform guess. |
| `commands` | map | per-key command overrides, merged over the device family. |
| `dpad` | enum | `swipe` \| `buttons` \| `both` \| `grid` — d-pad interaction/shape. |
| `sources` | `"auto"` \| list | source chips (needs `media_player`). `auto` uses the player's `source_list`. |
| `favourites` | list | the subset shown collapsed before "All N". |
| `name`, `icon` | string | device label / icon. |
| `remember` | bool | persist the selected device (default `true`). |
| `auto_select` | `"playing"` | on mount, open the device whose `media_player` is playing. |
| `controls` | list | an extra controls panel — see below. |
| `language` | string | override HA's language for on-screen strings. |

Volume degrades honestly: a `media_player` that reports `volume_level` gets a
positional slider; one that doesn't (many Apple TVs) gets a **scrub strip** — drag
to change, the ends are Volume−/Volume+ buttons — because there is no level to place
a thumb at.

## Extra controls (`controls:`)

`controls:` renders whatever the remote can't infer — a picture-style preset, a
backlight, a screen-off switch — in the companion panel. Each entry is
`{ entity, name?, icon?, type? }`; the kind is inferred from the entity domain
(`type:` overrides):

| entity domain | renders as | service |
|---|---|---|
| `select` / `input_select` | preset chips | `select_option` |
| `light` | brightness slider | `light.turn_on` (`brightness_pct`) |
| `number` / `input_number` | value slider | `set_value` |
| `switch` / `input_boolean` | pill toggle | `toggle` |
| `button` / `scene` | press key | `press` / `turn_on` |

```yaml
type: custom:fibbers-remote
device: philips
entity: remote.tv
media_player: media_player.tv
controls:
  - entity: input_select.tv_picture_style   # → preset chips
    name: Beeldstijl
  - entity: switch.tv_screen_off            # → toggle
    name: Scherm uit
```

### Picture-style presets — 🧪 beta, and TV-dependent

Picture-style presets (e.g. `Dolby Vision Dark`) and picture brightness aren't Home
Assistant entities out of the box — `philips_js` exposes no picture control — so the
card can only render them if **you expose them yourself**, and whether that's even
possible depends on your TV's OS:

- **Android-TV Philips (≈2016–2021)** — the JointSpace API has the `menuitems` module,
  so picture style/brightness *can* be exposed as an `input_select`/`number` (via
  [`pylips`](https://github.com/eslavnov/pylips) MQTT or a `rest_command` to
  `…/menuitems/settings/update`). Point a `controls:` entry at it and the card renders
  it. The example above assumes such an entity exists.
- **Titan OS Philips (2022+, e.g. PUS7608/7609)** — the API has **no `menuitems`**, so
  picture style/brightness are **not controllable over the network by any tool**. Change
  them on the TV itself.

Check which one you have and see the full findings + how to identify your TV in
**[philips-tv.md](philips-tv.md)**.
