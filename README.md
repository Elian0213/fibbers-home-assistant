<div align="center">

<img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/logo.svg" alt="Fibbers" width="260">

### A bottom-nav dashboard for Home Assistant that behaves like an app

One HACS plugin. A **bottom bar that actually stays put**, a back button that remembers where
you came from, **sheets you can flick away**, **room tiles that count their own lights**, and an
**alert card that checks real things** instead of 20 lines of Jinja. Matching dark theme in the
box.

Twenty cards where you used to have ~130 `card-mod` blocks. No theme repo, no `kiosk-mode`, one
file.

[![Validate](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/validate.yml/badge.svg)](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/validate.yml)
[![CI](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/ci.yml)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Elian0213&repository=fibbers-home-assistant&category=plugin)

<img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/hero.png" alt="Fibbers dashboard" width="300"> &nbsp; <img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/sheet.png" alt="Fibbers light sheet" width="300">

### [▶ Try the live demo →](https://elian0213.github.io/fibbers-home-assistant/)

Every card running in your browser, each with its copy-paste Lovelace YAML. No Home Assistant
needed. That's the reference manual; this README just gets you installed.

<a href="https://elian0213.github.io/fibbers-home-assistant/"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/storybook.png" alt="Fibbers Storybook — every card with its YAML" width="760"></a>

</div>

---

## Why

Lovelace can do a lot, but it won't give you a phone-app feel out of the box: the tab bar sits
on top, `position: fixed` won't pin to the screen inside a view, and "make it look nice" turns
into `card-mod` snippets sprinkled across your config. Fibbers takes all of that off your
plate:

- **A bottom bar that stays put.** Inside a Lovelace view, `position: fixed` resolves against
  the scrolling content, so a naive "fixed" bar sinks to the bottom of the _page_, not the
  screen. Fibbers renders its bar into `document.body`, so it pins to the **window** on desktop
  and mobile, survives momentum scroll, and respects the iOS safe-area. It's a singleton with
  reference counting, so switching tabs never leaves you with two bars.
- **A back button with a memory.** HA's back arrow always dumps you at the dashboard root.
  Fibbers keeps a real stack in `sessionStorage`, so _Terug_ goes back to where you came from.
- **Sheets that behave.** Hash-routed bottom sheets that drag to dismiss, lock and restore
  background scroll, and turn into centered dialogs on desktop.
- **Cards that do their own math.** Room tiles read your lights and show _Uit_ / _N van M aan_ /
  _Offline_ with no Jinja in your config. The alert card runs real checks (offline lights, low
  batteries, pending updates) instead of a templating essay.
- **Theming without a second repo.** The plugin injects the dark theme globally, so even a
  tapped light's _more-info_ dialog matches. Nothing separate to install and select.

Verified on **Home Assistant 2026.8.x**.

---

## Install

Fibbers is a **Dashboard** plugin (a Lovelace resource), installed through HACS.

