# Fibbers v0.7.3 — implementation plan

**Baseline:** tag `0.7.2` (commit `919d2b7`), installed and running on HA 2026.8.3 / HAOS 18.2.
**Scope:** every defect found by a full audit of all 26 cards + the 15 infrastructure modules, plus a live
instrumented sweep of all 8 views of the `dashboard-main` dashboard (158 card instances, 24 distinct types).

Each item below is tagged with how it was established:

- **[LIVE]** — reproduced on the running instance with a measurement or an intercepted service call. Not a guess.
- **[SRC]** — proven by reading the source; the trigger condition is stated so it can be reproduced.

Line numbers are against tag `0.7.2`. Verify with `sed -n` before editing; do not trust them blindly after
the first patch shifts the file.

**Before anything else:** the 0.7.2 release has **0 assets** because CI failed on `dist/ is in sync with src/`.
The only difference is 55 bytes of dead Tailwind (`.h-\[168px\]`, `.w-\[168px\]`) left in a stale
`src/tailwind.gen.js`. Run `bun run gen-tw && bun run build`, commit **both** `src/tailwind.gen.js` and
`dist/fibbers.js`, and make that the first commit of 0.7.3.

---

## P0 — Broken. Fix these or 0.7.3 isn't worth cutting.

### 1. Every slider has a ~5-pixel-tall hit area

**[LIVE]** This is the single biggest usability defect in the library and the real cause of the "sliders are
laggy / jump around on my phone" complaint. 0.7.2 fixed the *snap-back*; it did not fix the *target*.

Measured on `/dashboard-main/licht`, probing `document.elementFromPoint` (recursed through shadow roots)
vertically outward from the centre of the "Keuken LED" brightness track:

| offset from track centre | what a finger actually hits |
|---|---|
| −14 px | `div[button]` **"Keuken LED — meer info"** → opens the more-info dialog |
| −10 px | `div[button]` **"Keuken LED — meer info"** |
| −6 px | bare `div` — nothing happens |
| −3 px | `div[slider]` "Keuken LED" ✔ |
| 0 px | `div[slider]` "Keuken LED" ✔ |
| +3 px | bare `div` — nothing happens |
| +6 … +14 px | bare `div` — nothing happens |

The live hit band is about **5 px**. Three pixels low and the drag does nothing; ten pixels high and you get
a dialog instead. Typical thumb accuracy on a phone is ±8–10 px.

Measured track heights, live:

| card | element | measured |
|---|---|---|
| `fibbers-light-row` | brightness track (`ui.js:149`, `h-1.5`) | **463 × 5.25** and **407 × 5.25** |
| `fibbers-number` | value track (`ui.js:149`) | **406 × 5.25** |
| `fibbers-media` | volume track (`ui.js:149`) | **361 × 5.25** / **365 × 5.25** |
| `fibbers-remote` | volume track (`ui.js:149`) | **122 × 5.25** |
| `fibbers-light-group` | master track (`light-group.js:298`, `h-2.5`) | **473 × 8.75**, **1005 × 8.75** |

And the space is already there: consecutive `fibbers-light-row` sliders inside a group have a **44 px pitch**,
of which 5.25 px is the slider and ~18 px is the more-info row. Roughly 20 px per row is unclaimed.

**Fix — `src/ui.js`, `sliderTrack()` (line 149).** Keep the painted bar at 6 px; give the *pointer target*
44 px by wrapping the track in a transparent hit box rather than growing the visual:

```js
// the element carrying role="slider", tabindex and all pointer handlers becomes the wrapper
class="relative flex h-11 cursor-pointer touch-none items-center"
//   ... and the painted bar becomes a child:
<div class="pointer-events-none relative h-1.5 w-full rounded-[3px] bg-[#2C3639]"> ...fill/knob... </div>
```

`pctFromX(clientX, track)` must then measure the **wrapper** (same width, so the maths is unchanged) — verify
`e.currentTarget` is still the wrapper in `onDown`/`onMove`/`onUp`.

Do the same by hand for `light-group.js:296-313` (its slider is a hand-rolled copy of `sliderTrack`, not a
call to it) — `h-2.5` → an `h-11 flex items-center` wrapper around an `h-2.5` bar.

Then re-lay out the light row so the 44 px wrapper doesn't collide with the more-info row: the row grid is
`grid-rows-[auto_auto]` with `gap-y-2` (`light-row.js:163`). Drop `gap-y-2` to `gap-y-0` and let the slider's
own padding provide the separation, or move the value text onto the same line as the name and give the slider
the full second row. Either way the −10 px probe must stop returning "meer info".

**Acceptance:** re-run the probe script in §Acceptance below. Every slider must return `role="slider"` for
every offset in −18…+18, and no offset may return a `role="button"`.

---

### 2. `more-info` is dead inside every sheet

**[LIVE]** Tapping "Keuken LED — meer info" inside the `#alle-lampen` sheet does nothing at all — no dialog,
no console error, no focus change. Root cause, measured:

```
#fibbers-sheet parentNode        → body
<home-assistant>.contains(sheet) → false
hass-more-info dispatched from inside the sheet, observed on <home-assistant> → NOT RECEIVED
```

`body-sheet.js` renders the sheet into `document.body`, which is **outside** `<home-assistant>`. `moreInfo()`
(`util.js:43-51`) dispatches `hass-more-info` on the card, `composed: true` — so it escapes the shadow roots
correctly, bubbles up to `<body>`, and stops. HA listens on `<home-assistant>`, which is a *sibling*, never an
ancestor. Dispatching the identical event directly on `<home-assistant>` does open the dialog, confirming the
routing is the only thing wrong.

This kills the default tap action of everything a user is likely to put in a sheet: `fibbers-light-row` name
rows, `fibbers-stat` tiles, `fibbers-entities` rows, `fibbers-alert` findings, and any `tap_action:
more-info`. `navigate` and `call-service` actions are unaffected (they use `window` and `hass` respectively).

**Fix — `src/util.js:43`:**

```js
export function moreInfo(host, entityId) {
  if (!host || !entityId) return;
  // The sheet and nav layers render into document.body, outside <home-assistant>,
  // so a bubbling event from there never reaches HA's listener. Target it directly.
  const target = document.querySelector("home-assistant") || host;
  target.dispatchEvent(
    new CustomEvent("hass-more-info", {
      detail: { entityId },
      bubbles: true,
      composed: true,
    }),
  );
}
```

Audit `src/actions.js` for any other HA event fired from a card that could originate inside the sheet layer
and give it the same treatment.

---

### 3. An open sheet collapses Home Assistant's own dialogs to 0 × 0

**[LIVE]** With the sheet open and a `hass-more-info` event delivered to `<home-assistant>` (i.e. after
fixing §2), the dialog is created but unusable:

```
ha-more-info-dialog  → 0 × 0 at top 1196
ha-dialog            → 0 × 0 at top 1196
document.body        → position: fixed   (set by the sheet)
```

