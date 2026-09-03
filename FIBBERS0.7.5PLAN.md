# Fibbers v0.7.5 — implementation plan

**Baseline:** tag `0.7.4` (`5ea71c7`), installed and running on HA 2026.8.3.
**Two halves:** rebuild the remote's *visual design* (Part 1), and clear a 30-item bug list that has
nothing to do with the remote (Parts 2-4).

Tags: **[LIVE]** = measured or intercepted on the running instance. **[SRC]** = proven by reading 0.7.4
source, with the trigger stated so it can be reproduced.

Companion file: **`fibbers-remote-prototype.html`** — open it. It is the design, running, at phone width and
desktop width, with the variants togglable. Everything below in Part 1 is keyed to it. Don't build from the
prose; build from the prototype and use the prose for the reasoning.

---

## Part 1 — The remote, redesigned

Build from **`fibbers-remote-prototype.html`**, not from this prose. It is the design, running, at 390px and
720px. This section is the reasoning and the exact numbers.

### 1.0 What the first two passes got wrong

0.7.4 fixed the mechanics — no overflow, 44px targets, one card, device switching — and left the card looking
like a control panel: a flat surface with fourteen same-sized round buttons, each distinguished only by the
glyph inside. Nothing is scannable, because every control has the same silhouette.

My first redesign attempt then over-corrected into a moulded chassis with gradients, bevels and inner
shadows, and cut the d-pad into CSS `clip-path` wedges. Two problems with it, both fair criticisms:

- **The wedges were chord-cut.** A `clip-path: polygon(50% 50%, 10% 4%, 90% 4%)` triangle has a *straight*
  outer edge. Inside a `border-radius:50%; overflow:hidden` parent the circle then slices the triangle's
  corners off and leaves dark crescents where the arc bulges past the chord. That is the "cut off on the
  circle".
- **It wasn't Fibbers.** Gradients, bevels and simulated depth are a different design language from the rest
  of the dashboard, which is flat: `card2` surfaces, 1px `line` borders, 14px radii, accent green only where
  something is live.

So: flat, and the remote reading comes from **shape and layout alone**. No new colour tokens are needed —
the whole design uses the existing palette.

### 1.1 The wheel is one SVG donut with four true sectors

`clip-path` cannot describe an annular sector. SVG can, so the wheel becomes a single inline `<svg>`:

```html
<svg class="wheel" viewBox="-104 -104 208 208" role="group" aria-label="Direction pad">
  <path class="seg" role="button" aria-label="up" tabindex="0"
        d="M -61.57 -78.80 A 100 100 0 0 1 61.57 -78.80
           L 24.63 -31.52 A 40 40 0 0 0 -24.63 -31.52 Z"/>
  <path class="glyph" d="M -7 3.5 L 0 -3.5 L 7 3.5" transform="translate(0,-72)"/>
  … right / down / left …
  <circle class="hub" r="35" role="button" aria-label="OK" tabindex="0"/>
  <text class="hubtx" y="1">OK</text>
</svg>
```

Geometry: outer radius **100**, hub hole **40**, sectors centred at −90/0/90/180° spanning **76°** each
(45° half-span minus a **7°** gap on both sides). Generate the four `d` strings with a script rather than by
hand — the exact values for these parameters are:

| sector | `d` | glyph anchor |
|---|---|---|
| up | `M -61.57 -78.80 A 100 100 0 0 1 61.57 -78.80 L 24.63 -31.52 A 40 40 0 0 0 -24.63 -31.52 Z` | `0,-72` |
| right | `M 78.80 -61.57 A 100 100 0 0 1 78.80 61.57 L 31.52 24.63 A 40 40 0 0 0 31.52 -24.63 Z` | `72,0` |
| down | `M 61.57 78.80 A 100 100 0 0 1 -61.57 78.80 L -24.63 31.52 A 40 40 0 0 0 24.63 31.52 Z` | `0,72` |
| left | `M -78.80 61.57 A 100 100 0 0 1 -78.80 -61.57 L -31.52 -24.63 A 40 40 0 0 0 -31.52 24.63 Z` | `-72,0` |

```css
.wheel{width:100%;max-width:238px;margin-inline:auto;display:block}
.wheel .seg{fill:var(--fib-card-2);stroke:var(--fib-line);stroke-width:1.5;cursor:pointer;transition:fill .1s}
.wheel .seg:hover{fill:#2e393b}
.wheel .seg:active{fill:var(--fib-accent-bg);stroke:var(--fib-accent-line)}
.wheel .glyph{fill:none;stroke:var(--fib-ink-2);stroke-width:5.5;stroke-linecap:round;
  stroke-linejoin:round;pointer-events:none}
.wheel .hub{fill:var(--fib-accent-bg);stroke:var(--fib-accent-line);stroke-width:1.5;cursor:pointer}
```

