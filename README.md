<div align="center">

<img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/logo.svg" alt="Fibbers" width="260">

### A bottom-nav dashboard for Home Assistant that actually feels like an app.

One HACS plugin: a **bottom navigation bar that genuinely pins to the viewport**, a real
back-stack, drag-to-dismiss **modal sheets**, self-computing **room tiles**, an **alert
card** with real logic, and the **dark theming** to match — replacing ~130 hand-written
`card-mod` blocks with a handful of clean cards.

No theme repo. No `kiosk-mode`. One file.

[![Validate](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/validate.yml/badge.svg)](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/validate.yml)
[![CI](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/ci.yml)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/hero.png" alt="Fibbers dashboard" width="300"> &nbsp; <img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/sheet.png" alt="Fibbers light sheet" width="300">

### [▶ Try the live demo →](https://elian0213.github.io/fibbers-home-assistant/)

Every card running in your browser, each with its copy-paste Lovelace YAML — no Home
Assistant needed. This is the reference; the README just gets you started.

<a href="https://elian0213.github.io/fibbers-home-assistant/"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/storybook.png" alt="Fibbers Storybook — every card with its YAML" width="760"></a>

</div>

---

## Why

Home Assistant’s Lovelace is powerful but it doesn’t give you a phone-app feel: the tab bar
is on top, `position: fixed` doesn’t pin to the screen inside a view, and “make it look nice”
means dozens of `card-mod` snippets scattered through your config. Fibbers fixes all of that:

- **A bottom bar that stays put.** Inside a Lovelace view, `position: fixed` resolves against
  the scrolling content — so a naive “fixed” bar lands at the bottom of the _page_, not the
  screen. Fibbers renders its bar into `document.body`, so it pins to the **window** on
  desktop and mobile, survives momentum scroll, and respects the iOS safe-area. It’s a
  singleton with reference counting, so tabs never stack duplicate bars.
- **A real navigation stack.** HA’s back arrow always dumps you at the dashboard root. Fibbers
  keeps a proper stack in `sessionStorage`, so _Terug_ returns to where you actually came from.
- **Modal sheets, done right.** Hash-routed bottom sheets that drag to dismiss, lock and
  restore background scroll, and become centered dialogs on desktop.
- **Cards that compute their own state.** Room tiles read your lights and show _Uit_ /
  _N van M aan_ / _Offline_ — no Jinja in your config. The alert card runs real checks
  (offline lights, low batteries, pending updates) instead of 20 lines of templating.
- **Theming without a second repo.** The plugin injects the whole dark theme globally, so
  even a tapped light’s _more-info_ dialog matches. No separate theme to install and select.

Verified working on **Home Assistant 2026.8.x**.

---

## Install

Fibbers is a **Dashboard** plugin (a Lovelace resource), installed through HACS.

1. **HACS → ⋮ → Custom repositories**, add this repo’s URL with category **Dashboard**.
2. Find **Fibbers** in HACS and **Download**.
3. HA usually adds the resource for you. If not: **Settings → Dashboards → ⋮ → Resources →
   Add**, URL `/hacsfiles/fibbers-home-assistant/fibbers.js`, type **JavaScript module**.
4. Hard-refresh the browser (Ctrl/Cmd-Shift-R).

That’s it — the cards and the theming load together.

---

## The cards

Nine cards, all sharing one design-token set so they match exactly. Every user-facing string
is Dutch (it’s a home dashboard); config keys are English.

| Card                    | What it does                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`fibbers-nav`**       | The bottom bar — pins to the viewport, lights the active tab from the URL, optional notification badge. Can hide HA’s own tabs (`hide_ha_tabs`) without kiosk-mode. |
| **`fibbers-back`**      | A _Terug_ control that reads the real navigation stack — “Terug naar Meer”, not the dashboard root.                                                                 |
| **`fibbers-room`**      | A room tile that reads its own lights: _Uit_ / _N van M aan_ / _Offline_, glows green when lit. Tap opens its sheet.                                                |
| **`fibbers-sheet`**     | A hash-routed modal (`#woonkamer`) that drags to dismiss and holds a stack of cards; a centered dialog on desktop.                                                  |
| **`fibbers-light-row`** | A light with a brightness slider — `Warm · 70%` / `Kleur · 80%` / `Onbereikbaar`; the icon box runs any HA action.                                                  |
| **`fibbers-alert`**     | “Aandacht nodig” as real logic — offline lights, low batteries, pending updates, stale backups. Green tick when all clear.                                          |
| **`fibbers-chips`**     | A pill row of quick actions, each with an optional `active_when` tint.                                                                                              |
| **`fibbers-scene`**     | Scene tiles that highlight the most recently applied scene.                                                                                                         |
| **`fibbers-section`**   | A small uppercase section label.                                                                                                                                    |

> **Every card has a live example and copy-paste YAML in the
> [Storybook](https://elian0213.github.io/fibbers-home-assistant/).** Open a card, hit
> **Show code**, copy the Lovelace config. A complete “Huis” view built only from Fibbers
> lives on the [Usage](https://elian0213.github.io/fibbers-home-assistant/?path=/docs/getting-started-usage--docs)
> page.

---

## Theming

Loading the plugin injects the full dark theme globally (`<style id="fibbers-global">` on
`document.head`, HA theme vars set on `html` with `!important` so it beats HA’s inline
theme). Tapping a light opens a _more-info_ dialog on the same dark surface with green
controls — **no separate theme repo to install or select.**

- Turn it off with `window.FIBBERS_DISABLE_GLOBAL_CSS = true` before the plugin loads.
- Prefer a real, user-selectable HA theme? [`docs/optional-theme.yaml`](docs/optional-theme.yaml)
  is the same palette as a standalone theme — genuinely optional.

---

## Icons

Fibbers ships **Solar Bold Duotone** icons (`solar:*`), inlined into the bundle at build
time — no network, no icon font. Any HA icon still works too: give a card `icon: mdi:…`
(or `hass:…`, a custom set) and it falls back to HA’s own `ha-icon` renderer. Only the ~25
Solar icons the project uses are bundled (a few KB), listed in
[`scripts/icon-map.json`](scripts/icon-map.json); add a line there and run `bun run
gen-icons` to inline another.

## Development

No framework, no runtime dependencies. Source is small vanilla ES modules under `src/`,
bundled by **Bun** into a single IIFE at `dist/fibbers.js`. Solar icons come from the
`@iconify-json/solar` dev package, extracted into the committed `src/icons.gen.js`.

```bash
bun install         # dev: prettier + @iconify-json/solar
bun run gen-icons   # scripts/icon-map.json -> src/icons.gen.js (only when adding icons)
bun run build       # src/ -> dist/fibbers.js  (IIFE, no minify)
bun run watch       # rebuild on change
bun run check       # prettier + build + parse
```

Iterate without a Home Assistant instance:

- **Storybook** (`cd storybook && npm i && npm run storybook`) — every card against a stubbed
  `hass`, each state as its own story, with the Lovelace YAML under **Show code**. This is the
  primary way to work on the cards; it’s also what ships to [GitHub Pages](https://elian0213.github.io/fibbers-home-assistant/).
- **`docs/preview.html`** — a dependency-free single-file harness: every card against a stubbed
  `hass`, with toggles for lit / offline / low-battery / update states. `?test=1` runs scripted
  stack + duplicate + detach assertions in-page.
- **`docs/fixture.html`** — proves the bar pins by reproducing Lovelace’s containing block,
  with a deliberately-naive in-tree control that must fail.
- **`docs/hatabs-fixture.html`** — asserts the six `hide_ha_tabs` acceptance criteria.

`dist/fibbers.js` is a generated artifact but is committed on purpose — HACS serves it.
**Edit `src/`, then `bun run build`; never hand-edit the bundle.**

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the architecture, design tokens, HA gotchas and
release steps; [`docs/navigation.md`](docs/navigation.md) for the nav model and the full iOS
bug checklist; and [`docs/MIGRATION.md`](docs/MIGRATION.md) for replacing your current
dashboard cards.

## License

MIT © Elian Heutink