`lockScroll()` (`body-sheet.js:176-193`) sets `position: fixed` plus inline `top/left/right/width` on
`document.body`. HA's dialogs are children of `<home-assistant>` inside that fixed body and cannot lay out.
So §2 and §3 must be fixed together, or fixing §2 just trades a silent no-op for an invisible dialog.

Two further defects in the same mechanism:

- **It doesn't actually lock anything.** HA's scroll container is `#view` inside `hui-root`'s shadow root —
  the very element `view-reserve.js:28` already pads. `window.scrollY` is 0, so the save/restore is a no-op
  and the background still scrolls behind the sheet.
- **It fires on the next page.** `unregisterSheet` (`body-sheet.js:311`) calls `closeSheet()` synchronously
  from `disconnectedCallback`, but `finish()` is deferred 300 ms (`body-sheet.js:294`). Navigate away with a
  sheet open and 300 ms later `unlockScroll()` clears `document.body`'s inline `position/top/left/right/width`
  — wiping whatever HA or another card set there — and calls `window.scrollTo` on the new page.

**Fix:**
1. Lock the real scroller instead of `<body>`. `view-reserve.js` already injects into `hui-root`'s shadow
   root; reuse that path to add `#view { overflow: hidden !important; }` while a sheet is open, and drop
   `lockScroll`/`unlockScroll`'s mutation of `document.body` entirely.
2. Give `finish()` a cancellation token that `unregisterSheet` clears, so a deferred close cannot run after
   the card is gone.

### 3b. The focus trap will fight the dialog once §2 and §3 land

**[SRC]** `onFocusIn` (`body-sheet.js:43-47`) pulls focus back to the sheet panel on *any* `focusin` whose
`composedPath()` excludes `layer.host`. HA's more-info dialog is outside `layer.host`, so every focus attempt
inside it bounces back — the dialog can't be tabbed into or typed in. Add an escape:

```js
function onFocusIn(e) {
  if (layer.openId == null || !layer.host || !layer.panel) return;
  const path = e.composedPath();
  if (path.includes(layer.host)) return;
  // Don't fight HA's own dialogs, which render outside the sheet layer.
  if (path.some((n) => n.localName === "ha-dialog" ||
                       (n.getAttribute && n.getAttribute("role") === "dialog"))) return;
  layer.panel.focus();
}
```

Also note `window.addEventListener("focusin", …)` and the Escape `keydown` handler are registered at **module
import time** (`body-sheet.js:329-332`), so they run on every HA page including Settings and Developer Tools.
Both early-return cheaply, but register them lazily from the first `registerSheet` and remove them from the
last `unregisterSheet`.

---

### 4. The Apple TV Power button is dead

**[LIVE]** `hass.callService` intercepted on the live Apple TV remote card; pressing Power emits:

```json
remote.send_command  {"entity_id": "remote.living_room", "command": "turn_off"}
```

`turn_on`/`turn_off` are **not** pyatv `RemoteControl` commands — power lives on pyatv's separate power
interface, surfaced in HA as the entity services. Confirmed available on this instance:

```
hass.services.remote → ["turn_off","turn_on","toggle","send_command","learn_command","delete_command"]
hass.states["remote.living_room"].state → "on"
```

Every other Apple TV button verified correct in the same capture (`select`, `menu`, `home`, `volume_up`, and
transport correctly routed to `media_player.*`) — so 0.7.2's command-name fix works; Power is the one that
was missed because it doesn't go through the command map at all.

Second defect in the same function: `_power()` (`remote.js:232-241`) derives on/off **only** from the optional
`media_player`. With no `media_player:` configured, `mp` is `null` → `on` is falsy → Power can only ever send
`turn_on`, never off.

**Fix — `remote.js:33-35` and `remote.js:232-241`.** Remove `turn_on`/`turn_off` from the `appletv` command
map and route power through the real services, using the remote's own state:

```js
_power() {
  if (this._device() !== "appletv") return this._send("power");
  const st = this.hass && this.hass.states[this._config.entity];
  const on = st ? st.state === "on" : null;
  const svc = on === null ? "toggle" : on ? "turn_off" : "turn_on";
  this.hass
    .callService("remote", svc, { entity_id: this._config.entity })
    .catch((e) => this._flashFail("power", e));
}
```

---

### 5. The `backup_age` alert check can never fire

**[LIVE + SRC]** `alert.js:94-100`:

```js
const t = Date.parse(st.state);          // ← shadows the imported t() from ../i18n.js
if (!isNaN(t)) {
  const hours = (Date.now() - t) / 3.6e6;
  if (hours > max)
    out.push({ label: t(hl, "alert.backup"), … });   // TypeError: t is not a function
```

The block-scoped `const t` shadows the i18n `t` imported at `alert.js:7`, so the moment the check would
actually report something it throws — and `_findings()` wraps every check in `try/catch`
(`alert.js:145-149`, comment: *"a bad check never breaks the card"*), so the throw is swallowed silently.
It only throws on the stale path, which is why it looks fine while backups are healthy.

Proved live with a real `fibbers-alert` element built off the running `hass`, backup 7 h old,
`max_hours: 0.001` → the card rendered **"Alles in orde"**.

The live dashboard has exactly this check configured:
`{type: "backup_age", entity: "sensor.backup_last_successful_automatic_backup", max_hours: 36}`.
It would never have warned about a failed backup.

**Fix:** rename the local — `const ts = Date.parse(st.state)`. Then grep the whole repo for other locals
named `t`, `hl` or `html` shadowing an import, and add an ESLint `no-shadow` rule (with
`{"builtinGlobals": false}`) to `eslint.config.js` so `bun run check` catches the next one.

---

### 6. The weather forecast strip is permanently empty

**[LIVE]** `weather.js:88` reads `a.forecast`:

```js
const days = (a.forecast || []).slice(0, cfg.days || 5);
```

The `forecast` state attribute was deprecated in HA 2023.9 and **removed in 2024.4**. On the live instance:

```
weather.forecast_thuis attributes → temperature, dew_point, temperature_unit, humidity, cloud_coverage,
  uv_index, pressure, pressure_unit, wind_bearing, wind_speed, wind_speed_unit, visibility_unit,
  precipitation_unit, attribution
'forecast' in attributes → false
```

A `fibbers-weather` card built live with `days: 5` rendered only `"18° Half bewolkt Forecast Thuis"` — zero
day cells, no error, no empty state. The card has silently been half a card since before 0.2.0.

**Fix:** fetch the forecast properly, once per entity, and cache it on the element:

```js
// on first hass with an entity, and again when the entity changes
const res = await this.hass.callWS({
  type: "weather/subscribe_forecast",
  entity_id: this._config.entity,
  forecast_type: "daily",
});
// …or the one-shot form, which is simpler and enough for a 5-day strip:
const r = await this.hass.callService(
  "weather", "get_forecasts", { type: "daily" },
  { entity_id: this._config.entity }, true,
);
this._forecast = (r.response[this._config.entity] || {}).forecast || [];
```

