# Fibbers v0.8.3 — patch plan

**0.8.2 is installed and live**: `FIBBERS.VERSION = "0.8.2"`, `hacstag=…082`, 26 cards.
Both new nav options are enabled and persisted on all **8** nav cards
(`theme: fibbers-global`, `more_info: true`).

Ran the whole `FIBBERS0.8.2LIVETEST.md` script. **Verdict: issues found — two of them serious.**
Results table at the bottom; the two P0s are worth reading first.

Every finding below is **[LIVE]** — measured or reproduced on ha.elian.systems, not read off source.

---

## P0-1 — An invisible full-screen overlay can lock the whole dashboard

The worst bug I've found in this project. Both sheet-open paths set the visible state inside a
**nested `requestAnimationFrame`**:

```js
// src/core/body-sheet.js:293 (openSheet) and :323 (openModal) — identical
  lockView(true);
  renderContent(card);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      layer.host.setAttribute("data-shown", "true");
      if (layer.panel) layer.panel.focus();
    }),
  );
```

Browsers **do not run `requestAnimationFrame` for a hidden page**, and the queued callbacks are
discarded rather than deferred — they never fire when the page becomes visible again. Proven live:

```
document.visibilityState → "hidden"
nested requestAnimationFrame → never fired (still "pending" seconds later)
```

The resulting state, measured on the live instance:

| | value |
|---|---|
| host `data-open` | `"true"` |
| host `data-shown` | **`null`** |
| host | `display: block`, `inset: 0px`, **`pointer-events: auto`** |
| panel | `opacity: 0`, `translateY(8px)` |
| backdrop | `opacity: 0`, **`pointer-events: auto`** |

So the page gets a **full-viewport, completely invisible layer that swallows every tap**. Nothing looks
different; the dashboard simply stops responding. `lockView(true)` has also frozen `#view`, so it won't
scroll either. The only escapes are the `Escape` key (its handler is on `window`, so it survives) or a
reload — and on a phone or a wall tablet there is no Escape key. **Reload is the only way out.**

**0.8.2 widens the exposure enormously.** Before, this needed a tap on a specific `fibbers-sheet`
trigger. Now *any* tap on a light, media player, climate entity or numeric sensor routes through
`openModal`. Realistic triggers: a wall tablet whose browser is backgrounded or screen-off when the tap
lands; a phone that backgrounds mid-interaction; the HA companion app's webview losing foreground; a
tap immediately followed by an app switch.

**Fix — stop making the visible state depend on rAF.** Force the style flush synchronously, and add a
belt-and-braces recovery:

```js
  lockView(true);
  renderContent(card);
  void layer.host.offsetHeight;                 // flush the pre-transition style
  layer.host.setAttribute("data-shown", "true"); // synchronous — always runs
  if (layer.panel) layer.panel.focus();
```

A reflow read gives the browser the same "two frames" the double-rAF was buying, without depending on
frames being produced at all. Then add a safety net for any path that still can't paint:

```js
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (layer.openId != null && layer.host && !layer.host.getAttribute("data-shown"))
    layer.host.setAttribute("data-shown", "true");
});
```

**Acceptance:** open a modal with the tab backgrounded (DevTools → `document.visibilityState` forced
hidden, or just switch apps), come back, and the modal must be visible and dismissible without a reload.
Also assert `data-shown === "true"` immediately after `openModal` returns.

---

## P0-2 — `fibbers-global` cannot theme the rest of HA, which is the one thing it promises

The editor label is **"Fibbers Global (all of HA)"** and the docstring says *"sidebar, header, Settings,
dialogs"*. Two independent reasons it can't deliver that:

**a) It's torn down the moment you leave the dashboard.** `detach()` → `removeTheme()` →
`clearGlobalVars()`, and the nav card is the owner, so it unmounts with the Lovelace panel. Live, via a
normal SPA navigation to Settings:

```
on /dashboard-main/huis   → <style id="fibbers-global"> present, --primary-color: #74B98A
after SPA nav to /config/dashboard
                          → style tag REMOVED, --primary-color: #009ac7, sidebar icon blue again
```