Why this is the right primitive:

- The outer edge **is** the circle — nothing is clipped, and the gaps are true radial channels.
- **The hit area follows the shape exactly.** A `<path>` takes pointer events over its own fill, so no corner
  of one sector steals a tap meant for another.
- **Enormous targets.** A sector of a 238px wheel is ~71px along its mid-arc, against the 44px minimum.
- `viewBox` + `max-width` + `width:100%` means it scales to any container and never overflows.
- The glyphs are `pointer-events:none` decoration, so the shape is the affordance and the chevron only
  confirms it.

Keep `dpad: grid` (3×3) as the alternative — it's in the prototype behind the first toggle. `swipe` and
`both` keep working; see §2.3 for the keyboard bug in `both`.

### 1.2 Everything below the wheel, in use order

The layout is one column, top to bottom: **switcher → header → wheel → transport → volume → channel →
apps**. No flanking, no internal two-column shuffle, nothing that changes position when you switch devices.

- **Switcher** — the segmented rail from 0.7.4, restyled flat (`card2` well, `accentBg` + `accentLine` on the
  selected tab), with the live dot per device. The ARIA is already correct in 0.7.4; keep it.
- **Header** — device badge, name, now-playing, and power at the right. Power is a 44×44 rounded square: the
  only key that is neither a circle nor a full-width row, neutral when off and quietly warm when on.
- **Transport** — one segmented strip, `grid-auto-flow:column; grid-auto-columns:1fr`, hairline
  `border-left` between cells. Three loose circles become one object, it fills the width instead of floating
  centred, and the dangling-divider bug from 0.7.3/0.7.4 disappears by construction: there is no separator
  element and nothing wraps.
- **Volume** — a horizontal row: mute key (44×44), the standard Fibbers slider (6px painted track in a 44px
  hit wrapper, `accent` fill, 14px knob), percentage right-aligned in `tabular-nums` at a fixed 38px so it
  never reflows. This is the same slider shape as your light rows, which is the point.
- **Channel** — the same stepper shape as the volume fallback, only when the device has `channel_up`.
- **Apps** — a horizontal scroll rail on a phone, a grid in the companion panel on desktop.

### 1.3 One row shape for volume, level or no level

Keep 0.7.4's gate — `volume_level != null`, **not** the `VOLUME_SET` bit (see §2.5, where `media.js` gets
this wrong and renders a slider parked at 0%).

When there's no level the row keeps its height and its mute key and becomes a `− VOL +` stepper:

```css
.steps{flex:1;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;
  border:1px solid var(--fib-line);border-radius:14px;overflow:hidden;background:var(--fib-card-2)}
.steps .lab{font:600 9.5px/1 inherit;letter-spacing:.14em;color:var(--fib-muted);
  padding:0 12px;border-inline:1px solid var(--fib-line);align-self:stretch;display:grid;place-items:center}
```

That answers the open question from the 0.7.4 review: nothing jumps when a TV sleeps, because the row is the
same height and the same anatomy either way. On your instance both TVs drop `volume_level` when they power
off and the Eetkamer keeps it, so all three states are reachable without leaving the sofa.

### 1.4 Desktop: cap the body, don't stretch it

```css
.remote{container-type:inline-size}
.body{max-width:320px;width:100%;margin-inline:auto;display:grid;gap:11px}
@container (min-width:600px){
  .layout.two{grid-template-columns:minmax(0,320px) minmax(0,1fr);align-items:start}
}
```

- **600px breakpoint**, not 380px. 0.7.4 splits at 380px where the right track is ~108px while its contents
  need 204px — it overflows today, see §3.1.
- **`.two` only when the panel has content.** The companion panel carries now-playing and the app grid; when
  the device has neither (your Philips TV reports an empty `source_list`), stay one column and keep the body
  centred. A half-empty panel is exactly the dead space we're removing.
- The body cap is **320px** — a remote is a handheld object, and the 0.7.4 card looked wrong mostly because
  it stretched to 1000px.

### 1.5 Implementation order for `cards/media/remote.js`

1. Flatten the existing surfaces to `card2` / 1px `line` / 14px radii. Purely visual, no logic — and it lands
   the "in style" half of the fix on its own.
2. Replace `_dpad()`'s `buttons` branch with the SVG donut. Keep 0.7.4's `has(key)` gating per sector: a
   device with no `left` renders three sectors and a wider channel, which looks deliberate. Move the existing
   `_dpadKey` handler onto the `<svg>` and fix §2.3 while you're in there.
3. Collapse `_volSlider()` and `_volSteps()` into one `_volRow(mp)` that emits the same row skeleton and
   swaps only the middle element.
