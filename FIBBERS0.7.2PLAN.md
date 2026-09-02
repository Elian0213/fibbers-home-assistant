# Fibbers 0.7.2 — sliders snap back, and the remote never worked

Paste into Claude Code in `fibbers-home-assistant`.
**Supersedes the earlier 0.7.2 note** — the slider was only half of it.

Everything below was proven against a live instance on HA 2026.8.3 with Fibbers
0.7.1: an Apple TV (`apple_tv` integration) and a Philips TV (`philips_js`).

Two real bugs, one ergonomics problem, one latent trap. Ordered by blast radius.

---

# Part 1 — `fibbers-remote` sends command names neither device understands

**The Apple TV remote is completely non-functional.** Not laggy — every d-pad and
transport button is a no-op.

`DEFAULTS` in `src/cards/remote.js` uses Android-TV / Chromecast naming:

```js
power: "POWER", up: "DPAD_UP", down: "DPAD_DOWN", left: "DPAD_LEFT",
right: "DPAD_RIGHT", ok: "DPAD_CENTER", back: "BACK", home: "HOME",
menu: "MENU", volume_up: "VOLUME_UP", volume_down: "VOLUME_DOWN",
volume_mute: "MUTE", channel_up: "CHANNEL_UP", channel_down: "CHANNEL_DOWN",
previous: "MEDIA_PREVIOUS", next: "MEDIA_NEXT", play: "MEDIA_PLAY_PAUSE"
```

I called `remote.send_command` directly against `remote.living_room` with both
spellings. Result:

| command sent | result |
|---|---|
| `up` | **OK** |
| `DPAD_UP` | `ERR: Command not found. Exiting sequence` |
| `select` | **OK** |
| `DPAD_CENTER` | `ERR: Command not found. Exiting sequence` |
| `menu` | **OK** |
| `BACK` | `ERR: Command not found. Exiting sequence` |
| `home` | **OK** |
| `HOME` | `ERR: Command not found. Exiting sequence` |
| `volume_up` | **OK** |
| `VOLUME_UP` | `ERR: Command not found. Exiting sequence` |

`apple_tv` passes commands to pyatv, which uses **lowercase** names. Every default
the card sends is rejected.

**And the `device:` option doesn't help — it's cosmetic.** It only picks the header
icon via `DEVICE_ICON`; `philips` and `appletv` even resolve to the same icon. There
is no per-device command remapping anywhere in the file. So `device: appletv`
promises a working Apple TV remote and delivers an icon.

**The Philips remote is probably dead too, silently.** `philips_js` accepted
*every* string I sent, including `DPAD_UP` — which cannot be a real Philips key. It
POSTs the key to the TV and an unrecognised key is simply ignored, so the service
call succeeds and nothing happens. No error to notice. The real Philips family is
`CursorUp` / `CursorDown` / `CursorLeft` / `CursorRight` / `Confirm` / `Back` /
`Home` / `VolumeUp` / `VolumeDown` / `Mute` / `Standby` / `ChannelStepUp` /
`ChannelStepDown` / `Play` / `Pause`.

This is worth stressing: **the two devices the card ships presets for are the two
it doesn't work on.** The app-source chips work, which is why it half-looks fine —
those go through `media_player.select_source`, not `remote.send_command`.

- [ ] Make `device:` real. Per-device command maps:
      - `appletv` → pyatv lowercase: `up`, `down`, `left`, `right`, `select`,
        `menu`, `home`, `home_hold`, `play_pause`, `next`, `previous`,
        `volume_up`, `volume_down`, `skip_forward`, `skip_backward`,
        `turn_on`, `turn_off`
      - `philips` → `CursorUp`, `CursorDown`, `CursorLeft`, `CursorRight`,
        `Confirm`, `Back`, `Home`, `VolumeUp`, `VolumeDown`, `Mute`, `Standby`,
        `ChannelStepUp`, `ChannelStepDown`, `Play`, `Pause`
      - `androidtv` → the current uppercase set (it's correct for that platform;
        keep it, just stop calling it the default for everything)
      - `generic` → no assumptions; require `commands:` and say so in `setConfig`