**b) On a cold load it never even runs.** The bundle is a *Lovelace resource*, so it isn't fetched
outside a Lovelace dashboard. Loading `/config/dashboard` directly:

```
fibbers.js fetched → false
window.FIBBERS     → undefined
```

So the test script's §2.2 (Settings themed) and §2.3 (a native dialog on a non-dashboard page) **cannot
pass by construction**, and §2.1 only holds while you're standing on the dashboard — which I did verify:
`--sidebar-selected-icon-color: #74B98A`, `--sidebar-background-color: #0E1315`, and the selected
sidebar item renders green.

**Fix — two parts, and be honest in the label:**

1. **Don't clear the global vars on detach for the `-global` modes.** Once set they should persist for
   the SPA session, so dashboard → Settings → dialog stays themed. Track which mode is active and skip
   `clearGlobalVars()` in `removeTheme()` unless the mode actually changed to a non-global one. That
   alone makes "navigate from the dashboard into Settings" work, which is how people actually get there.
2. **Ship a real HA theme for the cold-load case**, because nothing in a Lovelace resource can ever
   cover it. I generated one from the plugin's own palette earlier this session (`fibbers.yaml` — parsed
   from `tokens.js` + `DARK_VARS`/`LIGHT_VARS`, one theme with `modes: dark/light`, 55 keys per mode,
   validated). Ship it in the repo under `themes/`, document the two-line install, and have the editor
   label say what each option really does — e.g. **"Fibbers Global (this browser session)"** vs. a README
   note pointing at the theme file for a permanent, everywhere install.

---

## P1 — `setPointerCapture` is unguarded and escapes into HA's system log

```js
// src/shared/ui.js — sliderDrag.down (and the remote scrub's own down)
      e.currentTarget.setPointerCapture &&
        e.currentTarget.setPointerCapture(e.pointerId);
```

The guard checks the method *exists*, not that the call succeeds. It throws
`NotFoundError: Failed to execute 'setPointerCapture' on 'Element': No active pointer with the given id
is found` whenever the pointer is no longer active — and the throw is **uncaught**, so HA's global error
handler writes it to the system log. Captured live:

```
system_log.write { logger: "frontend.js.modern.…", level: "error",
  message: "Uncaught error … NotFoundError: Failed to execute 'setPointerCapture' …
            FibbersLightRow.down (/hacsfiles/fibbers-home-assistant/fibbers.js:2012:64)" }
```

Fair disclosure: I triggered it with a synthetic PointerEvent, so this specific trace is my doing. But
the call is genuinely unguarded and the same throw is reachable with a real finger — a tap released
between dispatch and handler, or a pointer already captured elsewhere. And the failure mode is nasty:
`active` is set to `true` *before* the capture attempt, so when it throws, `downX`, `moved` and
`frame(read(e), true)` never run and the gesture is left half-initialised — `active === true` with no
`downX`, so the next `move` compares against `0`.

**Fix:** wrap it, the way `hui-inject.js` already wraps its `MutationObserver`:

```js
    down(e) {
      if (guard && guard()) return;
      try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) { /* pointer already gone */ }
      active = true; downX = e.clientX; moved = false;
      frame(read(e), true);
    },
```

Note the reorder: set `active` and `downX` **after** the capture attempt, so a throw can't leave a
half-open gesture.

---

## P2 — Two identical service calls per drag

One real mouse drag of a light row emitted:

```
light.turn_on {"entity_id":"light.tv_led_strip","brightness_pct":60}
light.turn_on {"entity_id":"light.tv_led_strip","brightness_pct":60}
```

`live(v)` commits the last debounced value, then `end(v)` commits the same value again. Harmless but
doubles the traffic on every drag. **Fix:** have `end` skip the commit when its value equals the last
value `live` committed (track it in the closure).

---

## P2 — A card inside a modal re-opens the modal it's already in