4. Transport → the segmented strip; delete the divider `<span>`.
5. Header + power restyle.
6. Container query, `.two`/`solo`, and the app rail-vs-grid split. Fix §3.1's breakpoint arithmetic here.
7. Channel row last — it's the only piece with no visual change beyond the flatten.

Nothing in Parts 2-4 depends on any of this.

## Part 2 — Functional bugs (not the remote's looks)

### 2.1 The remote's volume slider snaps back on every release **[SRC — deterministic]**

The bug class you've been chasing since 0.7.1, reintroduced in one card. Three lines:

```js
// shared/ui.js:200-202 — both bound to the same element
    @pointerup=${onUp}
    @pointercancel=${onCancel}
    @lostpointercapture=${onCancel}
```
```js
// cards/media/remote.js — _volDown takes capture on that element
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
```
```js
// cards/media/remote.js:913 — and onCancel throws the hold away
        onCancel: () => {
          this._dragging = false;
          this._volHold.clear();
        },
```

Per the Pointer Events spec, implicit capture release fires `lostpointercapture` **immediately after**
`pointerup`. So every drag ends: `pointerup` → `_volUp` → `_setVol` → `hold(v)`, then `lostpointercapture` →
`onCancel` → `clear()`. The pending value is destroyed microseconds after it's set, and the knob renders the
stale `volume_level` until HA pushes the new state.

`media.js:511-513` passes the same `onCancel` **without** the `clear()`, which is why the media card doesn't
do this — the two cards disagree, which is the tell.

**Fix:** delete `this._volHold.clear();` from that `onCancel`. On a genuine `pointercancel` no hold has been
set yet, so nothing is lost.

### 2.2 Transport is ungated and always routed to the media_player **[SRC]**

```js
// cards/media/remote.js:791-799
    const tp = (label, icon, key, mpService) => {
      if (!this._cmd(key) && !mp) return "";
      return this._round(label, icon,
        mp ? () => this._mpService(mpService) : () => this._send(key), BTN, key);
    };
```

The mere presence of a `media_player` makes the button render *and* routes it to `media_player.*` with no
`PLAY`(16384)/`PAUSE`(1)/`PREVIOUS_TRACK`(16)/`NEXT_TRACK`(32) check — `remote.js` defines only
`MF_VOLUME_MUTE` and `MF_VOLUME_STEP`.

Trigger: the standard Android TV pairing — `remote.shield` (whose command map *does* have
`MEDIA_PREVIOUS`/`MEDIA_NEXT`/`MEDIA_PLAY_PAUSE`) plus `media_player.shield`, which advertises
`TURN_ON|TURN_OFF|VOLUME_STEP|VOLUME_MUTE|SELECT_SOURCE|PLAY_MEDIA` and no track bits. All three buttons
render, call `media_player.media_previous_track`, and HA rejects them — silently, per §2.4. The
`remote.send_command MEDIA_PREVIOUS` that would have worked is never tried.

**Fix:** add the constants and prefer the capable path:
```js
const tp = (label, icon, key, mpService, bit) => {
  const viaMp = mp && this._mpSupports(mp, bit);
  if (!viaMp && !this._cmd(key)) return "";
  return this._round(label, icon,
    viaMp ? () => this._mpService(mpService) : () => this._send(key), BTN, key);
};
```
For play/pause treat `PLAY | PAUSE` as "either bit" — `_mpSupports` requires *all* bits of its mask.

### 2.3 In `dpad: both`, Enter on an arrow sends OK **[SRC]**

```js
// cards/media/remote.js:545-558, bound on the container at :708
  _dpadKey(e) {
    const map = { ArrowUp:"up", …, Enter:"ok", " ":"ok" };
    const key = map[e.key];
    if (!key) return;
    e.preventDefault();
    this._send(key);
  }
```

`stop` (`:692`) only stops `pointerdown`. A keydown on a focused child arrow button bubbles to the container,
`_dpadKey` calls `preventDefault()`, and the button's own `@click` never fires. `both` is the **default for
`device: appletv`** (`:653`), so on the Apple TV remote all four arrows are keyboard-unreachable and Enter on
any of them sends `select`.

**Fix:** first line of `_dpadKey` — `if (e.target !== e.currentTarget) return;`

### 2.4 `_mpService` catches nothing **[SRC]**

```js
// cards/media/remote.js:411-418
  _mpService(service, data) {
    const mp = this._mp();
    if (mp && this.hass)
      this.hass.callService("media_player", service, { entity_id: mp.entity_id, ...data });
  }
```

Every media_player call in the card goes through it — `volume_set`, `volume_mute`, `volume_up/down`,
transport, `select_source`. Each rejection is an unhandled promise rejection, and a rejected `volume_set`
leaves the optimistic value on screen for the full 2000ms timeout. `media.js:237-239` does this correctly.