- [ ] **Derive the default from the entity's integration** rather than making the
      user pick. The platform is available from the entity registry
      (`config/entity_registry/get` → `platform`: `apple_tv`, `philips_js`, …).
      Falling back to Android-TV names for an unknown platform is what caused this.
- [ ] Keep `commands:` as a per-key override, merged over the device map.
- [ ] **Surface failures.** A rejected `send_command` currently dies silently in a
      fire-and-forget call. Catch it, `console.warn` once per key with the command
      string and the entity's platform, and flash the button. A dead remote should
      not look identical to a working one.
- [ ] Drop `channel_up`/`channel_down` for `appletv` — pyatv has no channel
      concept, so those two buttons should not render at all.
- [ ] Hide `volume_*` when the target can't do volume, rather than showing buttons
      that no-op.

**Done when** every rendered button on both remotes produces a visible effect on
the device, and an unsupported command logs rather than vanishing.

---

# Part 2 — the remote is too small to use

Measured from source:

| element | size |
|---|---|
| d-pad | `h-[168px] w-[168px]` — fixed |
| d-pad arrows | `h-12 w-12` (48px) |
| round buttons | `h-11 w-11` (44px) |
| power button | `h-9 w-9` (**36px**) |

Two problems. The d-pad is a **fixed 168px** regardless of viewport — on a 390px
phone that's 43% of the width with the rest of the card empty, and on desktop it
stays tiny in a 500px column. And the power button at 36px is below the 44px
minimum the 0.7.0 changelog claims for this card.

- [ ] Make the d-pad responsive: `min(72vw, 260px)` on narrow viewports, and scale
      the arrow hit areas with it rather than fixing them at 48px. A TV remote is a
      thumb instrument; it should dominate the card.
- [ ] Raise every control to ≥44px, power included.
- [ ] Grow the centre OK proportionally — it's the most-pressed target.
- [ ] **Add a swipe surface for `appletv`.** The physical Siri remote is a
      trackpad, and pyatv exposes directional commands, so a swipe area that maps
      flick direction → `up`/`down`/`left`/`right` and tap → `select` matches how
      the device is actually driven. Offer it as `dpad: swipe | buttons | both`
      (default `both` for appletv).
- [ ] Long-press repeat currently does `setInterval(() => this._send(key), 140)` —
      about **7 service calls per second**, unbounded while held. Use the
      integration's own repeat (`num_repeats`, or `hold_secs` where supported),
      cap the rate, and stop on `pointercancel` / `lostpointercapture` /
      `visibilitychange`.

---

# Part 3 — every slider shows a stale value for one round trip

This is the "teleports back and forth" you feel on the phone. It is **not** a
missing debounce: the cards already commit only on release and already suppress
`hass` updates mid-drag via `_dragging`, and the shared `sliderTrack()` already sets
`touch-action: none`. All of that is correct.

The bug is the ordering in `_up`:

```js
this._dragging = false;   // display switches to hass state immediately
this._commit(pct);        // the service call only starts here
```

and `_commit` being fire-and-forget:

```js
_commit(pct) {
  if (!this.hass) return;
  const entity_id = this._config.entity;
  if (pct <= 0) this.hass.callService("light", "turn_off", { entity_id });
  else this.hass.callService("light", "turn_on", { entity_id, brightness_pct: pct });
}
```

The moment you lift your finger `_dragging` is false, so the display falls back to
`_pctFromHass()` — the **old** brightness, because the bulb hasn't reported yet.
Release at 70% on a lamp at 5% and you see **70 → 5 → 70**. Worse on a phone: the
round trip includes the companion app socket plus Hue or Tuya latency, and your
finger is right there watching it.

**The blast radius is bigger than the light row.** I checked `media.js` — the same
pattern appears in the volume slider *and* the seek bar:

```js
_up(e) { … this._dragging = false; this._svc("volume_set", { volume_level: v / 100 }); }
_vol() { if (this._dragging) return this._dragVol; … }
```

A seek bar is the most visible case of all — the playhead jumps backwards after you
let go. Same shape in `fibbers-light-group` and `fibbers-number`.

- [ ] Fix it **once, in the shared slider helper**, not per card.
- [ ] Add reactive `_pendingValue` + a timestamp. Set it in the commit, *before*
      the service call.
- [ ] Display order: `_dragging` → drag value; else pending value if still pending;
      else entity state.
- [ ] Clear pending when the entity lands within a tolerance (~2% — `brightness_pct`
      ↔ 0–255 rounding means it is rarely exact; never compare for equality), or
      after a ~2 s timeout, whichever first.
- [ ] Clear it if the entity goes `off`/`unavailable` while pending, so a failed
      call doesn't leave a phantom value on screen.
- [ ] Use the same mechanism for `media_seek`, where the tolerance is seconds and
      the timeout wants to be longer.

### Optional: let the light follow the finger

Committing only on release also means the room does nothing until you let go, which
is part of what reads as lag. Mushroom and HA's own light tile update live, throttled.

- [ ] `live: true` (default on for `light-*`, off for `number`): during drag, send at
      most every ~200 ms, trailing edge, skip if unchanged, always send a final call
      on release. Opt-out matters — Zigbee meshes and Tuya cloud lamps dislike five
      calls a second.

With the optimistic hold in place this is safe: live calls are masked by the drag
value, the release call by the pending value.

---

# Part 4 — a latent trap in `sliderTrack()`

```js
@pointercancel=${onCancel || onUp}
```

If a card omits `onCancel`, a **cancelled** gesture is treated as completed and
commits — using whatever `clientX` the cancel event carries, which can be stale or
off-track. `light-row` passes an `onCancel`, so it's fine today. The next card that
forgets will silently write a wrong value.

- [ ] Default `pointercancel` to *abort* (clear dragging, commit nothing).
- [ ] Handle `lostpointercapture` the same way — currently unhandled, and it fires
      for real on mobile: incoming call, app switch, browser chrome appearing.

---

# Acceptance

1. Every button on the Apple TV remote visibly drives the device; `DPAD_*` no longer
   appears in any call for an `apple_tv` entity.
2. Philips d-pad, Home, Back, volume and Standby all visibly work.
3. An unsupported command logs one warning naming the command and the platform.
4. The d-pad fills a phone's width comfortably; no control is under 44px.
5. Holding volume for 3 s issues a bounded number of calls, and stops on cancel.
6. Drag a light to 70% and release on a phone: it stays at 70%, no snap-back. Verify
   on a Hue lamp *and* a Tuya one — Tuya's round trip is the longer.
7. Same for `light-group`, `number`, media volume and **media seek**.
8. In the harness, feed a `hass` update still reporting the old value 200 ms after
   release and assert the rendered value is the committed one. Assert *inside* the
   window — my earlier test waited 2.5 s and therefore reported the slider as fine.
9. A `pointercancel` mid-drag leaves the entity unchanged.

## Verifying command names on any device

This is how I found the Apple TV bug, and it generalises — worth putting in
`docs/` so users can self-diagnose a new platform:

```js
const hass = document.querySelector('home-assistant').hass;
const E = 'remote.living_room';
for (const c of ['up','DPAD_UP','select','DPAD_CENTER','home','HOME']) {
  try { await hass.callService('remote','send_command',{entity_id:E,command:c});
        console.log(c,'OK'); }
  catch (e) { console.log(c,'ERR',e.message); }
  await new Promise(r=>setTimeout(r,350));
}
```

Note the caveat: some integrations (`philips_js`) accept anything and fail silently,
so "OK" is not proof. Confirm with an observable effect on the device.

Then bump CHANGELOG and tag `0.7.2`.