Prefer `weather/subscribe_forecast` (it pushes updates and is what HA's own card uses); unsubscribe in
`disconnectedCallback` and resubscribe on entity change. Render `"—"` with the current conditions only when
the fetch genuinely returns nothing, so the failure is visible instead of invisible.

---

## P1 — Visible defects

### 7. Touch targets: 23–37 controls per view are under 44 × 44

**[LIVE]** Every interactive element inside a Fibbers card, measured per view:

| view | interactive | under 44 px |
|---|---|---|
| `/licht` | 46 | **28** |
| `/huis` | 34 | **23** |
| `/muziek` | 22 | **17** |
| `/tv` | 44 | **29** |
| `/wekker` | 44 | **37** |

The offenders, with the class that causes them:

| control | file | class | measured |
|---|---|---|---|
| chips (`fibbers-chips`, source chips, `overflowChips`) | `chips.js:63`, `ui.js:224` | `px-2.5 py-[5px] text-[10.5px]` | **27 px tall** |
| `fibbers-select` option chips, scheduler day chips | `select.js:163`, `scheduler.js:131` | `px-2.5 py-1 text-[10.5px]` | **24 px tall** |
| `fibbers-light-row` icon button | `light-row.js:171` | `h-7 w-7` | **25 × 25** |
| `fibbers-light-group` expand chevron | `light-group.js:279` | `h-7 w-7` | **25 × 25** |
| `fibbers-light-row` name / more-info row | `light-row.js:199` | no padding | **18 px tall** |
| `fibbers-alert` finding row | `alert.js:190` | `text-[11.5px] leading-[1.42]` | **16 px tall** |
| toggle pill (`fibbers-toggle`, `fibbers-scheduler`) | `ui.js:277` | `h-5 w-9` | **20 × 36** |
| `fibbers-remote` mute | `remote.js:520` | `h-9 w-9` | **32 × 32** |
| `fibbers-media` prev / next (and *both* controls in `compact`) | `media.js:243` | `h-9 w-9` | **32 × 32** |
| `fibbers-remote` power | `remote.js:639` | `h-9 w-9` | **39 × 39** |
| `fibbers-remote` transport / nav / volume / channel | `remote.js:333` | `h-12 w-12` | **42 × 42** |
| `fibbers-number` ± steppers | `number.js:257` | `h-8 w-8` | **32 × 32** |
| `fibbers-climate` ± | `climate.js:125,147` | `h-10 w-10` | **40 × 40** |
| `body-sheet` close | `body-sheet.js:224` | `h-[30px] w-[30px]` | **30 × 30** |

**Fix — one shared rule, not 14 ad-hoc bumps.** Keep every visual size exactly as it is and add a transparent
hit expander. Define it once in `tw.js`'s `BASE_CSS`:

```css
.fib-hit { position: relative; }
.fib-hit::after {
  content: ""; position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  min-width: 44px; min-height: 44px; width: 100%; height: 100%;
}
```

then add `fib-hit` to each control above. For the chip rows also raise the flex `gap` to ≥ 8 px so the
expanded hit boxes of adjacent chips don't overlap (they currently sit on `gap-2`/`gap-2.5`, which is fine
at 8–10 px). The 42 px remote buttons only need `h-11 w-11`.

Add a regression guard to `bun run check`: a small script that renders each card into jsdom, or simpler, a
documented manual probe (§Acceptance) run once per release.

### 8. Sparklines show "Geen historie" for the first 20–30 s, then never refresh

**[LIVE]** On `/dashboard-main/systeem`, screenshotted at t≈6 s and again at t≈25 s after load: all three
`fibbers-graph` cards and all three `fibbers-sysmon` sparklines read **"Geen historie"**, with
`_series.length === 0` and `_fetchedFor === null`. The same WS query issued by hand at that moment returns
**2568 rows**. By t≈60 s they are populated (`series: 62 / 4199 / 2567`).

Two separate bugs:

- **Cold start.** `_maybeFetch` (`graph.js:71-90`, `sysmon.js:52-75`) fires once on the first `hass`, and if
  that attempt yields nothing it only retries on the *next* `hass` change **and** after an 8 s backoff
  (`graph.js:77`). System-monitor sensors update every 15–60 s, so the retry lands 20–60 s later. Meanwhile
  the card renders its terminal empty state, which reads as "this is broken", not "this is loading".
- **Never refreshes.** Once one fetch succeeds, `_fetchedFor === id` short-circuits forever
  (`graph.js:73`); nothing resets it except `setConfig`, and there is no timer. On a wall tablet the header
  value keeps ticking while the "last 24 hours" curve underneath is the 24 hours that ended at page load,
  days ago, with nothing on screen saying so.

**Fix:**
```js
// 1. distinguish "not loaded yet" from "no history": render a skeleton, not "Geen historie",
//    until at least one attempt has settled.
this._settled = false;   // set true in the finally of _maybeFetch

// 2. fast retry on a cold miss, slow backoff only after a real empty result
const backoff = this._series ? 8000 : Math.min(500 * 2 ** this._misses, 8000);

// 3. expire the cache
const maxAge = Math.max(60e3, ((this._config.hours || 24) * 3600e3) / 20);
if (this._fetchedFor === id && Date.now() - this._fetchedAt < maxAge) return;
```
Apply the identical change to `sysmon.js`.

**Also fix the fetch race** (`graph.js:71-90`, **[SRC]**): `setConfig` resets `_fetchedFor`/`_lastTry` while a
fetch may still be in flight, and nothing invalidates the old promise — in the card editor (`setConfig` per
keystroke) the last response to *resolve* wins, so the wrong entity's curve can be displayed for up to 8 s.
Bump a generation counter in `setConfig`, capture it before the `await`, discard the result if it changed.

### 9. `fibbers-nav` and `fibbers-sheet` each leave a 56 px empty grid row

**[LIVE]** Both cards render nothing (`fibbers-nav` portals into `document.body`; `fibbers-sheet` is
deliberately invisible and just registers a hash route) yet both report grid options, so HA reserves a cell:

```
fibbers-nav   → host height 0, but its <hui-card> measures 56 px
fibbers-sheet → shadow root renders nothing, but its <hui-card> measures 56 × 500
```

Proved the cost and the fix in one step: setting `display: none` on the `hui-card` wrapper collapsed each
containing `hui-section` from **56 px → 0 px**. On `/huis` that is 4 sheets + 1 nav = **5 wasted rows**;
every view pays at least one for its nav card.

**Fix — in both cards, collapse the host cell (guarded for the picker, and reverted on disconnect):**