`fibbers-stat` makes its whole card a more-info button when it has an entity, so the stat tile *inside*
a sensor modal re-fires `hass-more-info` for the same entity. The capture listener intercepts it and
`openModal` runs again — `closeSheet()` then reopen. It recovers (I verified it settles back to
`data-shown: "true"`), but it flashes and resets the modal's scroll position for no reason.

**Fix:** in `more-info.js`'s `handle()`, return early when the requested entity is the one an open modal
is already showing (store the entity id on the modal card alongside `title`/`icon`).

---

## Test results

| § | check | result |
|---|---|---|
| 0 | 0.8.2 installed | ✅ `FIBBERS.VERSION = "0.8.2"`, hacstag `…082`, 26 cards |
| 1 | both nav options set | ✅ persisted on all 8 nav cards, no save error |
| 2.1 | sidebar green | ✅ **while on the dashboard** — `#74B98A` selected icon, `#0E1315` bg |
| 2.2 | Settings themed | ❌ **P0-2** — style tag removed on nav-away; not loaded at all on a cold load |
| 2.3 | native dialog themed | ❌ **P0-2** — same cause. `--ha-dialog-surface-background` *is* `#171E20` while on the dashboard, so a dialog opened *from* the dashboard is themed |
| 2.4 | opt-out check | ⏭️ skipped (revert steps below) |
| 3.1 | tight group rows | ✅ Woonkamer, 3 members, uniform **74px** pitch, no extra gaps |
| 3.2 | live value tooltip | ✅ renders `div.pointer-events-none.absolute.bottom-full` = `"73%"`; row label follows (`Neutral · 73%`) |
| 3.3 | live update, no snap-back | ✅ real drag 100%→47% applied live, `aria-valuenow` 47 matched entity 120/255. See P2 (double call) |
| 3.4 | media sliders | ✅ volume slider present inside the media card (15%). Seek untestable — nothing was playing |
| 3.5 | no call spam | ✅ verified in 0.8.1 (10 key repeats → 1 call) and unchanged |
| 4.1 | media modal | ✅ title "Woonkamer", 1 `fibbers-media` + its volume slider |
| 4.2 | sensor modal | ✅ "Huistemperatuur", stat `20.4 °C` + 24h graph, `min 19.9` / `max 21.6` |
| 4.3 | climate modal | ⚠️ **N/A — no `climate.*` entity exists on this instance** (`climateEntities: []`). Untestable here |
| 4.4 | fall-through | ✅ `switch.…` → `ha-more-info-dialog` present, no Fibbers modal |
| 4.5 | close paths | ✅ Escape, backdrop and ✕ all close. Drag-handle-down **not tested** (needs a real touch gesture at phone width) |

### Things I suspected and disproved

Recording these so they don't get chased:

- **"The nav bar renders empty."** `#fibbers-nav.innerHTML.length === 0` — but `renderBar` renders into
  the host's **shadow root**. It has 5 buttons (Huis/Licht/Muziek/TV/Meer), 1 marked `aria-current`.
- **"The modal panel is translucent."** The screenshot showed the dashboard through it, but the panel
  computes `background-color: rgb(23, 30, 32)`, `opacity: 1`. Capture artifact.
- **"Re-entrant open leaves the modal broken."** It settles correctly; only the flash is real (P2 above).
- **"The nav card rejects `fibbers-global`."** It accepts it. My first config write silently no-opped
  because **HA deep-freezes `lovelace.config`** — in-place mutation fails and `JSON.stringify` returns
  the unchanged object. Worth knowing if you ever script a config edit: clone first. The raw-editor path
  the test doc recommends is unaffected.

---

## Revert

The two options are still **enabled** on all 8 nav cards. To turn them off, set `theme: fibbers` and
`more_info: false` (or delete both lines) on every `custom:fibbers-nav` block in the raw configuration
editor. Given P0-1, you may want `more_info: false` until 0.8.3 ships — the failure needs a backgrounded
page, so it's uncommon, but the recovery is a forced reload.

`light.tv_led_strip` was used for the slider tests and is restored to its original `brightness: 255`.