**Fix:** `return` the promise, then `.catch(() => this._volHold.clear())` on `_setVol` and
`.catch((e) => this._flashFail(key, e, service))` elsewhere. Same gap in `media.js`: `_join`/`_unjoin`
(`:252-262`) and the `select_source` chip handler (`:536`) drop their promises.

### 2.5 `media.js`'s volume slider renders parked at 0% **[SRC]**

```js
    const canVol = this._supports(MF.VOLUME_SET);   // media.js:396
```

A player can advertise `VOLUME_SET` (4) and never report a level — CEC and `androidtv` volume-only players,
Chromecast before it connects. **Verified on your own instance:** `media_player.living_room` has
`supported_features` 450487, which includes bit 4, and no `volume_level` attribute at all. The slider then
renders at 0%, isn't `disabled`, and re-snaps to 0 after every hold expires.

`remote.js:868` gets this right (`mp.attributes.volume_level != null`). **Fix:** make `media.js` match —
`const canVol = this._supports(MF.VOLUME_SET) && a.volume_level != null;` (`a` is already in scope at `:383`).

### 2.6 Sheets: four separate defects **[SRC]**

- **Escape closes the sheet from under HA's own dialog.** `core/body-sheet.js:61-63` — `onKeydown` has none
  of the dialog-path guard that `onFocusIn` (`:46-59`) carefully applies. Open a sheet, tap an entity inside
  it to raise more-info, press Escape: HA closes its dialog *and* the sheet closes behind it. Reuse the same
  `composedPath` guard, or bail on `e.defaultPrevented`.
- **The focus-trap whitelist is too narrow.** `:50-58` exempts only `localName === "ha-dialog"` or an
  explicit `role="dialog"` **attribute**. A dialog built on `ha-md-dialog`/`md-dialog` bottoms out in a native
  `<dialog>`, whose dialog role is implicit — no attribute, `localName === "dialog"`. Any HA overlay of that
  shape has focus yanked back on every `focusin` while a sheet exists. Add `dialog`/`ha-md-dialog`, or invert
  the test so focus is only pulled back when the path is inside Lovelace's own view.
- **`renderContent` has no generation guard across its await.** `:231-243` clears and refills the *shared*
  `layer.bodyEl`, and `openSheet` (`:266`) doesn't await it. Open `#a`, change the hash to `#b` before
  `loadCardHelpers()` resolves → `#a`'s continuation appends its cards into `#b`'s sheet, and `#a._children`
  keeps holding detached elements that `updateSheetHass` writes to. Capture `const gen = layer.openId` before
  the await and bail if it changed.
- **Switching `#a` → `#b` never closes `#a`, and loses the opener.** `:258-261` returns early only when the
  id matches, so `syncFromHash` opens `#b` on top. Worse, `openSheet` already moved focus onto `layer.panel`,
  so `deepActiveElement()` now returns *the sheet's own panel* and overwrites `layer.opener` with it —
  closing `#b` focuses a `display:none` element and focus falls to `<body>`. Close the previous sheet first,
  and skip re-capturing the opener when the deep active element is inside `layer.host`.
- **Focus is never returned when the last sheet unregisters while open.** `:337-343` — `closeSheet()` queues
  `finish` on a 300ms timer, then line 339 immediately clears it, so `finish()` — the only place
  `opener.focus()` runs (`:301`) — never executes. Call `finish()` synchronously in that branch, and null the
  remaining `layer.shadow/backdrop/panel/headEl/bodyEl` refs while you're there.

### 2.7 Keyboard slider steps bypass each card's debounce **[SRC]**

`cards/inputs/number.js:280` `onInput: (nv) => this._setValue(this._snap(nv))` and
`cards/lights/light-group.js:254` `if (next !== cur) this._commit(next);`

Both cards build a trailing 150ms debounce for exactly this reason (`number.js:96`, `light-group.js:93`) and
route *pointermove* through it — but the keyboard path calls the raw committer. Holding ArrowRight on a
focused slider auto-repeats at ~30/s, so it fires ~30 `number.set_value` / `light.turn_on` calls per second.
`media.js:111-112` shows the intended pattern. **Fix:** route `onInput` through the debounced function.

### 2.8 `media.js`'s keyboard steps don't accumulate **[SRC]**

The mirror image of §2.7. `media.js:507` passes the *debounced* `_volInput` as `onInput`, and the hold is
only armed inside the debounced `_setVol`. `sliderTrack`'s keydown computes `next` from the render-time
`value` (`ui.js:178`), which is read back from the entity — so it doesn't move between keypresses, and the
debounce discards all but the last. Net effect: **one 5% step per HA round trip** no matter how many times you
press. Same for seek (`step: 10`, `:363`). **Fix:** arm the hold optimistically so the display advances —
`onInput: (v) => { this._volHold.hold(v); this._volInput(v); }`.

