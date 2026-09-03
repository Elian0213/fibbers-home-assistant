# Fibbers v0.7.6 — patch plan

**Baseline:** tag `0.7.5` (`048679c`). The release workflow hasn't published assets yet, so **nothing here is
live-verified** — every finding is `[SRC]`, read against 0.7.5 source with the trigger stated.

Scope: your report that the volume slider is missing a debounce — which turned out to be **two** cards, one of
them the lights slider itself — plus three defects in code 0.7.5 newly introduced.

Deliberately short. This is a patch, not another audit epic.

---

## P0 — The missing debounce, in two cards

### 1. `light-row.js:265` — the lights slider still fires ~30 calls/second on key repeat

You were right that it's the same problem as the lights slider. It **is** the lights slider: 0.7.5 fixed this
class in `number.js`, `light-group.js` and `media.js` and left `light-row.js` on the raw committer.

```js
// src/cards/lights/light-row.js:265
                onInput: (v) => this._commit(Math.round(v)),
```

`sliderTrack`'s `onInput` is called **only** from its `keydown` handler (`shared/ui.js:20-28`) — pointer
moves go to `onMove` instead. So this is the keyboard/step path: focus a light row's brightness slider, hold
ArrowRight, and OS auto-repeat (~30/s) fires one `light.turn_on` **per keypress**, straight through with no
debounce. `light-row.js` doesn't import `debounce` at all.

### 2. `remote.js:1236` — same defect, same line shape, on the remote's volume

```js
// src/cards/media/remote.js:1236
          onInput: (v) => this._setVol(v),
```

Holding an arrow key on the remote's volume slider fires ~30 `media_player.volume_set` calls/second.
`remote.js` doesn't import `debounce` either.

### The state of play across the five slider cards at 0.7.5

| card | imports `debounce` | `onInput` |
|---|---|---|
| `inputs/number.js` | yes | `:283-287` — arms the hold, then `_debouncedSet` ✔ |
| `lights/light-group.js` | yes | `:254` — arms the hold, then `_debouncedCommit` ✔ |
| `media/media.js` seek | yes | `:380-382` — arms the hold, then `_seekInput` ✔ |
| `media/media.js` volume | yes | `:529-531` — arms the hold, then `_volInput` ✔ |
| **`lights/light-row.js`** | **no** | `:265` — raw `_commit` ✗ |
| **`media/remote.js`** | **no** | `:1236` — raw `_setVol` ✗ |

Note both broken cards *do* arm the hold inside their committer (`_commit` → `_hold.hold(pct)`, `_setVol` →
`_volHold.hold(pct)`), so neither shows the "steps don't accumulate" symptom `media.js` had before 0.7.5.
Their only symptom is the call flood — which is the one that made the lights feel laggy.

### The fix — copy the pattern that already exists, don't invent one

`number.js:283-287` is the reference. For each of the two cards:

```js
// 1. import it
import { debounce, … } from "../../shared/util.js";

// 2. build it once in setConfig, next to the SliderHold
this._debouncedCommit = debounce((v) => this._commit(v), 150);   // light-row
this._volInput        = debounce((v) => this._setVol(v), 150);   // remote

// 3. arm the hold immediately so the display advances and held keys keep stepping,
//    but debounce the write
onInput: (v) => {
  const p = Math.round(v);
  this._hold.hold(p);
  this._debouncedCommit(p);
},

// 4. and cancel on unmount — number.js:104-107 / light-group.js:234-237
disconnectedCallback() {
  super.disconnectedCallback();
  this._debouncedCommit.cancel();
}
```

Step 4 matters: neither card has a `disconnectedCallback` today, which is fine only because there's nothing
pending to cancel. Adding a debounce without it introduces a late write from a torn-down card.

**Acceptance:** focus the slider, hold ArrowRight for 2s. Count service calls — **≤ 15**, not ~60 — and the
value must climb the full range rather than one step. Repeat on `light.kitchen` and on the remote's volume.

---

## P1 — A related inconsistency worth settling in the same patch

### 3. Two cards in the same family disagree about whether a drag commits

`light-row._move` (`:207-210`) and `remote._volMove` (`:857-860`) only update the drag display; the commit
happens once in `_up`. But `light-group._move` (`:208-217`) and `number._move` (`:176-184`) commit **during**
the drag through their debounce, behind a ~4px slop threshold.

So on the same dashboard: dragging the **group master** dims the room as your finger moves; dragging an
**individual light row** does nothing until you lift. Same for the remote's volume — the TV doesn't change
until release.

Neither behaviour is a bug, but they shouldn't both exist. Recommendation: make all four live-track, since
that's what the group already does and it's the more responsive feel — reuse the same 4px threshold and the
150ms debounce from item 1, so this costs almost nothing once that lands:

```js
_move(e) {
  if (!this._dragging) return;
  const p = Math.round(pctFromX(e.clientX, e.currentTarget));
  this._dragPct = p;
  if (Math.abs(p - this._downPct) >= 4) this._debouncedCommit(p);  // slop threshold
}
_up(e) { … this._debouncedCommit.cancel(); this._commit(p); }      // final value wins
```

If you'd rather they all commit only on release, that's fine too — but then `light-group` and `number` should
change, not stay as the odd ones out.

---

## P1 — Defects in code 0.7.5 introduced

### 4. `hui-inject.js:72-76` — the shared observer can latch onto `document.body` permanently

