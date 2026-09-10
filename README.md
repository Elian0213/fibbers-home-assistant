<div align="center">

<img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/logo.svg" alt="Fibbers" width="260">

### A phone-first dashboard plugin for Home Assistant

A bottom navigation bar that stays pinned to the screen, modal sheets you drag up from the bottom,
and 25+ cards that read their own entities and match your light/dark theme. One file, installed
through HACS. It changes nothing else about your Home Assistant.

[![Validate](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/validate.yml/badge.svg)](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/validate.yml)
[![CI](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/ci.yml)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Elian0213&repository=fibbers-home-assistant&category=plugin)

<img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/hero.png" alt="A Fibbers dashboard with the pinned bottom nav bar" width="300"> &nbsp; <img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/sheet.png" alt="A light-control sheet dragged up from the bottom" width="300">

**[▶ Live demo](https://elian0213.github.io/fibbers-home-assistant/)** — every card in your browser, each with its copy-paste YAML. No Home Assistant needed.

</div>

---

## What it does

Lovelace fights a few things on a phone: the tab bar sits up top, `position: fixed` scrolls with the
page inside a view, and pinning a bar usually means scattering `card-mod` across your config. Fibbers
handles those without a theme repo, `kiosk-mode`, or `card-mod`:

- **The bottom bar stays on screen.** Fibbers renders the bar into `document.body`, so it pins to the
  window on desktop and mobile, survives momentum scroll, and respects the iOS safe-area.
- **Back remembers.** Home Assistant's back arrow returns to the dashboard root. Fibbers keeps its own
  stack in `sessionStorage`, so _Back_ returns where you came from.
- **Sheets behave.** Hash-routed bottom sheets drag to dismiss, lock and restore page scroll, and
  become centered dialogs on desktop.
- **Cards compute their own state.** Room tiles read your lights (_Off_ / _N of M on_ / _Offline_)
  with no Jinja; the alert card runs real checks for offline lights, low batteries, and pending
  updates.
- **Strings follow your Home Assistant language.** Set it once in _Settings → Profile → Language_ and
  every card follows — the same way cards follow your light/dark theme. English and Dutch ship today,
  English is the fallback. Numbers and dates use your locale; config keys stay English.
- **Cards size themselves.** Each reports its own grid size, so a Sections view lays them out with no
  `grid_options`.

Verified on Home Assistant 2026.9.x.

## Install

Fibbers is a Lovelace resource, installed through HACS.

**[▶ Open this repository in HACS](https://my.home-assistant.io/redirect/hacs_repository/?owner=Elian0213&repository=fibbers-home-assistant&category=plugin)** — one click on your own instance. Or by hand:

1. **HACS → ⋮ → Custom repositories** — add this repo's URL with category **Dashboard**.
2. Find **Fibbers** in HACS and **Download**.
3. Home Assistant usually adds the resource. If not: **Settings → Dashboards → ⋮ → Resources → Add**,
   URL `/hacsfiles/fibbers-home-assistant/fibbers.js`, type **JavaScript module**.
4. Hard-refresh the browser (Ctrl/Cmd-Shift-R).

The cards are now in the card picker — search "fibbers".

## Quick start

Paste this as a new **Sections** view. The cards size themselves, so there's no `grid_options`:

```yaml
type: sections
sections:
  - type: grid
    cards:
      - type: custom:fibbers-greeting
      - type: custom:fibbers-section
        label: Rooms
      - type: custom:fibbers-room
        name: Living room
        icon: solar:sofa-2-bold-duotone
        entities:
          - light.living_room
      - type: custom:fibbers-alert
        checks:
          - type: unavailable_lights
          - type: updates
  - type: grid
    cards:
      - type: custom:fibbers-nav
        theme: fibbers # optional — also tint HA's own chrome (cards already match your theme)
        hide_ha_tabs: true
        tabs:
          - { name: Home, icon: solar:home-2-bold-duotone, path: /lovelace/0 }
          - { name: Lights, icon: solar:lightbulb-bolt-bold-duotone, path: /lovelace/1 }
```

Thirteen cards (`nav`, `room`, `light-group`, `light-row`, `stat`, `graph`, `media`, `weather`,
`toggle`, `number`, `select`, `datetime`, `section`) also open a visual editor in the picker. The
rest are YAML-only — several are list-shaped (alert checks, chip rows, entity filters) where a form
can't help.

## The cards

25+ cards on one design-token set, so they match out of the box. Screenshots and per-card YAML are in
the **[live demo](https://elian0213.github.io/fibbers-home-assistant/)**; a static overview is in
**[docs/GALLERY.md](docs/GALLERY.md)**.

- **Shell & navigation** — `nav`, `back`, `sheet`, `section`, `greeting`
- **Rooms, lights & scenes** — `room`, `light-group`, `light-row`, `light-detail`, `scene`, `chips`
- **Status & data** — `alert`, `stat`, `graph`, `entities`, `presence`, `backup`, `weather`, `sysmon`
- **Devices** — `media`, `climate`, `remote`, `scheduler`, `alarm`
- **Inputs** — `number`, `select`, `toggle`, `datetime`

A complete "Huis" view built only from Fibbers is on the
[Usage](https://elian0213.github.io/fibbers-home-assistant/?path=/docs/getting-started-usage--docs)
page. The `remote` card and its Philips-TV notes are in [docs/remote.md](docs/remote.md).

## Theming

Cards follow your Home Assistant theme automatically — light on a light HA theme, dark on a dark one,
with no configuration. Each card reads `hass.themes.darkMode` and switches its palette to match.
Installing Fibbers changes nothing else about Home Assistant: your sidebar, header, and other
dashboards keep their own theme.

The nav card's `theme:` option is separate and optional — it tints Home Assistant's _own_ chrome (the
header, sidebar, more-info dialogs) to match the Fibbers palette, which HA won't do for a plugin on
its own:

```yaml
type: custom:fibbers-nav
theme: fibbers # fibbers (dark) · fibbers-light · auto · none (default)
tabs: [...]
```

It's injected into `hui-root` only while that dashboard is mounted, and removed when you leave, so it
never leaks into unrelated views. `auto` follows Home Assistant's own light/dark setting, falling back
to `prefers-color-scheme`.

To take it beyond the dashboard (sidebar, header, dialogs), use `theme: fibbers-global` for the
browser session, or install `themes/fibbers.yaml` as a real Home Assistant theme for a permanent,
cold-load-safe result. Add `more_info: true` to the nav to open Fibbers-styled modals for
`media_player`, `climate`, `light`, and numeric `sensor`s instead of the default more-info dialog.

## Icons

Fibbers ships the Solar Bold Duotone set (~1,325 icons). The icons the code uses are inlined in the
bundle; the first time a card names one that isn't inlined, `<fib-icon>` fetches the full set once
from `icons.full.json` (shipped next to `fibbers.js`) and caches it. `mdi:` names always work — they
fall back to Home Assistant's own `ha-icon` renderer.

## Development

Built with [Lit](https://lit.dev) and Tailwind CSS v4, bundled by Bun into a single IIFE at
`dist/fibbers.js`. Edit `src/`, then `bun run build` — never hand-edit the bundle (it's committed
because HACS serves it).

```bash
bun install
bun run build         # src/ -> dist/fibbers.js
bun run watch         # rebuild on change
bun run check         # prettier + typecheck + eslint + unit tests + build + guards
bun run test:stories  # every story as a browser test + an axe a11y pass (Vitest)
bun run storybook     # dev Storybook with live rebuild on :6007
```

Storybook is the primary way to work on cards without a Home Assistant instance — every card against a
stubbed `hass`, each state its own story. Two standalone harnesses under
[`test/fixtures/`](test/fixtures/) cover the nav-pin and `hide_ha_tabs` behaviour Storybook can't.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the architecture and release steps,
[`docs/navigation.md`](docs/navigation.md) for the nav/stack model, and
[`docs/MIGRATION.md`](docs/MIGRATION.md) for replacing your current dashboard cards.

## License

MIT © Elian Heutink