### 2.9 Cross-device leaks that survive a switch **[SRC]**

- **A rejection flashes the wrong device.** `remote.js:380-395` — `_send` captures `id` before its await, but
  `_flashFail` re-derives it from `this._dev()` *after*. Press Home on a sleeping Philips TV (the call takes
  seconds to time out), switch to the Apple TV, and the rejection dims the Apple TV's Home button, logs the
  wrong platform, and burns `AppleTV:home` in the warn-once set so its real future failure is never reported.
  Pass the captured `id` through and bail if it no longer matches.
- **A swipe begun on A is delivered to B.** `_resetTransient()` (`:233-238`) clears `_dragging`, `_dragVol`,
  `_srcOpen` and `_flash` but **not `_sw`** — the only pointer-gesture field whose consumer has no per-gesture
  guard. Finger down on A's swipe pad, second finger taps B's tab, lift the first finger: `_swipeEnd` sends
  `right`/`ok` to **B**. Add `this._sw = null;`.
- **`auto_select` bypasses `_select()`.** `:262-278` assigns `_sel` directly, skipping `_release()`,
  `_volHold.clear()`, `_resetTransient()` and the `store.set`. So the remembered index and the visible tab
  disagree and the remembered device reappears next load; and because `setConfig` resets `_autoDone`
  (`:215`), the Lovelace editor — which calls `setConfig` per keystroke — re-fires auto-select repeatedly and
  yanks the preview off whatever tab you picked. Route through `_select(i)`, skip when a remembered index was
  restored, and set `_autoDone` from `connectedCallback` rather than resetting it in `setConfig`.

### 2.10 Ungated source chips and group row **[SRC]**

Neither `remote.js` nor `media.js` defines `SELECT_SOURCE` (2048) or `GROUPING` (524288); both gate only on a
non-empty list. A player exposing `source_list` without `SELECT_SOURCE`, or a `group:` list on a player
without `GROUPING`, renders controls whose calls are rejected — silently, per §2.4, with `aria-pressed`
stuck. Add both constants and require them alongside the list.

---

## Part 3 — Layout bugs

### 3.1 The two-column breakpoint overflows between 380px and ~484px **[SRC]**

```css
/* cards/media/remote.js:136-144 */
      @container (min-width: 380px) {
        .body { grid-template-columns: minmax(0, 260px) minmax(0, 1fr);
```

With `gap:12px` the right track is `W − 272` — **108px at the breakpoint**. What goes in it can't shrink:

| block | fixed minimum |
|---|---|
| `_volSteps` (`:955-960`) — mute 36 + two 44px hold keys + 40px value + 4×gap 10 | **204px** |
| `_transport` inner group (`:831/836`) — 3×44 `flex-none` + 2×gap 10 | **152px** |

So 380-424px overflows the transport group and 380-484px overflows the ±/mute row; the track is
`minmax(0,1fr)` so it won't grow, and the card doesn't clip — the keys spill past the rounded border. Even
where it "fits", `_volSlider` has 96px of `flex-none` furniture, leaving a 12px draggable track at 108px.

**Fix:** `@container (min-width: 520px)` and/or make column 1 `minmax(0, 40%)` so it yields. Part 1's 560px
breakpoint already accounts for this.

### 3.2 A speaker-only device is confined to the 260px column **[SRC]**

`grid-template-columns` applies unconditionally above the breakpoint, but `_dpad()` returns `""` for a device
with no directional commands (`:651`). The controls `<div>` is then the body's only grid item and auto-places
into track 1, capped at 260px — so on a 700px card the Eetkamer renders its volume and source rows in a
260px column with ~430px of empty space, and the card visibly reflows when you switch between a TV and a
speaker. **Fix:** `.body:has(> .dpad) { grid-template-columns: … }` — or Part 1's `.solo` class, which
handles the same case explicitly.

### 3.3 `aria-valuenow` lies on a disabled slider **[SRC]**

`shared/ui.js:195` reports `aria-valuenow`/`aria-valuetext` unconditionally, while `:208-220` omits the fill
and knob when `disabled`. An unavailable entity (`number.js:272`, `light-row.js:258`) renders a completely
empty track while a screen reader announces "21.5 °C". **Fix:** `aria-valuenow=${disabled ? nothing : …}`.
The rest of the `disabled` contract is honoured (`pointer-events-none`, `tabindex="-1"`).

---

## Part 4 — Packaging, globals, housekeeping

### 4.1 The icon lazy-load — fix the URL, leave the install alone **[LIVE]**

