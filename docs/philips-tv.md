# Philips TV — what `fibbers-remote` can and can't control

Everything `fibbers-remote` does goes through Home Assistant's `philips_js` integration
(over the TV's **JointSpace** JSON-API). What that API exposes depends entirely on
which **OS** your TV runs — and that decides whether picture presets (Dolby Vision
Dark/Bright), picture brightness, and Ambilight are controllable **at all**.

This page exists so we don't have to re-derive it. Short version:

| Capability | Android-TV Philips (≈2016–2021) | **Titan OS Philips (2022+)** |
| --- | --- | --- |
| Power / volume / mute / transport | ✅ | ✅ |
| Source / app select | ✅ | ⚠️ often unresponsive |
| Ambilight (light + modes) | ✅ | ❌ not exposed |
| **Picture style / preset** (Dolby Vision Dark/Bright, Movie, …) | 🧪 possible (see below) | ❌ **impossible over the network** |
| **Picture brightness / contrast** | 🧪 possible (see below) | ❌ **impossible over the network** |

The picture-settings controls are **🧪 beta**: even on the models that support them,
they aren't Home-Assistant entities out of the box — you have to expose them yourself
(below), and the node-IDs are per-model.

---

## Why: the JointSpace API is not the same on every TV

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

### Android-TV family — picture settings are 🧪 possible

`jsonfeatures` includes `menuitems` (and usually `ambilight`). Picture style, brightness
and contrast live under `menuitems/settings/*`, keyed by numeric **node-IDs that differ
per model** — discover yours with a `GET .../menuitems/settings/structure`. These aren't
HA entities, so to drive them from Fibbers you:

1. Expose each as an `input_select` (picture style) / `input_number` (brightness) — via
   [`eslavnov/pylips`](https://github.com/eslavnov/pylips) (MQTT) or a `rest_command`
   POSTing to `…/menuitems/settings/update`.
2. Point a `controls:` entry at it — see [remote-commands.md](remote-commands.md#extra-controls-controls).

The card renders whatever you wire up; it can't invent the entity.

### Titan OS family — picture settings are ❌ impossible

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

---

## Worked evidence — Philips 43PUS7608/12 (`TPN236E`, Titan OS)

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

## References

- Home Assistant [`philips_js`](https://www.home-assistant.io/integrations/philips_js/) —
  *"There is no support to control the standard, non-expert, styles of the TV."*
- [`eslavnov/pylips`](https://github.com/eslavnov/pylips) — Android-TV JointSpace API,
  incl. `menuitems/settings/*`.
- [`danielperna84/ha-philipsjs`](https://github.com/danielperna84/ha-philipsjs) — the
  Python wrapper `philips_js` builds on.
- [OpenHAB Titan OS binding](https://community.openhab.org/t/beta-titan-os-binding-control-newer-philips-smart-tvs-jointspace-v6-5-0-0/169480)
  — Titan OS capability ceiling.
