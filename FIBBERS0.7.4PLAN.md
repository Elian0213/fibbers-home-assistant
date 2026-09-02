# Fibbers v0.7.4 — implementation plan

**Baseline:** tag `0.7.3` (`585665e`), installed and verified on HA 2026.8.3.
**Two jobs:** close out the tail from the 0.7.3 audit, and rebuild `fibbers-remote` as **one** card that
switches between devices, with a real volume slider and a layout that fits its content.

Tags used below:

- **[LIVE]** — measured or intercepted on the running instance.
- **[SRC]** — proven by reading `0.7.3` source.

---

## Part 0 — What 0.7.3 already fixed (do not redo)

Re-ran the acceptance suite from the 0.7.3 plan. **[LIVE]** unless noted:

| test | result |
|---|---|
| more-info from inside a sheet | **PASS** — the HA dialog opens, renders full-size over the open sheet, takes focus (`focus=dialog`), `document.body` stays `position: static` |
| Apple TV power | **PASS** — intercepted `remote.turn_off {"entity_id":"remote.living_room"}` (remote's own state was `on`); the real device was never touched |
| Weather forecast | **PASS** — `_forecast` has 6 rows; renders `wo 17°/17° do 22°/16° vr 19°/17° za 19°/15°` |
| Sparkline cold start | **PASS** — at t≈3 s two `fibbers-graph` cards show `skeleton=true`, `noHist=false`. No "Geen historie" flash |
| Empty nav/sheet grid rows | **PASS** — both `hui-card` wrappers measure **0** and their sections collapsed 56 → **0** |
| Slider hit area | **PASS in effect** — probing the remote volume track, `elementFromPoint` returns the slider from −20 px to +14 px (was a 5 px band). See §2.2 for why it's 38.5 px and not 44 |
| `.fib-hit` on small controls | **PASS in effect** — a 27 px source chip answers from −20 px to +8 px. See §2.3 for the new overlap |
| `backup_age` alert | **PASS [SRC]** — `const ts = Date.parse(...)`, plus `"no-shadow": ["error", {builtinGlobals:false}]` |
| Bundle | **PARTIAL** — production Lit landed (`--conditions=production`, dev-mode string count **0**), icons untouched. See §1.1 |
| Release integrity | **PASS** — 0.7.3 published with **3 assets** (0.7.2 had source archives only) |

Also confirmed live: the media card now shows `DIE TRYING / PARTYNEXTDOOR` with a working seek bar on the
Sonos, so the title fallback and `supported_features` gating behave on a real playing player.

---

## Part 1 — Carried over from the 0.7.3 plan

### 1.1 Icon lazy-loading — still 91% of the bundle **[LIVE]**

The one item from §15 that didn't land. Measured:

| | bytes |
|---|---|
| `dist/fibbers.js` @ 0.7.2 | 2,278,718 |
| `dist/fibbers.js` @ 0.7.3 | **2,260,468** |
| `src/icons.gen.js` (still statically imported at `icon.js:6`) | **2,003,104** |
| a production build with `ICONS = {}` stubbed | **186,684** |

`--minify` was deliberately dropped in `585665e` so the committed bundle reproduces byte-for-byte in CI —
that's a sound call and worth keeping. It also means the *only* remaining lever is the icon set.

**Do this:**

1. `scripts/gen-icons.mjs` gains a second output. Grep the `solar:` names referenced anywhere in `src/`
   (currently **51**) and emit `src/icons.core.gen.js` with just those; keep the full **1325** in
   `src/icons.full.gen.js`.
2. `icon.js` imports only the core map. On a miss, fetch the full set **once**, cache the promise on the
   module, then re-render. The placeholder path at `icon.js:44-55` already exists — make it await.
3. `--format=iife` can't code-split, so ship the full set as its own HACS file and fetch it:
   ```js
   let fullPromise = null;
   async function loadFull() {
     if (!fullPromise)
       fullPromise = fetch(new URL("./icons.full.json", import.meta.url))
         .then((r) => r.json())
         .catch(() => ({}));
     return fullPromise;
   }
   ```
   `import.meta.url` is unavailable in an IIFE — derive the base from the resource URL instead
   (`document.currentScript?.src` captured at module top, or the `/hacsfiles/fibbers-home-assistant/` path).
   Add `icons.full.json` next to `fibbers.js` in the release workflow; `hacs.json`'s `filename` stays
   `fibbers.js`.
4. Guard against a subset regression: a `bun run check` step asserting every `solar:` name in `src/` is
   present in `icons.core.gen.js`.

**Don't hard-subset.** This dashboard's YAML alone names **56** icons that aren't in the code's 51
(`chef-hat`, `bed`, `running-2`, `soundwave`, `book-2`, `thermometer`, `battery-half`, `heart`,
`clapperboard-play`, `waterdrops`, `sunset`, `stars`, `leaf`, `vinyl-record`, `confetti`, …). Any user config
can name any Solar icon, so the full set has to stay reachable — just not eagerly.

**Target:** eager payload under 250 KB, and `solar:chef-hat-bold-duotone` (YAML-only) still renders.

### 1.2 `SliderHold` still leaks a controller in five of six places **[SRC]**

`remote.js:168` guards it and even carries the comment explaining why:

```js
// Construct the hold once — SliderHold.addController has no removeController,
if (!this._volHold) this._volHold = new SliderHold(this, { tolerance: 2 });
```

The other five construct a fresh one on every `setConfig`, and `SliderHold`'s constructor still calls
`host.addController(this)` with no counterpart anywhere in `src/`:

- `light-row.js:66`, `light-group.js:75`, `number.js:90`, `media.js:94`, `media.js:95`

HA calls `setConfig` per keystroke in the editor, so a minute of editing a media card leaves dozens of live
controllers on one element. Apply the same `if (!this._hold)` guard (resetting `_pending` instead), or give
`SliderHold` a `dispose()` that calls `host.removeController(this)` and call it from `setConfig`.

### 1.3 Nav bar still claims tab semantics **[SRC]**

`body-layer.js:148` `div.setAttribute("role", "tablist")` and `:218` `role="tab"` with
`aria-selected` — on buttons that navigate to a different URL and tear the view down. There is no
`role="tabpanel"` and no `aria-controls` anywhere in the repo, and `aria-current="page"` on the same element
contradicts `role="tab"`.

Keep the `role="navigation"` host (`:143`), drop `role="tablist"`/`role="tab"`/`aria-selected` and the
roving tabindex, keep `aria-current="page"`. Plain buttons in a nav landmark is the correct pattern.

*(Note: the device switcher in Part 3 **is** a genuine tablist — it controls a panel in the same card. Use
the real pattern there, with `aria-controls`.)*

### 1.4 HACS store metadata **[LIVE]**

Repo topics are currently: `ha`, `hacs-custom`, `hacs-dashboard`, **`hacs-integration`**, `homeassistant`.
`hacs-integration` is wrong — this is a Lovelace plugin, and HACS's default-store review checks topics.
Drop it, add `hacs-plugin` and `lovelace`. The `hacs/default` PR is still unfiled.

Also: the repo description still says *"Vanilla web components, zero runtime deps"*. It bundles Lit. Fix the
copy — it's the first thing a reviewer reads.

### 1.5 `number` tolerance is still a fixed 0.5 **[SRC]**

`number.js:90`. Harmless on this instance (every `input_number`/`number` spans ≥ 20 with an integer step, and
`_snap()` snaps before committing), but wrong for an entity whose whole range is ≤ 1 — the hold clears on the
first update and the snap-back returns. Make it step-relative at read time:

```js
const { min, max, step } = this._bounds();
this._hold.tolerance = Math.max(step / 2, (max - min) / 1000);
```

### 1.6 Optional: the tab-strip flash on first paint

Unchanged and still optional. `hide-tabs` can only act once a `fibbers-nav` card mounts. If it bothers you,
persist the current `location.pathname` in `localStorage` the first time `setTabHiding` runs and inject the
style at module import when the path matches.

---

## Part 2 — New defects found while verifying 0.7.3

### 2.1 The d-pad renders 61 px outside its own card **[LIVE]** — fix with Part 3

Measured on the TV view, both remotes:

```
Apple TV   host = 754..966 (213 px)   d-pad = 767..1027 (260 px)   overflow right = +61 px
Philips    host = 288..501 (213 px)   d-pad = 302..562 (260 px)    overflow right = +61 px
```

Cause: `_dpad()` sizes itself `style="width:min(72vw,260px)"`. `vw` is the **viewport**, not the card. At a
2149 px viewport, `72vw` = 1547 px, so it clamps to 260 px — while `getGridOptions()` asks for
`columns: 6` of a 12-column section, giving the card **213 px**. The arrows and the source chips are painted
past the card's rounded border.

Minimum fix, independent of the redesign:

```js
// container-relative, never viewport-relative
class="relative mx-auto aspect-square w-full max-w-[260px] touch-none rounded-full bg-card2"
```

(and delete the inline `style` width/height). The redesign in Part 3 supersedes this, but land it first as a
one-liner so the current card stops overflowing.

### 2.2 Every `h-11` / `h-12` touch target is 12.5% short **[LIVE]**

```
getComputedStyle(document.documentElement).fontSize → 14px
11rem → 154px, so 1rem = 14px
```

Tailwind's `h-11` is `calc(0.25rem * 11)` = 2.75rem = **38.5 px** at a 14 px root, not 44. `h-12` = **42 px**.
That's also why the old track measured 5.25 px rather than 6 (`h-1.5` = 0.375rem).

Measured consequences on the TV view: 14 controls at 42×42 (remote transport/nav/arrows), 2 at 39×39 (power),
the volume track 39 tall. `.fib-hit` is unaffected because its `min-width`/`min-height: 44px` are absolute —
which is the pattern to copy.

**Fix:** express touch minimums in px, not rem. `min-h-[44px]`/`h-[44px]` on the slider wrappers
(`ui.js:166`, `light-group.js:331`), `light-row.js:223`/`:250`'s `min-h-11`, `remote.js`'s power `h-11 w-11`,
and `h-12 w-12` → `h-[44px] w-[44px]` on the remote's transport/nav/hold buttons. Or define
`--fib-hit: 44px` once in `BASE_CSS` and use `h-[var(--fib-hit)]`, so it's one knob.

I could not determine whether the 14 px root comes from HA's frontend or this browser's default font size —
either way the fix is rem-independent, so it doesn't matter.

### 2.3 Adjacent `.fib-hit` boxes overlap **[LIVE]**

Probing a 27 px source chip: −20 px → "Netflix", 0 → "Netflix", +8 → "Netflix", **+14 → "Prime Video"**
(the chip in the row *below*). The 44 px hit boxes of stacked chip rows collide, so a low tap near a chip
activates its neighbour rather than doing nothing.

The 0.7.3 plan called for raising the row gap alongside `.fib-hit`; that half wasn't done. `overflowChips`
(`ui.js:277`) and `chips.js` use `gap-1.5` (= 5.25 px at this root). Raise the **row** gap so the expanders
can't overlap: `gap-x-1.5 gap-y-[18px]`, or cap the expander at `min-height: 36px` for controls in
multi-row wraps and accept 36 there. Pick one and be consistent — overlapping targets are worse than
slightly small ones.

### 2.4 The remote's volume slider is 122 px wide **[LIVE]** — fix with Part 3

Measured parent chain from the slider outward:

```
div.relative.flex.h-11        w=122   flex: 1 1 0%
div.flex.items-center.gap-2.5 w=185
div.flex.flex-col.gap-3       w=185
div.flex.flex-col.gap-3       w=213   ← the card root
```

`flex-1` is doing its job; the column it lives in is only 185 px because the card root is 213 px (§2.1). So
the slider is short for the same reason the d-pad overflows: the card's declared grid width and its content's
intrinsic width were never reconciled. Part 3 fixes both at once.

### 2.5 `remote.js`'s volume hold is the only `SliderHold.value()` call without `gone:` **[SRC]**

```js
const vol = this._volHold.value(Math.round(mp.attributes.volume_level * 100),
  { dragging: this._dragging, dragValue: this._dragVol });
```

Compare `media.js`, `light-row.js`, `light-group.js`, `number.js`, which all pass `gone:`. Without it, if the
player goes unavailable or is powered off during the hold window the knob shows the stale committed
percentage until the timeout expires. Pass
`gone: !mp || ["unavailable","unknown","off"].includes(mp.state)`, and give the same condition to
`sliderTrack`'s `disabled`.

Its `onCancel` also only sets `_dragging = false`. There's no debounce to cancel here, but it should
`this._volHold.clear()` so a cancelled drag doesn't leave a pending value on screen.

### 2.6 The transport divider trails at the end of a wrapped row **[LIVE]**

0.7.3 added the right guard (`hasT && hasN`, `remote.js:560`) — both groups exist on the Philips remote, so
the divider legitimately renders. But the row is `flex flex-wrap`, and at 213 px the nav buttons wrap to a
second line, leaving the 1×32 px divider dangling at the end of line 1. Confirmed by zooming the card.

A divider inside a wrapping flex row is a wrap hazard by construction. Part 3 replaces it with an explicit
two-group grid; if you fix it standalone, put each group in its own non-wrapping `<div>` and let the
*groups* wrap, never the separator.

---

## Part 3 — One remote, many devices

### 3.1 What's wrong with the current shape

**[LIVE]** the TV view holds two `fibbers-remote` cards, side by side, each 213 px wide and 625–652 px tall.
Both draw a 260 px d-pad (overflowing by 61 px), both draw a header, both draw a transport row. The only
things that actually differ between them:

| | Philips TV | Apple TV | Sonos Eetkamer |
|---|---|---|---|
| `remote.*` entity | `…_afstandsbediening` (`philips_js`) | `remote.living_room` (`apple_tv`) | — none — |
| `media_player.*` | `media_player.43pus7608_12` | `media_player.living_room` | `media_player.eetkamer` |
| `volume_level` reported | **yes** → slider | **no** → ± only | **yes** → slider |
| `VOLUME_MUTE` | yes | **no** | yes |
| `SELECT_SOURCE` / `source_list` | yes / **0 entries** | yes / **26 entries** | no |
| `SEEK` | no | yes | yes |
| d-pad | buttons | buttons + swipe | **n/a** |
| channel ± | **yes** | no | no |
| `GROUPING` | no | no | **yes** |

So two thirds of each card is identical furniture, and the interesting 15% is buried. One card with a device
switcher is the right shape — and it also gives the Sonos somewhere to live that isn't a separate media card.

### 3.2 Config schema

```yaml
type: custom:fibbers-remote
name: Woonkamer              # optional card title; devices carry their own names
remember: true               # default true — remembers the last device per browser
auto_select: playing         # optional: on mount, jump to whichever device is playing
devices:
  - name: Philips TV
    entity: remote.43pus7608_12_afstandsbediening
    media_player: media_player.43pus7608_12
    icon: solar:tv-bold-duotone
  - name: Apple TV
    entity: remote.living_room
    media_player: media_player.living_room
    icon: solar:display-bold-duotone
    favourites: [Netflix, YouTube, Prime Video, Spotify]
  - name: Eetkamer
    media_player: media_player.eetkamer     # no remote entity — transport + volume only
    icon: solar:smart-speaker-bold-duotone
```

Rules:

- Every per-device key that exists today stays per-device: `entity`, `media_player`, `device`, `commands`,
  `dpad`, `sources`, `favourites`, `name`, `icon`.
- A device needs **`entity` or `media_player`**, not necessarily both. Today `setConfig` hard-requires
  `entity` (`remote.js:2-4`) — relax it, and gate the d-pad/channel rows on having a `remote.*` entity with
  directional commands.
- Card-level keys: `name`, `devices`, `remember`, `auto_select`, `language`.
- **Backwards compatible, and this matters — it's published.** A config with a top-level `entity:` and no
  `devices:` is normalised to a one-device list, and a one-device card renders **no switcher**. Existing
  configs must render byte-identically apart from the layout fixes.
- `icon:` per device overrides the platform default. `DEVICE_ICON` (`remote.js`) currently maps every TV
  platform to `solar:tv-bold-duotone`; add a `speaker` fallback for entries with no `remote.*` entity.
  Verified present in the bundled set: `solar:tv-bold-duotone`, `solar:display-bold-duotone`,
  `solar:monitor-bold-duotone`, `solar:smart-speaker-bold-duotone`, `solar:remote-controller-bold-duotone`,
  `solar:gamepad-bold-duotone`. There is **no** Apple logo in Solar — don't reach for one.

### 3.3 The switcher

```
┌───────────────────────────────────────────┐
│ ▣ Philips TV  ·  ▣ Apple TV ●  ·  ▣ Eetkamer │   ← segmented, ● = that device is on
├───────────────────────────────────────────┤
│  [icon]  Apple TV                    (⏻)  │   ← header: name + now-playing + power
│          Reacher                          │
```

- **≤ 4 devices → a segmented pill row**, one tap to switch, all devices visible. **> 4 → a dropdown**
  (reuse `select.js`'s listbox, which already has `aria-haspopup`/`role="listbox"`).
- Each segment carries a **live on/off dot** driven by that device's own state — this is the payoff over two
  separate cards: one glance tells you what's on.
- This **is** a real tablist: `role="tablist"` on the row, `role="tab"` + `aria-selected` +
  `aria-controls` on each segment, `role="tabpanel"` + `aria-labelledby` on the body, roving tabindex with
  Left/Right/Home/End. (Contrast §1.3 — the nav bar is not a tablist and should stop pretending.)
- Segments are ≥ 44 px tall (px, per §2.2).
- `remember: true` persists the selected index per card via the existing `store` helper (`util.js`), keyed on
  the device list so adding a device doesn't restore a stale index. Wrapped in try/catch like everything else
  that touches storage.
- `auto_select: playing` applies **on mount only** — never mid-session. Switching the card out from under
  someone's thumb because a speaker started playing would be worse than the problem it solves.

### 3.4 Per-device state must not leak

The current card keeps `_platform`, `_platformTried`, `_warned`, `_flash`, `_srcOpen`, `_dragging`,
`_dragVol`, `_volHold` as flat fields. With a switcher these become per-device or the Philips remote inherits
the Apple TV's resolved platform — the exact bug 0.7.3 fixed for the editor (`remote.js:42-44`).

Key them by device index (a `Map`), and on switch:

- reset `_flash`, `_srcOpen`, `_dragging`;
- `_volHold.clear()` — a pending volume from device A must not display on device B;
- `_release()` — any held repeat must stop;
- resolve the new device's platform lazily (the `config/entity_registry/get` call), cached per entity id.

### 3.5 Volume: a slider wherever the device reports a level

The user's explicit ask. Three cases, **one row shape** so the card doesn't jump when switching:

| device reports | control |
|---|---|
| `volume_level != null` | mute button · **draggable slider** · `NN%` |
| only `VOLUME_STEP` / a `volume_up` command | mute button (if `VOLUME_MUTE`) · **− / +** with a level bar that is *not* draggable · blank |
| neither | row omitted |

```
(🔇)  ────────●──────────────  42%
```

- The row is full width: `flex items-center gap-2.5`, slider `flex-1`, percentage `w-10 text-right
  tabular-nums` so it never reflows as the number changes width.
- Keep 0.7.3's correct gate — `volume_level != null`, **not** `supported_features` alone. **[LIVE]** proof of
  why: `media_player.living_room` advertises `VOLUME_SET` (bit 4 is set in `sf=450487`) but reports **no**
  `volume_level`. Gating on the feature bit would draw a slider pinned at 0% that can set but never show.
  0.7.3 gets this right at `remote.js` `hasSlider`; don't "improve" it.
- Fix §2.5 while you're here: pass `gone:` and `disabled:`, and `clear()` on cancel.
- Mute only when `VOLUME_MUTE` is supported — Apple TV doesn't have it (absent from `sf=450487`), and the
  current card renders a mute button anyway in the slider branch.

### 3.6 Layout: width follows content

This is what "looks clean" means concretely. Three changes:

**a. Nothing viewport-relative.** Kill `min(72vw, 260px)` (§2.1). The d-pad becomes
`w-full max-w-[260px] aspect-square mx-auto`.

**b. A content column, centred.** The card body gets `mx-auto w-full max-w-[320px]` so on a wide grid cell
the remote is a neat centred column instead of a stretched one, and on a narrow cell it shrinks without
overflowing.

**c. Container queries for the wide case.** Put `container-type: inline-size` on the card root, then at
≥ 380 px switch to two columns — d-pad left, transport / volume / sources right:

```css
.body { display: grid; gap: 12px; }
@container (min-width: 380px) {
  .body { grid-template-columns: minmax(0, 260px) minmax(0, 1fr); align-items: start; }
  .body > .dpad { grid-row: span 2; }
}
```

Container queries (not media queries) are the point: the card must respond to **its own** width, which is
what `72vw` got wrong. Baseline-supported in every browser HA targets.

**d. Declare a footprint that matches.** `getGridOptions()` currently hardcodes `{columns: 6, rows: "auto",
min_columns: 3}` — 6/12 of a section, i.e. the 213 px that caused the overflow. Derive it instead:

```js
getGridOptions() {
  const needsDpad = /* any device with directional commands */;
  return needsDpad
    ? { columns: 12, rows: "auto", min_columns: 6 }   // full width; the container query lays it out
    : { columns: 6,  rows: "auto", min_columns: 4 };  // speaker-only: half is plenty
}
```

With one card replacing two, taking the full section width is the right default — and the container query
means a full-width card looks composed rather than padded.

**e. No wrap hazards.** Replace the `flex flex-wrap` transport row + `<span>` divider (§2.6) with a grid of
two non-wrapping groups; let the *groups* stack, never the separator.

**f. Height changes on switch.** Devices have different bodies, so the card will resize. Keep the switcher
and header pinned at the top and animate the body height (`grid-template-rows` transition or a measured
`max-height`), honouring `prefers-reduced-motion` — the codebase already checks it in `body-sheet.js` and
`tw.js`. Don't reserve the max height across all devices; that reintroduces dead space, which is the thing
we're removing.

### 3.7 D-pad rework

**[LIVE]** the 260 px circle puts four 56 px arrows at the rim and an 80 px OK in the centre, leaving a wide
empty ring. Two improvements:

- **Default (`dpad: buttons` / `both`)**: shrink the circle to ~220 px and make the arrows **wedges** filling
  the ring (four `clip-path` quadrant buttons) rather than small circles floating in it. The whole ring
  becomes tappable, the dead space disappears, and every arrow target grows well past 44 px.
- **New `dpad: grid`**: a 3×3 grid — up / down / left / right / OK with empty corners. Denser, unmistakable
  on a phone, and it costs nothing to offer.

Keep the Apple TV swipe surface, keep `dpad: swipe|buttons|both|grid` validated in `setConfig`, and keep
0.7.3's `has(key)` gating on every arrow. The swipe container still needs the keyboard path 0.7.3 added
(`_dpadKey`, `remote.js:384`) — make sure it survives the rewrite.

### 3.8 Migration for this dashboard

Once the card supports `devices:`, the TV view collapses from two sections to one card. Replacement:

```yaml
type: custom:fibbers-remote
language: nl
remember: true
devices:
  - name: Philips TV
    entity: remote.43pus7608_12_afstandsbediening
    media_player: media_player.43pus7608_12
    icon: solar:tv-bold-duotone
  - name: Apple TV
    entity: remote.living_room
    media_player: media_player.living_room
    icon: solar:display-bold-duotone
    favourites: [Netflix, YouTube, Prime Video, Spotify]
  - name: Eetkamer
    media_player: media_player.eetkamer
    icon: solar:smart-speaker-bold-duotone
```

I'll apply this to the live dashboard once the release is out, and delete the two `PHILIPS TV` / `APPLE TV`
sections along with the now-redundant `fibbers-media` card for the Sonos on the TV view.

Note `media_player.43pus7608_12` reports `SELECT_SOURCE` with a **0-entry `source_list`**, so the Philips
device shows no source chips — correct, and a good test that the empty case renders nothing rather than an
empty chip row.

---

## Part 4 — Acceptance tests

**1. No overflow, any width.** For each device, at card widths 200 / 260 / 320 / 400 / 560 px:

```js
const c = /* the fibbers-remote element */;
const hr = c.getBoundingClientRect();
let maxR = -Infinity, minL = Infinity;
c.shadowRoot.querySelectorAll('button,[role=slider],[role=tab]').forEach(b => {
  const r = b.getBoundingClientRect(); if (!r.width) return;
  maxR = Math.max(maxR, r.right); minL = Math.min(minL, r.left);
});
console.log(Math.round(maxR - hr.right), Math.round(hr.left - minL)); // both must be ≤ 0
```
**Pass:** no control extends past the card on either side at any width. Baseline to beat: **+61 px**.

**2. Touch targets in px.** Re-run the probe from the 0.7.3 plan over `[role=slider]`, `[role=tab]` and every
`button` in the card. **Pass:** every control answers `elementFromPoint` across a ≥ 44 px band, **and** no
offset within ±22 px of a control's centre returns a *different* control (§2.3).

**3. Switching is clean.** Switch A → B → A while a volume drag is pending on A and a source drawer is open.
**Pass:** no stale percentage from A appears on B; no held repeat keeps firing; B's platform resolves to B's
own (`_device()` differs per device); the source drawer closes on switch.

**4. Volume shape per device.** **Pass:** Philips and Eetkamer show a draggable slider with a live
percentage; Apple TV shows − / + with no draggable track and **no** mute button; the row occupies the same
height in all three so the card doesn't jump.

**5. Capability gating.** **Pass:** the Eetkamer device shows no d-pad and no channel row; the Philips device
shows a channel row and no source chips (empty `source_list`); the Apple TV shows 26 sources behind
`favourites` + an "Alle 26" toggle.

**6. Backwards compatibility.** Load a 0.7.3-era single-`entity:` config. **Pass:** renders with no
switcher, identical behaviour, no console warnings, `setConfig` doesn't throw.

**7. Bundle.** **Pass:** eager `dist/fibbers.js` under 250 KB; `solar:chef-hat-bold-duotone` (named only in
YAML) still renders; `grep -c "dev mode" dist/fibbers.js` → 0; CI's dist-sync gate green and the release
carries its asset.

**8. Nothing regressed.** Re-run the eight Part 0 tests.

---

## Part 5 — Commit order

1. §2.1 d-pad `vw` → container-relative — a one-liner that stops the current overflow immediately.
2. §2.2 px touch minimums (`--fib-hit: 44px`) and §2.3 chip row gaps — small, mechanical, high value.
3. §2.5 remote volume hold `gone:`/`clear()`, §1.2 `SliderHold` guard in the other five sites, §1.5 `number`
   tolerance — the last of the slider-lifecycle tail.
4. §1.3 nav roles, §1.4 topics + description.
5. **Part 3**, in this order: schema + normalisation + backwards compatibility → per-device state (§3.4) →
   switcher (§3.3) → volume (§3.5) → layout and container queries (§3.6) → d-pad rework (§3.7). Land the
   schema first so everything after has something to switch between.
6. §1.1 icon splitting last — it touches the build and the release workflow, so keep it off the critical path
   of the remote work.