**[▶ Open this repository in HACS](https://my.home-assistant.io/redirect/hacs_repository/?owner=Elian0213&repository=fibbers-home-assistant&category=plugin)** — one click on your own instance. Or the manual route:

1. **HACS → ⋮ → Custom repositories**, add this repo’s URL with category **Dashboard**.
2. Find **Fibbers** in HACS and **Download**.
3. HA usually adds the resource for you. If not: **Settings → Dashboards → ⋮ → Resources →
   Add**, URL `/hacsfiles/fibbers-home-assistant/fibbers.js`, type **JavaScript module**.
4. Hard-refresh the browser (Ctrl/Cmd-Shift-R).

Done. The cards and the theming load together.

---

## The cards

Twenty cards, all sharing one Tailwind design-token set so they match exactly. Every user-facing
string is Dutch (it’s a home dashboard); config keys are English.

**Shell & navigation**

| Card                  | What it does                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`fibbers-nav`**     | The bottom bar — pins to the viewport, lights the active tab from the URL, optional notification badge. Can hide HA’s own tabs (`hide_ha_tabs`) without kiosk-mode. |
| **`fibbers-back`**    | A _Terug_ control that reads the real navigation stack — “Terug naar Meer”, not the dashboard root.                                                                 |
| **`fibbers-sheet`**   | A hash-routed modal (`#woonkamer`) that drags to dismiss and holds a stack of cards; a centered dialog on desktop.                                                  |
| **`fibbers-section`** | A small uppercase section label.                                                                                                                                    |

**Rooms, lights & scenes**

| Card                    | What it does                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **`fibbers-room`**      | A room tile that reads its own lights: _Uit_ / _N van M aan_ / _Offline_, glows green when lit. Tap opens its sheet. |
| **`fibbers-light-row`** | A light with a brightness slider — `Warm · 70%` / `Kleur · 80%` / `Onbereikbaar`; the icon box runs any HA action.   |
| **`fibbers-scene`**     | Scene tiles, active one highlighted; `favourites: N` keeps the rest behind an “Alle N scènes” drawer.                |
| **`fibbers-chips`**     | A pill row of quick actions, each with an optional `active_when` tint.                                               |

**Status & data**

| Card                   | What it does                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **`fibbers-alert`**    | “Aandacht nodig” as real logic — offline lights, low batteries, pending updates, stale backups. Green tick when all clear. |
| **`fibbers-stat`**     | A value tile — icon, label, big value + unit, optional trend. The building block for the rest.                             |
| **`fibbers-graph`**    | A single-entity sparkline from history (or inline `data`), with min/max.                                                   |
| **`fibbers-entities`** | A self-maintaining filtered list (the `auto-entities` replacement) — by domain/state/attribute/regex/staleness.            |
| **`fibbers-presence`** | Person tiles + a “Niemand thuis / N thuis” summary.                                                                        |
| **`fibbers-backup`**   | Backup status — last run, result, next; amber when stale.                                                                  |
| **`fibbers-weather`**  | Current conditions + a short forecast strip.                                                                               |
| **`fibbers-sysmon`**   | Host/Pi telemetry tiles (cpu/temp/disk/ram/…) + an optional sparkline.                                                     |

**Devices**

| Card                    | What it does                                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **`fibbers-media`**     | A media player — now-playing, transport, volume, favourite sources; a compact “Nu bezig” variant.                          |
| **`fibbers-climate`**   | A thermostat — current temp, setpoint −/+, hvac-mode chips.                                                                |
| **`fibbers-scheduler`** | A wake/alarm control that drives your `input_datetime`/`input_boolean` helpers — time, enable, fade window, weekday chips. |
| **`fibbers-remote`**    | A universal remote — power, D-pad, back/home/menu, volume/playback via `remote.send_command`.                              |

> **Every card has a live example and copy-paste YAML in the
> [Storybook](https://elian0213.github.io/fibbers-home-assistant/).** Open a card, hit
> **Show code**, copy the Lovelace config. A complete “Huis” view built only from Fibbers
> lives on the [Usage](https://elian0213.github.io/fibbers-home-assistant/?path=/docs/getting-started-usage--docs)
> page.

---

## Theming

Loading the plugin injects the dark theme globally (`<style id="fibbers-global">` on
`document.head`, HA theme vars set on `html` with `!important` so it beats HA's inline theme).
Tapping a light opens a _more-info_ dialog on the same dark surface with green controls, so
there's **no separate theme repo to install or select.**

- Turn it off with `window.FIBBERS_DISABLE_GLOBAL_CSS = true` before the plugin loads.
- Want a real, user-selectable HA theme instead? [`docs/optional-theme.yaml`](docs/optional-theme.yaml)
  is the same palette as a standalone theme. Optional, and it stays that way.

---

## Icons

Fibbers ships **Solar Bold Duotone** icons (`solar:*`), inlined into the bundle at build
time — no network, no icon font. Any HA icon still works too: give a card `icon: mdi:…`
(or `hass:…`, a custom set) and it falls back to HA’s own `ha-icon` renderer. Only the Solar
icons the project actually uses are bundled (a few KB), listed in
[`scripts/icon-map.json`](scripts/icon-map.json); add a line there and run `bun run
gen-icons` to inline another.

## Development

Built with **Lit** (web components) + **Tailwind CSS v4**, bundled by **Bun** into a single
IIFE at `dist/fibbers.js` — still one file HACS serves, no external fetch. Two generated files
are committed so the bundle is reproducible: Tailwind is compiled from `styles/tailwind.css`
(`@theme` maps the Fibbers palette) into `src/tailwind.gen.js`, then `src/tw.js` builds one
shared adopted stylesheet for every card’s shadow root (hoisting Tailwind v4’s `@property` rules
to the document so shadow-DOM `box-shadow` works); Solar icons are inlined into
`src/icons.gen.js`.

```bash
bun install         # runtime: lit · dev: tailwindcss, prettier, @iconify-json/solar
bun run gen-tw      # styles/tailwind.css -> src/tailwind.gen.js   (build runs this too)
bun run gen-icons   # scripts/icon-map.json -> src/icons.gen.js    (when adding icons)
bun run build       # gen-tw + src/ -> dist/fibbers.js  (single IIFE)
bun run watch       # rebuild on change
bun run check       # prettier + build + parse
```

Iterate without a Home Assistant instance:

- **Storybook** (`cd storybook && npm i && npm run storybook`) — every card against a stubbed
  `hass`, each state as its own story, with the Lovelace YAML under **Show code**. This is the
  primary way to work on the cards; it’s also what ships to [GitHub Pages](https://elian0213.github.io/fibbers-home-assistant/).
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