```js
connectedCallback() {
  super.connectedCallback();
  if (this.preview) return;
  const cell = this.getRootNode().host;          // <hui-card>
  if (cell) { this._cell = cell; cell.style.display = "none"; }
  …
}
disconnectedCallback() {
  super.disconnectedCallback();
  if (this._cell) { this._cell.style.display = ""; this._cell = null; }
  …
}
```

A `display: none` grid item is removed from grid layout entirely, so the row disappears rather than
collapsing to a zero-height gap. Keep `getGridOptions()` as-is for the card picker; `rows: 0` is not a legal
value and HA clamps it to 1.

### 10. The media card prints the player's own name as the track title

**[LIVE]** Measured on `/muziek`:

| entity | state | rendered |
|---|---|---|
| `media_player.43pus7608_12` | `on` | **"PHILIPHS TV"** as the title, empty subtitle |
| `media_player.living_room` | `playing` | **"Living Room"** as the title, "Netflix" as the artist |
| `media_player.eetkamer` | `idle` | "Woonkamer / Niets aan het spelen" ✔ |

Two causes:

- `_idle()` (`media.js:112-115`) lists `off, idle, standby, unavailable` — it omits **`on`** (a TV that is
  powered on but playing nothing) and **`unknown`** (reported on integration reload, and by Kodi/Plex before
  the first poll). Both fall through to the "playing something" branch.
- The title chain (`media.js:301-306`) is `media_title || friendly_name || cfg.name` — so a player with no
  `media_title` shows its own name. `friendly_name` is present on every registered entity, which also makes
  `cfg.name` unreachable dead code.

**Fix:**
```js
const IDLE = ["off", "idle", "standby", "unavailable", "unknown", "on"];
// "on" belongs here: a media_player that is on but not playing has nothing to show.
// If a TV in `on` should still show its app, let `source`/`app_name` carry it via the title chain below.

const title = idle ? t(hl, "media.idle")
  : a.media_title || a.app_name || a.source || cfg.name || a.friendly_name;
```
`a.media_image_url` (`media.js:308`) is also dead — it is a Python property, never a state attribute. Drop it
or use `entity_picture_local`.

### 11. A cancelled drag still writes the abandoned value

**[SRC]** `light-group.js:311` and `number.js:245-247` clear `_dragging` on `pointercancel` but do **not**
cancel the pending trailing debounce — while their own `_up` handlers do (`light-group.js:191`,
`number.js:156`), which is proof of intent. Both call the debounced setter from `_down` **and** every
`_move`, so at cancel time there is normally a call in flight.

Trigger: start a touch drag on the track, then have the gesture stolen (browser back-swipe, an incoming call,
the pointer entering another capturing element). `pointercancel` reverts the display, then up to 150 ms later
`light.turn_on` / `set_value` fires with the value the user just cancelled — and `hold()` pins that wrong
number on screen for 2 s.

```js
// light-group.js
@pointercancel=${() => { this._dragging = false; this._debouncedCommit.cancel(); }}
@lostpointercapture=${() => { this._dragging = false; this._debouncedCommit.cancel(); }}
// number.js
onCancel: () => { this._dragging = false; this._debouncedSet.cancel(); },
```

The `lostpointercapture` handler is a second, separate fix: `light-group`'s slider is a hand-rolled copy of
`sliderTrack` and is the only slider in the repo missing it (`ui.js:163` has it). `_down` takes pointer
capture (`light-group.js:178`); if capture is lost without `pointerup`/`pointercancel` reaching the element,
`_dragging` stays `true` forever, `SliderHold.value()` returns `dragValue` on every render, and the master
slider is frozen at the last drag position with a lying `aria-valuenow`.

Neither card has a `disconnectedCallback`, so also cancel both debouncers there — otherwise navigating away
within 150 ms of the last move fires a real service call from a detached element.

### 12. `SliderHold` keeps its pending value forever after a disconnect

**[SRC]** `ui.js:74-77`:

```js
hostDisconnected() {
  clearTimeout(this._timer);
}
```

The 2 s timeout is the *only* thing that clears a value which never lands. Disconnecting kills the timer and
leaves `_pending` set, and there is no `hostConnected` to re-arm it — so `value()` keeps returning the stale
value indefinitely.

Reproducible with no exotic setup: `light-group` caches member rows (`light-group.js:215-225`) and renders
them only while expanded (`light-group.js:329`). Drag a member row to 70 %, collapse the group within 2 s →
the row leaves the DOM, `_pending = 70` survives. Expand again and the row shows 70 % while the bulb is at
9 %. Same via a view switch or closing a sheet within 2 s of releasing.

```js
hostDisconnected() {
  clearTimeout(this._timer);
  this._timer = null;
  this._pending = null;
}
```

While in this file, add the `clear()` method the cards need for §13 and wire the commit's promise to it:

```js
clear() { clearTimeout(this._timer); this._timer = null; this._pending = null; this.host.requestUpdate(); }
```

### 13. A failed service call holds a wrong value on screen for the full 2 s

**[SRC]** `light-row.js:124-134`, `light-group.js:162-173`, `number.js:132-136`, `media.js:167-194`,
`remote.js:243-250` all discard the promise from `hass.callService`. Nothing clears the hold when the call is
*rejected*, so a bulb that is unreachable, a `media_player` that refuses `media_seek`, or a rejected
`remote.send_command` all leave the un-applied value on screen for 2000 ms — and each rejection becomes an
`unhandledrejection` in the console. `remote.js`'s `_send` already awaits and catches; nothing else does.

```js
const p = pct <= 0
  ? this.hass.callService("light", "turn_off", { entity_id })
  : this.hass.callService("light", "turn_on", { entity_id, brightness_pct: pct });
Promise.resolve(p).catch(() => this._hold.clear());
```

Two related cases in `light-row.js`:
- **On/off-only lights.** `_pctFromHass()` (`light-row.js:75-80`) returns **100** when `brightness` is null.
  Drag an `onoff`-only light to 30 % → 30 % for 2 s → jumps to 100 %. Don't `hold()` a value the light cannot
  represent: skip the hold when `supported_color_modes` is `["onoff"]`, and render the slider as a toggle.
- **Slow devices.** A Z-Wave dimmer reporting after ~3 s means the 2 s timeout is *shorter* than the round
  trip it exists to cover: held 2 s → snaps back → jumps forward again. Once the promise drives the clear
  (above), raise `timeout` to ~5 s as a pure backstop.

### 14. Remote: a dangling divider, a duplicated button, and no awareness of its own entity

**[LIVE, visible on `/tv`]** The Philips remote's transport row renders a 1 × 32 px divider
(`remote.js:474`) unconditionally, while the buttons either side of it are conditional — `philips` has no
`menu`/`previous`/`next` in its map, so with `flex-wrap` the divider ends up as a floating line at the end of
the row. The volume row two lines below guards its own divider correctly
(`remote.js:593-597`, `hasVolCmd && hasChannel`) — copy that guard.

