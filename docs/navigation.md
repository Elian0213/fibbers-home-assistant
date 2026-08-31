# The navigation system

Home Assistant gives you a top tab bar and, on subviews, a back arrow that
always returns to the dashboard root. This replaces both with a bottom bar and a
real navigation stack. It is the part of Fibbers most worth getting right,
because it is the only chrome your household actually touches.

## Model

Three concepts, deliberately few:

| Concept | Meaning | Behaviour |
|---|---|---|
| **Tab** | A top-level destination (`Huis`, `Licht`, `Muziek`, `TV`, `Meer`) | A stack **root**. Entering a tab clears the stack. |
| **Page** | A subview reached from a tab (`Wekker`, `Keuken`, `Systeem`) | **Pushed** onto the stack. |
| **Sheet** | A modal over the current page (room controls, all scenes) | Hash-based, never touches the stack. |

The stack lives in `sessionStorage` under `fibbers:navstack`, so it survives a
reload but not a new tab — which is the behaviour you want.

`window.FIBBERS.nav.stack` in the console shows it live.

### Why a stack rather than `history.back()`

`history.back()` walks the *browser's* history, which on a Lovelace dashboard is
polluted by hash changes from sheets, more-info dialogs, and HA's own internal
navigation. Pressing back after closing a sheet would reopen it. A stack that
only records real view changes gives predictable behaviour, and falls back to
`history.back()` only when it has nothing of its own.

### Back labelling

`fibbers-back` names the destination from where you actually came:

```yaml
type: custom:fibbers-back
fallback: /dashboard-thuis/meer      # used on a cold deep-link
labels:                              # path -> human name
  /dashboard-thuis/meer: Meer
  /dashboard-thuis/licht: Licht
  /dashboard-thuis/huis: Huis
```

Arrive at `Systeem` from `Meer` and it reads *Terug naar Meer*. Arrive from
`Licht` and it reads *Terug naar Licht*. Open the URL directly and it uses
`fallback`. Set `label:` to pin the text and skip all of that.

### Tab highlighting from a page

A page is not a tab, so nothing would light up. `activeIndex()` resolves it in
three steps: exact path match, then `match: prefix` if the tab declares it, then
the stack's root — so opening `Systeem` from `Meer` keeps **Meer** lit.

## The HA fixture (required for any positional test)

The whole architecture rests on one claim: *`position: fixed` does not pin to the
viewport inside a Lovelace view.* A plain harness page does **not** reproduce
that, so a bar tested there pins correctly whether it renders to `document.body`
or in-tree — the assertion passes for the wrong reason.

Lovelace's structure, reduced to what matters:

```html
<div class="ha-fixture">   <!-- transform: translateZ(0); overflow-y: auto; height: 100dvh -->
  <div class="ha-view">    <!-- content taller than the viewport -->
    …cards…
  </div>
</div>
```

The `transform` is what does it: a transformed ancestor becomes the containing
block for fixed descendants, so `bottom: 0` resolves to the bottom of the
*scrolling content*, not the window. `filter`, `contain`, `backdrop-filter` and
`will-change` all have the same effect.

A correct fixture needs both arms:

- **Positive** — `fibbers-nav` renders into `document.body`, so inside the
  fixture it must still report `getBoundingClientRect().bottom ≈ window.innerHeight`
  after scrolling the fixture to the middle of its range.
- **Negative control** — a throwaway `fibbers-nav-naive` defined *only in the
  harness*, identical but appending its bar in-tree. Inside the fixture it must
  **fail** the same assertion. If it passes, the fixture is wrong, not the code.

Scroll the fixture, not the window, and assert after scroll — an unscrolled
container hides the bug entirely.

## The iOS checklist

Every item here is a bug that actually shipped in the card-mod version. They are
all handled in `dist/fibbers.js`; this is the list to check against if a new one
appears.

| Symptom | Cause | Fix in code |
|---|---|---|
| Thin lighter strip below the bar | Rubber-band overscroll drags the page past a fixed element and reveals the app background | `box-shadow: 0 60px 0 60px <nav>` paints a solid block below the bar. Do not replace with a taller element — the shadow costs no layout. |
| Bar flickers or ghosts while scrolling | `backdrop-filter` on a fixed element in WKWebView | Removed entirely. Solid `#161C1E` instead. If you want translucency, test on device first. |
| Bar juddering behind momentum scroll | Bar repainting on the main thread | `transform: translateZ(0)` promotes it to its own layer. |
| Bar sits too high / too low | `env(safe-area-inset-bottom)` is `0` unless the webview sets `viewport-fit=cover` | `calc(9px + env(safe-area-inset-bottom, 0px))` — a real floor plus the inset. |
| Wrong height after rotating | Safe-area inset changes, spacer does not | `ResizeObserver` on the bar plus `orientationchange` (with a 250 ms delay, because iOS reports the old inset immediately). |
| Grey flash on tap | Default tap highlight | `-webkit-tap-highlight-color: transparent`. |
| ~300 ms delay before the tab switches | Double-tap-to-zoom detection | `touch-action: manipulation`. |
| Pressed state never shows | `:active` is unreliable in WKWebView | `pointerdown`/`pointerup` set `data-pressed`. |
| Last card hidden behind the bar | Fixed element is out of flow, reserves no space | The card renders a spacer sized from the measured bar height, not a guess. |
| Duplicate bars after switching tabs | One card instance per view, each appending to body | Singleton with reference counting in `attach`/`detach`. |

### Still unverified on device

I have no iOS device in this session. These need checking on your phone:

- **Landscape**: the 250 ms `orientationchange` delay is a guess; if the spacer
  is briefly wrong, raise it.
- **HA companion app tab bar**: if you enable the app's own bottom tabs, they sit
  under ours. There is no detection for that yet — either turn them off in the
  app, or add a config offset.
- **`auto_hide: true`**: the scroll listener uses `capture: true` on `document`
  to catch HA's inner scroller. It works in Chrome; verify the momentum-scroll
  case on iOS before trusting it.
- **Keyboard open**: a fixed bottom bar can be pushed off-screen by the iOS
  keyboard. Not an issue today (no text inputs on these views) but it will be if
  you add a search field.

## Going further: a fully custom router

The current design keeps HA views for tabs and pages, and layers a stack on top.
That keeps the sections layout engine, one URL per view, and the per-view editor.

The alternative is one HA view containing a custom router: pages become hash
routes, and you get animated push/pop transitions like a native app. The
trade-off is real — you lose the visual editor, per-view URLs, `visibility`
conditions and the sections grid, and you own the layout engine forever.

Recommendation: don't. Add slide transitions to sheets instead, where they are
cheap and you already control the DOM. Revisit only if the tab-switch feeling
still bothers you after the sheets land.