An earlier audit pass claimed `icons.full.json` never installs and every custom icon is broken. It isn't.
Verified on your instance:

```
GET /hacsfiles/fibbers-home-assistant/icons.full.json
  → 200, application/json, 1325 keys, includes solar:chef-hat-bold-duotone (a YAML-only name)
  40/40 on-screen <fib-icon> elements render; zero blanks
```

The release side is already sound: `release.yml:37-41` attaches **both** `dist/fibbers.js` and
`dist/icons.full.json`, and both CI and the release job byte-compare the committed `dist/icons.full.json`
against a fresh pinned-bun build. So the file is built reproducibly, published, and reaching the browser.

**Do not switch to a zip release.** An earlier draft of this plan recommended `zip_release: true` +
`filename: fibbers.zip` to make the second file a declared artifact. That recommendation contradicted the
paragraph above it and should not be acted on:

- It changes the install mechanism for **every existing user on upgrade**, and it's the highest-blast-radius
  change available here. The Lovelace resource URL is `/hacsfiles/fibbers-home-assistant/fibbers.js`; that
  only keeps resolving if the zip's **root** contains `fibbers.js` with no wrapper directory. Get the layout
  wrong and every install 404s its only resource — a blank dashboard for everyone, with no client-side
  symptom to diagnose from.
- There is no clean rollback: users who upgraded have already had their plugin directory rewritten.
- It buys a *declaration*, not a capability. The file already ships and already installs.

What the recommendation was actually reaching for — "guarantee the icons are reachable" — is better bought
three cheaper ways, none of which touch how HACS installs anything:

1. **Fix the URL derivation. This is the real, live-confirmed fragility.** `shared/icon.js:22-26` captures
   `document.currentScript.src`; `:30-41` falls back to scanning for a `<script src>` matching `fibbers.js`.
   HA loads a HACS plugin resource as a **JavaScript module** via `import(url)` — no `currentScript`, no
   `<script>` element. **Proof:** the live request for `icons.full.json` carried **no `?hacstag=`**, which it
   would have inherited had `SCRIPT_SRC` been populated. So every install is riding the hardcoded
   `"/hacsfiles/fibbers-home-assistant/icons.full.json"` at `:40`, which breaks for a manual `/local/` copy
   or any HACS directory not named after the repo.
   ```js
   function iconsUrl() {
     return (
       window.FIBBERS_ICONS_URL ||
       "/hacsfiles/fibbers-home-assistant/icons.full.json"
     );
   }
   ```
   Delete the two dead branches — they cost a `querySelectorAll` over the document on first miss and give
   nothing back — and document `window.FIBBERS_ICONS_URL` in the README for non-standard installs.
2. **Make a failed fetch survivable** — that's §4.2, which is the actual severity here. Right now one
   dropped request permanently blanks every non-core icon on the page. With a retry and an honest error
   message, a missing `icons.full.json` degrades to "the 64 core icons work, the rest retry" instead of
   "everything is a question mark forever".
3. **Assert the release contents in CI**, so the publish side can never silently regress to one file:
   ```yaml
   - name: Release must carry both assets
     run: test -f dist/fibbers.js && test -f dist/icons.full.json
   ```
   (The byte-sync gate already covers content; this covers existence, which is what the zip was for.)

Also worth stating in the README: **`mdi:` names always work**, because HA's frontend ships MDI. That's the
permanent escape hatch if a user's install can't reach the Solar set for any reason, and `icon.js`'s own
warning text already mentions it.

**One honest gap.** I verified the *outcome* — both files present and served — not the HACS rule that
produces it. I did not read HACS's source to establish whether it installs every release asset for a plugin
repo, or matches on `filename` and got lucky. So treat "HACS installs the second asset" as an observed
behaviour on HACS as currently installed here, not as a contract. That's exactly why items 2 and 3 above
matter: they make the failure mode survivable and detectable rather than betting on the behaviour holding.

**If you ever do want the declared guarantee**, the zip is defensible — but as its own release, changing
nothing else, with these preconditions: reproduce the install on a scratch HA + HACS instance first; confirm
`fibbers.js` sits at the zip root; confirm the existing resource URL still resolves after the upgrade path
(not just a fresh install); and re-run the icon check live before announcing it. Not worth bundling into a
release that also rewrites the remote.

### 4.2 A transient icon-fetch failure poisons the cache permanently **[SRC]**

```js
// shared/icon.js:43-54
    fullPromise = fetch(iconsUrl())
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((map) => { FULL = map || {};
```

A 404, a dropped connection or HA restarting mid-fetch resolves to `{}` — indistinguishable from a successful
empty load. `FULL` is then non-null forever, so `:102` never re-enters the load branch: **no retry**, and
every non-core icon on that dashboard is a question mark until a full reload. **Fix:** on `!r.ok` or a
rejection leave `FULL === null` and reset `fullPromise = null`, with an attempt cap.