**[LIVE]** On Apple TV, **Back and Menu both send `menu`** (`remote.js` `appletv` map: `back: "menu"`).
The alias is deliberate — Apple TV has no distinct back key — but rendering two identical buttons is not.
Render one.

**[SRC]** `this.hass.states[this._config.entity]` appears **nowhere** in `remote.js`; all state comes from
the optional `media_player`. Consequences: a typo'd or removed `entity:` renders a complete, normal-looking
remote whose every press is swallowed into a `console.warn` and a 500 ms opacity flash; an `unavailable`
remote is indistinguishable from a working one; and with no `media_player:` the header on/off dot is always
off even when the TV is on. Every other card in the library routes through `isUnavail` from `util.js:80` —
`remote.js` and `media.js` are the only two that never import it. Add `_st()`/`_unavail()` in the
`light-row.js` style, dim the card, and short-circuit `_send`/`_hold` when the remote is unavailable.

**[SRC]** Also in `remote.js`: `setConfig` (`remote.js:149-153`) resets four fields but **not**
`_platformTried` / `_platform` / `_warned`. HA re-uses card elements and calls `setConfig` per keystroke in
the editor, so changing `entity:` from an `apple_tv` remote to a `philips_js` one leaves `_platform ===
"apple_tv"`: every button then sends pyatv names to a Philips TV, which rejects all of them, while the card
looks perfectly configured. Reset all three.

---

## P2 — Plugin quality. None of this is visible to you; all of it is visible to strangers installing from HACS.

### 15. The shipped bundle is the **development** build of Lit, unminified

**[LIVE]** Every HA page with Fibbers installed logs:

```
Lit is in dev mode. Not recommended for production!
Multiple versions of Lit loaded.
```

`grep -c "dev mode" dist/fibbers.js` → **3**. The `build` script has no `--minify` and sets no production
condition, so `lit` resolves to its dev export with all its runtime checks. Measured rebuilds:

| build | size |
|---|---|
| current (`bun build … --format=iife --target=browser`) | **2,278,718 B** |
| `+ --minify --define process.env.NODE_ENV='"production"' --conditions=production` | **2,140,709 B** (dev-mode string gone) |
| the same, with `ICONS = {}` stubbed | **186,684 B** |

So **1.95 MB of the 2.14 MB — 91% — is `src/icons.gen.js`**, which ships the *entire* Solar Bold Duotone set:
**2650 entries / 1325 icons**, of which the card code references **51**. It is imported unconditionally at
`index.js:6`, so as a HACS `plugin` resource it is fetched, parsed and allocated on **every dashboard load**,
Fibbers cards present or not.

A hard subset is not an option — this dashboard's YAML names **56** distinct icons, many outside the 51
(`chef-hat`, `bed`, `running-2`, `soundwave`, `book-2`, `thermometer`, `battery-half`, `heart`,
`clapperboard-play`, `waterdrops`, `sunset`, `stars`, `leaf`, `vinyl-record`, `confetti`). So:

