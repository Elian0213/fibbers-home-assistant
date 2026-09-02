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