Related: the warning at `:112-118` tells the user their icon "is not in the Solar set" on this path too, so
someone with a perfectly valid name and a flaky network is told to change it. Set a `fullFailed` flag and
emit a distinct message.

### 4.3 `nav-stack.js` runs on every HA page and can navigate you into Settings **[SRC]**

```js
// core/nav-stack.js:89-91
window.addEventListener("location-changed", onRouteChange);
window.addEventListener("popstate", onRouteChange);
onRouteChange();
```

Two permanent window listeners plus an immediate call at **import** time. Merely having the HACS resource
loaded writes `fibbers:navstack` on Settings and Developer Tools and pushes those paths onto the back stack
(`/config/dashboard` isn't a registered tab, so `:48` concatenates it) — so a `fibbers-back` card can send
the user into Settings. Every other module in `core/` already uses a lazy `start*/stop*` pair; match it.

### 4.4 Remaining global-side-effect and teardown gaps **[SRC]**

| # | where | what |
|---|---|---|
| a | `core/body-layer.js:161-162` | `new ResizeObserver(() => measureBar()).observe(div)` isn't stored, so `detach()` can't disconnect it — unlike `sidebarRO`/`drawerMO` right beside it. One leaked observer per attach/detach cycle |
| b | `core/body-layer.js:317-326` | `detach()` resets `bar.height` but not `bar.hidden`/`bar.lastScroll`/`bar.config`, so after re-attach the first hide-on-scroll is swallowed (`:268` sees `true === true`) |
| c | `core/body-layer.js:341-342` | `nav.listeners.add(renderBar)` + `hashchange` at module scope, never removed |
| d | `shared/tw.js:50` | mutates `document.adoptedStyleSheets` at import time, on every page |
| e | `shared/actions.js:22-27` | `window.open(url, "_blank")` with no `noopener` — the opened page gets a live `window.opener` handle on the HA frontend (reverse tabnabbing). Pass `"noopener,noreferrer"` |

### 4.5 The hui-root injection machinery is triplicated **[SRC]**

`core/hide-tabs.js`, `core/view-reserve.js` and `core/theme.js` each define their own `findHuiRoot` /
`paint` / `removeStyle` / 60ms `schedulePaint` / `startObserver` / `startNavListeners`, near-verbatim. A nav
card with `hide_ha_tabs` + `theme` + a reserve therefore runs **three** `MutationObserver`s on
`partial-panel-resolver` with `subtree:true`, three independent debounces, and three `location-changed` +
`popstate` pairs, each firing its own whole-document `deepFind` walk on every HA re-render. `hide-tabs.js:33`
even exports `findHuiRoot` and nothing imports it.

**Fix:** one `core/hui-inject.js` exporting `injectStyle(id, css)` / `removeStyle(id)` over a single shared
observer + debounce, with the three features as subscribers.

### 4.6 `hacs.json` still claims two years of compatibility it doesn't have **[SRC]**

`"homeassistant": "2025.1.0"` against `core/hide-tabs.js:3`, whose own header says the selectors were
"verified on HA 2026.8.x". `:11-12` injects `ha-tab-group` and `.header` with no fallback, and `paint()` only
reports when `hui-root` itself is missing — it never checks whether the selector *matched*. Same shape for
`#view` (reserve and scroll lock): if it isn't the scroll container, the nav bar covers the last card and the
background scrolls behind an open sheet, with no diagnostic. Raise the minimum to something actually tested,
or add fallback selectors (`ha-tabs, paper-tabs, sl-tab-group`) and a one-line `console.debug` when nothing
matched.

### 4.7 Small stuff

- Hardcoded English `aria-label`s on localised cards: `media.js:359` `"Seek"`, `media.js:501` and
  `remote.js:903` `"Volume"`. There are no `media.seek`/`media.volume` keys, so `check-i18n.mjs` can't catch
  them. `hl` needs a little plumbing at those call sites.
- `shared/ui.js:44` `host.addController(this)` with no `removeController` in `hostDisconnected`. Not a leak
  today — all four call sites guard with `if (!this._hold)` and say why — but Lit has `removeController`, so
  use it and delete four workarounds.
- `index.js:221` comment still points at the pre-reorg `src/theme.js`.
- Exported but used only inside their own module: `iconSvg` (`icon.js:63`), `chipKeyNav` (`ui.js:232`),
  `findHuiRoot` (`hide-tabs.js:33`).

---

## Verified sound in 0.7.4 — don't re-audit these

From two full passes plus live checks, these came back clean:

- **Every import resolves**, no dead files, no duplicated helpers, no `core/` ↔ `shared/` cycles. The reorg
  was done properly: dependency direction is strictly `index → cards → core → shared → generated`.
- **Feature-bit constants** in `media.js:31-38` all match HA core, including `SEEK: 2` (not 4096, a common
  error). `_supports`/`_mpSupports` use `(f & bit) === bit` and default a missing `supported_features` to 0.
- **The remembered device selection** is keyed on a hash of the ordered entity-id list, so adding, removing
  or reordering devices changes the key and a stale index can never point at the wrong device; the restore
  also range-checks.
- **Platform resolution across a switch** captures `id` before its await and writes into a Map keyed on it —
  correct. (Only the `_send` catch path, §2.9, gets this wrong.)
- **Held-button repeat** is released on switch, `pointerup`, `pointercancel`, `pointerleave`,
  `lostpointercapture`, tab-hide and unmount, and hard-capped at 40 iterations.
- **The tablist ARIA is complete and correct** — `role`s, unique ids, `aria-controls`, `aria-labelledby`,
  roving tabindex, Left/Right/Home/End with wrapping, focus staying on the tab (which is the right behaviour).
- **`SliderHold`** is constructed once per card and `clear()`ed on reconfigure; `hostDisconnected` cancels its
  timer and clears `_pending`.
- **No `vw`/`vh` anywhere** in the remote or media cards; grid tracks use `minmax(0, …)` and the columns carry
  `min-w-0`. The layout problems in Part 3 are breakpoint arithmetic, not missing shrink guards.
- **Touch targets**: every icon-only control carries `.fib-hit`, and `--fib-hit` is defined in absolute px.
  Measured live: 31 in-viewport controls on the wekker view and 19 on the TV view, **zero neighbour bleed**;
  all sliders 44px.
- **`theme.js` and `hide-tabs.js` are fully symmetric** — observer, listeners, matchMedia and injected style
  all created lazily and torn down, including the legacy `addListener` fallback.
- **CI/release gates** diff the committed `dist/fibbers.js`, `dist/icons.full.json` and both generated sources
  against a fresh pinned-bun build. No `console.log` in shipped code.
- **`i18n.js`** honours its contract: exact tag → base language → English, `{var}` interpolation, `_one`
  plural sibling.

---

## Acceptance tests

1. **The design.** Put the rebuilt card next to `fibbers-remote-prototype.html` at 390px and at 760px. The
   wheel must be a circle (not a square with a hole), the wedge gaps must show the recessed well, and the
   volume rocker must keep its silhouette when you power the TV off.
2. **No overflow, any width.** For each device at card widths 200 / 260 / 320 / 380 / 440 / 520 / 700 / 1000:
   no control's `getBoundingClientRect()` may extend past the card. Baseline to beat: overflows today between
   380 and 484 (§3.1).
3. **Volume snap-back (§2.1).** Drag the remote's volume to 80% on a player that reports a level and sample
   `aria-valuenow` at 30 / 120 / 250 / 500 / 900ms. It must read 80 at every sample. Today it reverts on the
   first frame after release.
4. **Transport routing (§2.2).** Intercept `hass.callService` on an Android TV device whose player lacks the
   track bits; pressing Next must emit `remote.send_command {command:"MEDIA_NEXT"}`, not
   `media_player.media_next_track`.
5. **D-pad keyboard (§2.3).** With `device: appletv`, Tab to the Up wedge and press Enter → `up`, not
   `select`. All four wedges reachable.
6. **Sheets (§2.6).** Open a sheet → open more-info inside it → Escape closes **only** the dialog. Then
   change the hash from `#a` to `#b` immediately and confirm `#a`'s cards never appear in `#b`, and that
   closing returns focus to the original trigger.
7. **Keyboard sliders (§2.7, §2.8).** Hold ArrowRight on a `number` slider for 2s: ≤ 15 service calls, and
   the value must climb by more than one step.
8. **Icon resilience (§4.1, §4.2).** Three parts, and none of them should require reinstalling the plugin:
   (a) block `icons.full.json` in devtools, load a dashboard with a non-core icon, unblock, mount another
   non-core icon — it must render rather than staying a question mark, and the console message must say the
   set couldn't be *loaded*, not that the name doesn't exist; (b) set
   `window.FIBBERS_ICONS_URL = "/local/icons.full.json"` before the resource loads and confirm the fetch
   follows it; (c) confirm the Lovelace resource URL is untouched by the release — it must still be
   `/hacsfiles/fibbers-home-assistant/fibbers.js?hacstag=…`, since §4.1 deliberately does not change how
   HACS installs.
9. **Regression.** Re-run the 0.7.4 suite: overflow, touch-target census with the neighbour check, device
   switching with a pending hold, capability gating per device, and the eight 0.7.3 checks.