**Fix:**
1. Add `--minify --conditions=production --define process.env.NODE_ENV='"production"'` to `build` and `watch`.
2. Split the icon set: generate `src/icons.core.gen.js` from the names the source actually uses (a script can
   grep them, so it can't drift) and keep the full set in `src/icons.full.gen.js`, loaded by a **dynamic
   `import()`** from `FibIcon._render()` the first time a name misses the core map. `icon.js:44-55` already
   has a placeholder path for a miss — make it await the chunk and re-render. Eager payload drops from
   2.28 MB to roughly **190 KB**.
3. Because `bun build --format=iife` emits a single file, the lazy chunk needs `--splitting` with
   `--format=esm`, or the full set served as a separate HACS-shipped file fetched with `fetch()` +
   `JSON.parse` — the latter is simpler and keeps the IIFE. Either way `hacs.json`'s `filename` must keep
   pointing at the entry file.

### 16. `media.js` never reads `supported_features`

**[SRC]** `grep -rn "supported_features" src/` returns **nothing** for the whole repo. `remote.js` hides
buttons a platform doesn't support; `media.js` gates every control on the mere *presence* of an attribute, or
on nothing at all. Consequences for other people's setups:

- The seek bar is gated on `media_duration`, not `MediaPlayerEntityFeature.SEEK` (4096) — a Chromecast-hosted
  app or Plex client that reports position but not seek draws a full bar whose every drag is rejected
  server-side, with no `.catch()` (§13), so the user gets a red toast.
- `_vol()` coerces a missing `volume_level` to `0`, so a TV exposing only `VOLUME_STEP` (1024) renders a
  slider pinned at 0 % that cannot work. There is also no mute button even for players that do support
  `VOLUME_MUTE` (8).
- Prev / play-pause / next render regardless of `PREVIOUS_TRACK` (16), `NEXT_TRACK` (32), `PLAY` (16384),
  `PAUSE` (1); source chips regardless of `SELECT_SOURCE` (2048); join/unjoin regardless of `GROUPING`
  (524288).

*This does not currently bite on this instance* — all three of its players report `VOLUME_SET`, and none
expose `media_position`, so no seek bar is drawn. It will bite the first stranger with a Chromecast.

```js
const F = { PAUSE:1, VOLUME_SET:4, VOLUME_MUTE:8, PREVIOUS:16, NEXT:32,
            SELECT_SOURCE:2048, SEEK:4096, PLAY:16384, GROUPING:524288 };
_supports(bit) {
  const st = this._st();
  return !!(st && (Number(st.attributes.supported_features) || 0) & bit);
}
```
Gate each block, and pass `disabled: !this._supports(...)` into `sliderTrack` — the helper already supports
`disabled` and `light-row.js:213` uses it; `media.js` and `remote.js` are the only callers that never do.

### 17. Assorted correctness

| # | file:line | defect | fix |
|---|---|---|---|
| a | `entities.js:123` | `localeCompare(…, "nl")` — every user gets Dutch collation, contradicting the README's "reads in your language" | `langOf(this._config.language \|\| this.hass)` (already exported from `i18n.js`) |
| b | `scheduler.js:94-98, 137-142` | hardcodes `input_boolean.toggle` for `enable:` / day `entity:`, which `setConfig` never constrains to that domain — a `switch.*` or `automation.*` silently fails | `homeassistant.toggle`, as `actions.js:170` already does |
| c | `scheduler.js:13`, `datetime.js:12` | `hhmm = (s) => (typeof s === "string" ? s.slice(0,5) : "")` guards non-strings but not bad strings, so an `unavailable` time entity renders the literal **`unava`** / **`unkno`** at `text-[30px]` | tighten to `/^\d{2}:\d{2}/.test(s \|\| "") ? s.slice(0,5) : ""` — the existing `\|\| "—"` then takes over |
| d | `climate.js:90-118` | no unavailable path: an offline thermostat renders at full opacity, reports "On", and keeps both setpoint buttons and every mode chip clickable | `isUnavail` early return + `opacity-50`, like every other card |
| e | `climate.js:67-83` | in `heat_cool`, `temperature` is null so both ± buttons are dead no-ops with no visual cue; and `Math.round(v*10)/10` walks a `target_temp_step: 0.25` setpoint off-step (20 → 20.3 → 20.6) | disable the buttons in `heat_cool` (or drive `target_temp_low/high`); snap to the step |
| f | `number.js:132`, `select.js:91` | service domain is derived from the entity id with no validation — configure a `sensor.*` and the card emits `sensor.set_value` on every drag | validate in `setConfig`, and set the editor selector's `domain` list |
| g | `graph.js:61` | literal `data:` is not filtered for finiteness (unlike `fetchHistory`, `util.js:133`), so `data: [1,"n/a",3]` makes `Math.min(...)` `NaN`, the SVG blank, and the stat labels read "min NaN" | `.map(Number).filter(Number.isFinite)` |
| h | `backup.js:14,73` | an unparseable timestamp returns the sentinel `hours: 0`, indistinguishable from "0 hours ago", so a broken backup entity reports **"Succeeded"** and is never stale | return `hours: NaN` / a `bad` flag and treat it as a warning |
| i | `stat.js:138-141` | `<ha-relative-time>` is an undocumented HA-internal element with no fallback; if it isn't defined when the card renders, the tile's **primary value is blank** (`value` is never assigned on that branch) | compute a formatted string as `value` too and render it as the element's fallback content |
| j | `presence.js:100`, `media.js:316,492` | `entity_picture` / `f.thumbnail` interpolated into a `style` attribute's `url("…")` unescaped — a `"` in an integration-supplied URL terminates the declaration and garbles the card | `styleMap` + `encodeURI`, or quote with `JSON.stringify` |
| k | `util.js:111-114` | `clamp` propagates `NaN`, so an interacted-with track with `r.width === 0` yields `brightness_pct: NaN` (serialised as `null`, rejected by HA) | `return Number.isFinite(p) ? clamp(p,0,100) : 0;` |
| l | `remote.js:75-80` | `PLATFORM_DEVICE` is missing **`androidtv_remote`** — the integration that actually uses the `DPAD_*`/`MEDIA_*` keycodes in the `androidtv` map. Stock Android TV users fall through to `generic` (empty map): the transport and volume rows render empty and the d-pad renders but is inert. `android_tv` (underscore) is not an HA domain at all — dead key | map `androidtv_remote` → `androidtv`, drop `android_tv` |
| m | `remote.js:381-446` | `arrow` and OK render even when the platform has no directional commands, contradicting the file's own contract (`_holdBtn` and `nav` both return `""`) — a 260 px d-pad of silent no-ops | gate each on `_cmd(key)`; drop the container when nothing survives |
| n | `remote.js:333-342` | every press-and-hold button (volume ±, channel ±) wires **only** pointer events, so Enter/Space on a focused Volume up does nothing | add `@click=${(e) => { if (e.detail === 0) this._send(key); }}` (detail 0 = keyboard activation, so touch holds don't double-fire) |
| o | `remote.js:397-405` | with `dpad: swipe` the arrows are suppressed and the container is a non-focusable `role="group"`, so there is **no** keyboard path to up/down/left/right/ok — while the `aria-label` still says "tap the arrows" | `tabindex="0"` + a `@keydown` mapping the arrows and Enter/Space; make the label mode-accurate |
| p | `remote.js:153`, `media.js:79-80` | a new `SliderHold` is constructed on every `setConfig`, and `SliderHold`'s constructor calls `host.addController(this)` (`ui.js:38`) with no matching `removeController` — a minute in the editor leaves dozens of orphaned controllers, each with a live `hostDisconnected` and possibly a pending timer | `this._volHold ||= new SliderHold(…)` and reset its state, or add a `dispose()` |
| q | `body-layer.js:267-286` | `enableAutoHide()` adds an **anonymous capturing `document` scroll listener** and sets `autoHideBound = true` permanently; `detach()` (`body-layer.js:305-323`) never removes it or resets the flag, so once any dashboard used `auto_hide: true` it runs for every scroll of every scrollable element in the whole HA app for the life of the page. *(Not active on this instance — the nav config has no `auto_hide`.)* | hold the handler in module state, remove it in `detach()`, reset the flag |
| r | `body-layer.js:153-157, 325-326` | not removed in `detach()`: an anonymous `ResizeObserver` (leaked again on every bar rebuild, `body-layer.js:292`), `orientationchange`, two `resize` handlers, `hashchange`, and the `nav.listeners` entry | store and remove them all symmetrically, as `sidebarRO`/`drawerMO` already are |
| s | `hide-tabs.js:38`, `theme.js:103`, `view-reserve.js:23` | each of the three registers `location-changed` + `popstate` at import time and routes its inactive case through `removeStyle()` → `deepFind("hui-root")`, a full document + shadow-DOM walk. On Settings or Developer Tools with every feature off, that's 3 walks per navigation and 3 more per popstate | track `state.styleEl` and return immediately when inactive, or register the listeners lazily from `setViewReserve`/`setTabHiding`/`applyTheme` |
| t | `theme.js:31-62` | ~10 of the 42 theme vars are injected into `hui-root`'s shadow root but target elements *outside* it — `--sidebar-*`, `--mdc-dialog-*`, `--ha-dialog-*`, `--more-info-header-background`, `--dialog-backdrop-filter`. `theme: fibbers-light` on a dark HA turns the dashboard light and leaves every more-info dialog dark | drop the unreachable keys, or inject that subset at the `<home-assistant>` host with matching teardown |
| u | `media.js:85-89` | `updated()` dereferences `this._config` with no guard while `render()` has one (`media.js:295`) — a `TypeError` inside Lit's update cycle whenever `hass` is set before `setConfig` (card-picker preview, some view strategies). `remote.js:171-181` has the same shape but survives inside its `try`, silently burning the one-shot `_platformTried` flag so the platform is never resolved | `if (!this._config) return;` |
| v | `media.js:217-231` | `_seeking`/`_dragging` are only cleared by listeners **on the track element**, but `_seekBar()` returns `""` and destroys it the moment the player goes `unavailable` or the track ends — so a drag interrupted that way leaves `_seeking === true` forever and the bar permanently pinned to the stale drag position | `if (!p \|\| !p.dur) { this._seeking = false; return ""; }` |
| w | `media.js:262-266` | the seek hold "lands" when the entity value comes within `tolerance` (2) of the pending value — but the seek position *advances on its own* once a second, so it walks into the window without HA ever applying the seek. Seek forward 3 s from 100 → the bar shows 103, then a second later renders 101 and drops the hold | key the hold off a change in `media_position_updated_at`, not value proximity |
| x | `media.js:269-284, 383-399` | `sliderTrack`'s keyboard handler calls `onInput` synchronously per keystroke, and both callbacks commit immediately — holding an arrow key emits ~30 `media_seek`/`volume_set` calls per second. `light-group` and `number` both debounce for exactly this reason; `media.js` and `remote.js` don't import `debounce` | route `onInput` through a 150 ms debounce created once in `setConfig`, keeping `hold()` immediate |
| y | `light-group.js:196-204` | `_onKey` steps from the raw entity value, ignoring `this._hold` — so a second arrow press before the bulbs report re-sends the *same* value and the slider never climbs; auto-repeat emits ~30 identical calls/s and moves the group one step. `light-row` and `number` get this right by stepping from the display value | `const cur = this._dragging ? this._dragPct : this._hold.value(s.pct, { gone: s.allOff })` |
| z | `light-group.js:75,131-142` | the master's ±2 tolerance compares a *command* against the **mean brightness of on-members**, and a member with no `brightness` contributes a hard 100. One dimmer + one on/off bulb, commit 70 % → mean 85 % → the master shows 70 % for 2 s then jumps to 85 %, every single time. *(All six members on this instance are dimmable, so it doesn't bite here.)* | exclude brightness-less members from the average; compare against the max deviation of dimmable members |
| aa | `light-group.js:180`, `number.js:150` | `_down` schedules a commit at the touch-down position with no drag threshold, so dwelling 150 ms before moving flashes the whole room to the touched value; and a stuttering drag (moves ≥ 150 ms apart, typical of a finger creeping across a 5 px track) emits up to **≈ 6.7 service calls/s** | add a ~4 px movement threshold before the first commit; leading-edge-suppressed debounce |
| bb | `body-layer.js:148,216-221` | `role="tablist"` / `role="tab"` / `aria-selected` on controls that navigate to a different URL and tear the view down, with no `tabpanel` and no `aria-controls` anywhere — and `aria-current="page"` on the same element contradicts `role="tab"` | keep the `role="navigation"` host, drop the tab roles and the roving tabindex, keep `aria-current="page"` on plain buttons |
| cc | `remote.js:606-613` | `on` treats `unknown` as on while `_power()` treats it as off; `"On"`/`"Off"` are untranslated literals in a card that routes everything else through `t()`. Every `aria-label` in the file is hardcoded English, which is what a Dutch screen-reader user hears | one shared `OFF_STATES`; add `remote.on`/`remote.off` and the labels to `src/translations/*.json` |
| dd | `remote.js:268-286` | an explicit `sources:` list with no `media_player:` renders chips whose every tap is silently discarded (`_mpService` no-ops); and `_favSources` synthesises entries for favourites not in `source_list`, so `collapsed.length` can exceed `all.length` and `overflowChips`' `hasMore` goes false — the remaining sources become permanently unreachable | throw in `setConfig` when `sources`/`favourites` are set without `media_player`; compute `hasMore` by set membership |
| ee | `remote.js:224-228` | `_flashTimer` is the one timer in the file with no teardown — a rejected command within 500 ms of a view switch sets a reactive property on a detached element | `clearTimeout(this._flashTimer)` in `disconnectedCallback` |
| ff | `remote.js:470-483` | *(see §14 — the transport divider)* | |
| gg | `entities.js:106-127` | `_matched()` scans `Object.values(hass.states)` and `localeCompare`-sorts on **every** `hass` update, with no `shouldUpdate` — a full O(n log n) collation sort per state change, several times a second on a 1000-entity instance | `shouldUpdate` comparing the matched set; cache the sorted result |
| hh | `entities.js:148-149` | the secondary line bypasses `fmtState`/`fmtNum`, so it renders the raw slug **`unavailable`** — and `unavailable °C` when the entity has a unit. The card's own `getStubConfig` filters for exactly those states, so the *default* config shows it | mirror `sysmon.js:77-85` |
| ii | `hacs.json:4` | `"homeassistant": "2024.11.0"`, but `hide-tabs.js:11` targets `ha-tab-group` and `view-reserve.js:28` targets `#view`, neither of which existed then — `hide_ha_tabs` silently no-ops on the declared minimum while the README says "verified on 2026.8.x" | raise it to the oldest release actually tested, or feature-detect the tab element |
| jj | — | the `hacs/default` PR is still unfiled and the repo still carries the wrong `hacs-integration` topic | file the PR; the topic should be `hacs-plugin`/`lovelace-card` |

### 18. Optional polish: HA's tab strip flashes on first paint

**[LIVE, one screenshot]** During load, HA's own `ha-tab-group` is briefly visible before `hide-tabs.js`
injects its style — the style can only be applied after the HACS resource loads, the module imports, and a
`fibbers-nav` card mounts and calls `setTabHiding`. Final state is correct (`ha-tab-group` →
`display: none`, 0 × 0, `fibbers-hide-tabs` style present), so this is a flash, not a failure. If it annoys
you: have `setTabHiding` persist the current `location.pathname` in `localStorage` the first time it runs, and
inject the style at module import when the path matches, before any card mounts.

---

## Explicitly checked and **not** a problem

Recorded so nobody spends 0.7.3 chasing these:

- **`number.js` snaps to `step` before committing** (`_snap`, `number.js:115-119`, called from `_valFromX`).
  The step-rounding snap-back that would otherwise hit `wake_fade_minutes` (step 5), `wake_brightness`
  (step 10) and `keuken_*` does **not** occur. `number`'s fixed `tolerance: 0.5` is only wrong for entities
  whose whole range is ≤ 1 (the hold clears instantly, so the snap-back returns) or for ranges in the
  thousands with device-side rounding. Every `input_number`/`number` on this instance spans ≥ 20 with an
  integer step, so it is correct here. Make the tolerance step-relative anyway
  (`Math.max(step/2, (max-min)/1000)`), but it is a P2, not a P0.
- **0.7.2's optimistic hold works.** Re-verified: `light.kitchen` dragged to 80 %, `aria-valuenow` sampled at
  30 / 120 / 250 / 500 / 900 ms — held at `80` every time, settled 80, entity 80, no snap-back.
  `pointercancel` aborts without committing (display 40 during the drag, brightness unchanged at 80).
- **`global-css.js` is not applied.** `index.js:231` only exposes `injectGlobalCss` on `window.FIBBERS`; the
  42-variable `!important` `html {}` payload is opt-in and `window.FIBBERS_DISABLE_GLOBAL_CSS` is still
  honoured. Installing Fibbers does **not** repaint Settings, Developer Tools, the sidebar, or other cards.
- **`hide-tabs`, `theme` and `view-reserve` all tear down symmetrically** (`removeTabHiding`, `removeTheme`,
  `removeViewReserve`, all called from `detach()`), including their `MutationObserver`s and `theme.js`'s
  `matchMedia` listener. A non-Fibbers dashboard does not inherit hidden tabs. `view-reserve` is working
  live: `#view` padding-bottom **74 px** against a **62 px** nav bar (12 px clearance from `extra_bottom`).
- **`fetchHistory` is correct** — `history/history_during_period` with `start_time`/`end_time`/`entity_ids`/
  `minimal_response`/`no_attributes`, reading `r.s` with an `r.state` fallback. Verified by hand against the
  live WS API: 2568 rows. §8 is about *when* it is called, not how.
- **No horizontal overflow** anywhere: zero elements with `scrollWidth > clientWidth`, zero cards whose inner
  content escapes their box.
- **No missing entities.** All 95 entity references in the dashboard config resolve. The only non-nominal
  states are `light.hue_go_1` / `light.hue_lightstrip_plus_1` / `light.slaapkamer_lampen` = `unavailable`
  (lights physically off — the "Slaapkamer Offline" card and the two alert findings are correct behaviour)
  and the scenes at `unknown` (normal; a scene's state is its last-activated timestamp).
- **`fibbers-sheet` rendering nothing is by design** — it registers a hash-routed sheet and is
  `display: none`. Only its reserved grid cell is a bug (§9).
- **The Apple TV command map is right** apart from power: `select`, `menu`, `home`, `volume_up` and the
  `media_player`-routed transport were all captured correct on the live card.
- **Screenshots showing a blank view or a visible tab strip mid-session were browser artifacts** of a
  window/zoom mismatch I created (viewport 2149 × 1196 CSS px against a 1459 × 812 capture frame), not
  rendering failures. Confirmed by measuring the sections directly: real geometry, correct content.
- **`fibbers-climate` is untested end-to-end** — there is no `climate.*` entity on this instance. §17d/§17e
  are source-verified only.
- **Speaker grouping is unverifiable here** — only `media_player.eetkamer` reports `GROUPING`.

---

## Acceptance tests

Run each of these against the live instance after the change. Screenshots are not enough for 1–4.

**1. Slider hit area (§1).** Paste in the console on `/dashboard-main/licht`:

```js
function deepAll(s){const o=[],st=[document.documentElement];while(st.length){const n=st.pop();if(!n)continue;
 if(n.matches&&n.matches(s))o.push(n);if(n.shadowRoot)st.push(...n.shadowRoot.children);if(n.children)st.push(...n.children)}return o}
function hit(x,y){let e=document.elementFromPoint(x,y),p=null,g=0;
 while(e&&e!==p&&g++<12){p=e;if(e.shadowRoot){const i=e.shadowRoot.elementFromPoint(x,y);if(i&&i!==e)e=i;else break}else break}return e}
deepAll('[role=slider]').forEach(t=>{const r=t.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 const row=[-18,-12,-6,0,6,12,18].map(dy=>{const e=hit(cx,cy+dy);return dy+':'+(e&&e.getAttribute('role')||'none')});
 console.log(t.getAttribute('aria-label'), Math.round(r.height*100)/100+'px', row.join(' '))});
```
**Pass:** every offset reports `slider`; no offset reports `button`; every track ≥ 44 px tall.

**2. more-info from inside a sheet (§2, §3).** Open a sheet via its hash (`location.hash = '#alle-lampen'`),
tap a light-row name. **Pass:** the HA more-info dialog opens, is visible at a non-zero size, can be tabbed
into and typed in, and closes back to the still-open sheet. Then check
`getComputedStyle(document.body).position === 'static'` while the sheet is open.

**3. Apple TV power (§4).** Intercept and assert the payload, don't just watch the TV:

```js
const ha=document.querySelector('home-assistant'), h=ha.hass, orig=h.callService.bind(h);
h.callService=(d,s,dat)=>{console.log('→',d+'.'+s,dat);return Promise.resolve()};
// press Power on the Apple TV remote, then:
h.callService=orig;
```
**Pass:** `remote.turn_off` (or `turn_on`/`toggle`) with `{entity_id:"remote.living_room"}` —
**not** `remote.send_command` with a `command` of `turn_on`/`turn_off`. Repeat with `media_player:` removed
from the card config and confirm the direction still follows `remote.living_room`'s own state.

**4. backup_age alert (§5).** Build the card in isolation against the live `hass` with `max_hours: 0.001`:

```js
const el=document.createElement('fibbers-alert');
el.setConfig({type:'custom:fibbers-alert',language:'nl',
  checks:[{type:'backup_age',entity:'sensor.backup_last_successful_automatic_backup',max_hours:0.001}]});
el.hass=document.querySelector('home-assistant').hass;
document.body.appendChild(el);
setTimeout(()=>console.log(el.shadowRoot.textContent.trim()),500);
```
**Pass:** a stale-backup finding, **not** "Alles in orde".

**5. Weather forecast (§6).** **Pass:** 5 day cells with day names and temperatures on `/huis`, from an
instance whose `weather.*` entity has no `forecast` attribute.

**6. Sparklines (§8).** Hard-reload `/dashboard-main/systeem` and screenshot at 2 s, 5 s and 10 s.
**Pass:** no card reads "Geen historie" at any point unless the entity genuinely has no recorder history;
a loading skeleton is fine. Then leave the tab open for an hour and confirm the curve's right edge has moved.

**7. Dead grid rows (§9).** **Pass:**
`[...deepAll('fibbers-nav'),...deepAll('fibbers-sheet')].map(e=>e.getRootNode().host.getBoundingClientRect().height)`
returns all zeros, and each containing `hui-section` shrinks by 56 px.

**8. Touch targets (§7).** Re-run the per-view measurement. **Pass:** zero controls under 44 × 44 on all
8 views. Current baseline to beat: licht 28, huis 23, muziek 17, tv 29, wekker 37.

**9. Bundle (§15).** **Pass:** `grep -c "dev mode" dist/fibbers.js` → 0; no Lit dev-mode warning in the
console on any dashboard; the eagerly-loaded entry file under 250 KB; an icon named only in YAML
(e.g. `solar:chef-hat-bold-duotone`) still renders.

**10. Release integrity.** **Pass:** CI green, `dist/ is in sync with src/` passes, and the GitHub release
has **1 asset**. Check `git diff --exit-code dist/fibbers.js src/tailwind.gen.js` locally after
`bun run gen-tw && bun run build` before tagging.

---

## Suggested commit order

1. `gen-tw` + rebuild so CI is green and the release ships an asset.
2. §5 (`const t`) + the `no-shadow` ESLint rule — one line, silent data-loss class of bug.
3. §1 slider hit areas + §7 the shared `.fib-hit` rule — the biggest user-facing win, one shared change.
4. §2 + §3 + §3b together — sheets and more-info; they cannot be split.
5. §4 Apple TV power, §14 remote cleanups.
6. §6 weather forecast.
7. §8 sparkline cold start + refresh, §9 dead grid rows, §10 media idle/title.
8. §11 §12 §13 — the slider commit lifecycle, as one pass over `ui.js` + the four slider cards.
9. §15 bundle: minify + production Lit first (trivial), icon splitting second (needs a build change).
10. §16 §17 in whatever order suits; §17a–§17f and §17q–§17s are the cheapest.