```js
      state.observer = new MutationObserver(schedule);
      state.observer.observe(findPanel() || document.body, {
        childList: true,
        subtree: true,
      });
```

If `partial-panel-resolver` hasn't mounted at the moment of the **first** `injectStyle`, this falls back to
observing `document.body` with `subtree: true`. Nothing ever re-targets it: `startShared` early-returns
forever after because `state.observer` is now non-null.

Trigger: a cold load of a Fibbers dashboard, where the nav card can mount before HA's panel resolver — i.e.
the normal path, not an edge case. The result is a whole-document subtree observer firing `schedule()` on
every DOM mutation anywhere in HA, which is precisely the cost this refactor was written to remove.

**Fix:** remember whether the fallback was used and upgrade on the next tick.

```js
state.fallback = !findPanel();
// …in schedule()'s timeout, before paintAll():
if (state.fallback) {
  const panel = findPanel();
  if (panel && state.observer) {
    state.observer.disconnect();
    state.observer.observe(panel, { childList: true, subtree: true });
    state.fallback = false;
  }
}
```

### 5. `view-reserve.js` `lockView()` bypasses the shared injector, so it has no retry

```js
export function lockView(on) {
  const root = findHuiRoot();
  if (!root || !root.shadowRoot) return;      // ← silent, and never retried
```

The three subscribed styles get re-applied by the shared observer whenever HA re-renders. The sheet scroll
lock doesn't — the comment calls it "a one-shot (not a subscribed style) since it toggles with the sheet".

The consequence is the early return: if `hui-root` isn't resolvable at the instant a sheet opens, the lock is
never applied and **never retried**, so the background scrolls behind the open sheet for the life of that
sheet with no diagnostic. Same shape as the `hui-root` timing in item 4.

**Fix:** route it through the machine it's sitting next to — `injectStyle(LOCK_ID, () => "#view{overflow:hidden !important}")`
to lock and `removeStyle(LOCK_ID)` to release. It gets the retry, the idempotence and the re-render
resilience for free, and `lockView` shrinks to two lines.

### 6. `remote.js:1067` — the hub announces "OK" twice

```js
            @pointerdown=${stop}
          ></circle>
          <text class="hubtx" x="0" y="1">OK</text>`
```

The `<circle>` carries `aria-label="OK"`, and the sibling `<text>` contributes the literal string "OK" to the
accessibility tree inside the `role="group"` wrapper. A screen reader traversing the wheel hears it as the
button's name and again as loose text. Every other glyph in the codebase is hidden (`shared/icon.js` marks
its SVG `aria-hidden`).

**Fix:** `<text class="hubtx" aria-hidden="true" …>`. (`.hubtx` already has `pointer-events:none` at
`remote.js:365`, so taps on the letters correctly fall through to the hub — that part is right.)

---

## Verified sound in the 0.7.5 code — don't spend time here

I went looking for problems in the two biggest new surfaces and mostly didn't find them. Recording that so
0.7.6 doesn't re-tread it:

- **The SVG wheel is well built.** Each sector is a `<path>` with `role="button"`, `tabindex="0"`, an
  `aria-label`, `@click` and `@keydown=${activateOnKey(...)}` — so Enter and Space work per sector, not just
  on the container. `:focus-visible` styles `stroke` rather than `outline` (`remote.js:333-338`), which is the
  correct choice: `outline` on an SVG child is unreliable across engines. `.hubtx` and `.glyph` are both
  `pointer-events:none`. `has(k)` gating renders three sectors cleanly when a device lacks a direction, and
  the hub is gated independently so OK still works with no directions at all. In `both` mode the container's
  `_dpadKey` carries the `e.target !== e.currentTarget` guard, so a keypress on a focused sector isn't
  swallowed.
- **`hui-inject.js` is otherwise sound.** Id-keyed `Map` (the three ids — `fibbers-hide-tabs`,
  `fibbers-view-reserve`, `fibbers-theme` — are distinct, no collision); `startShared()` on the first
  subscribe and `stopShared()` guarded by `subs.size` so one feature detaching doesn't kill another's style;
  `paintAll()` runs synchronously on subscribe, so a late subscriber paints immediately rather than waiting
  for a mutation; `paintOne` is idempotent and only touches `textContent` when it actually changed.
- **The three §2.x fixes I checked all landed correctly**, including the one that motivated this round's
  predecessor: the volume slider's `onCancel` is down to `this._dragging = false`, and the destructive
  `_volHold.clear()` moved into `_setVol`'s `.catch()` where a *rejected* call releases the hold. That's
  better than what I specced.

---

## What I have not done

- **Nothing is live-verified.** 0.7.5 has a tag but no published assets, so it isn't installed. Once it
  releases: install, then run item 1's call-count test, item 4's observer-target check
  (`getEntries`-style probing or just confirming the panel is the observed node), and the 0.7.5 acceptance
  suite.
- **The broader sweep was cut short.** I had started fanning out audits over three surfaces I've never
  covered — the 26 cards' visual editors and `getConfigElement`/`EDITOR_SCHEMA`, `getStubConfig` (what the
  card picker shows on a fresh install), the `scripts/gen-*.mjs` and `check-*.mjs` build tooling, the
  Storybook stories, and runtime edge cases (empty `devices: []`, an entity vanishing mid-session, HA
  reconnect, 280px viewports, two cards of one type on a view). None of that is in this document. Say the
  word and I'll run it as its own pass — it's the largest remaining un-audited surface in the repo.
