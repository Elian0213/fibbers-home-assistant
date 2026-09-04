<div align="center">

<img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/logo.svg" alt="Fibbers" width="260">

### A phone-first, bottom-nav dashboard for Home Assistant

One HACS plugin: a bottom bar that stays pinned to the screen, a back button that remembers where
you came from, drag-away sheets, room tiles that count their own lights, and an alert card built
from real checks instead of Jinja. It reads in your language, sizes itself, and leaves the rest of
Home Assistant untouched.

26 cards, one file. No theme repo, no `kiosk-mode`, no wall of `card-mod`.

[![Validate](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/validate.yml/badge.svg)](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/validate.yml)
[![CI](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Elian0213/fibbers-home-assistant/actions/workflows/ci.yml)
[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=Elian0213&repository=fibbers-home-assistant&category=plugin)

<img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/hero.png" alt="A Fibbers dashboard with the pinned bottom nav bar" width="300"> &nbsp; <img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/sheet.png" alt="A light-control sheet dragged up from the bottom" width="300">

### [▶ Try the live demo →](https://elian0213.github.io/fibbers-home-assistant/)

Every card running in your browser, each with its copy-paste Lovelace YAML. No Home Assistant
needed. That's the reference manual; this README just gets you installed.

<a href="https://elian0213.github.io/fibbers-home-assistant/"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/storybook.png" alt="Fibbers Storybook — every card with its YAML" width="760"></a>

</div>

---

## Why

Lovelace is flexible, but a few things fight you on a phone: the tab bar sits up top,
`position: fixed` won't pin to the screen inside a view, and making it look right means
scattering `card-mod` across your config. Fibbers handles those:

- **The bottom bar stays on screen.** Inside a view a "fixed" bar actually scrolls with the
  page; Fibbers renders the bar into `document.body` so it pins to the window on desktop and
  mobile, survives momentum scroll, and respects the iOS safe-area.
- **Back remembers.** HA's back arrow always returns to the dashboard root. Fibbers keeps its own
  stack in `sessionStorage`, so _Back_ goes where you actually came from.
- **Sheets behave.** Hash-routed bottom sheets drag to dismiss, lock and restore page scroll, and
  become centered dialogs on desktop.
- **Cards do their own math.** Room tiles read your lights (_Off_ / _N of M on_ / _Offline_) with
  no Jinja; the alert card runs real checks — offline lights, low batteries, pending updates.
- **It reads in your language.** Every string follows your Home Assistant language — English by
  default, with a Dutch translation included; numbers and dates use your locale.
- **It sizes itself.** Cards report their own grid size, so a Sections view lays them out with no
  `grid_options` to hand-write.
- **It stays out of the way.** Installing Fibbers changes nothing else in your UI. An optional dark
  or light palette can be switched on per dashboard (`theme:` on the nav) — never globally.

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

Done — the 26 cards are in the card picker (search "fibbers"). Nothing else about your Home
Assistant changes.

---

## A starter view

Paste this as a new **Sections** view — no `grid_options` anywhere, the cards size themselves:

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
        theme: fibbers # optional: dark palette for just this dashboard
        hide_ha_tabs: true
        tabs:
          - { name: Home, icon: solar:home-2-bold-duotone, path: /lovelace/0 }
          - { name: Lights, icon: solar:lightbulb-bolt-bold-duotone, path: /lovelace/1 }
```

Most first-run cards — `nav`, `room`, `light-group`, `light-row`, `stat`, `toggle`, `number`,
`select`, `datetime`, `section` — also open a **visual editor** in the picker (click _Add_, fill in
the form). The rest are YAML-only for now; several are list-shaped (the alert checks, chip rows,
entity filters) where a plain form can't help. Every card has a live example and copy-paste config
in the [Storybook](https://elian0213.github.io/fibbers-home-assistant/).

---

## The cards

26 cards sharing one design-token set, so they match out of the box. On-screen strings follow your
Home Assistant language (English by default, Dutch translation included); config keys are English.

**Shell & navigation** — the app shell: a pinned bottom bar (sidebar-aware on desktop), a back button, drag-away modal sheets, a section label, and the greeting header. (The bar and an open sheet are up top.)

<img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/nav.png" alt="fibbers-nav — the bottom bar" width="620">

<table>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/greeting.png" width="240" alt="fibbers-greeting"><br><code>fibbers-greeting</code><br><sub>time-of-day header</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/back.png" width="240" alt="fibbers-back"><br><code>fibbers-back</code><br><sub>back with memory</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/section.png" width="240" alt="fibbers-section"><br><code>fibbers-section</code><br><sub>section label</sub></td>
</tr>
</table>

**Rooms, lights & scenes** — room tiles, a master light-group control, a light row with a slider, scene tiles, and action chips.

<table>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/room.png" width="240" alt="fibbers-room"><br><code>fibbers-room</code><br><sub>counts its own lights</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/light-group.png" width="240" alt="fibbers-light-group"><br><code>fibbers-light-group</code><br><sub>master + members</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/light-row.png" width="240" alt="fibbers-light-row"><br><code>fibbers-light-row</code><br><sub>brightness slider</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/scene.png" width="240" alt="fibbers-scene"><br><code>fibbers-scene</code><br><sub>scene tiles</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/chips.png" width="240" alt="fibbers-chips"><br><code>fibbers-chips</code><br><sub>action pills</sub></td>
<td></td>
</tr>
</table>

**Status & data** — an alert card from real checks, value tiles, a history sparkline, a self-filtering list, presence, backups, weather, and host telemetry.

<table>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/alert.png" width="240" alt="fibbers-alert"><br><code>fibbers-alert</code><br><sub>real checks</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/stat.png" width="240" alt="fibbers-stat"><br><code>fibbers-stat</code><br><sub>value tile</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/graph.png" width="240" alt="fibbers-graph"><br><code>fibbers-graph</code><br><sub>history sparkline</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/entities.png" width="240" alt="fibbers-entities"><br><code>fibbers-entities</code><br><sub>filtered list</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/presence.png" width="240" alt="fibbers-presence"><br><code>fibbers-presence</code><br><sub>who's home</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/backup.png" width="240" alt="fibbers-backup"><br><code>fibbers-backup</code><br><sub>backup status</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/weather.png" width="240" alt="fibbers-weather"><br><code>fibbers-weather</code><br><sub>forecast strip</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/sysmon.png" width="240" alt="fibbers-sysmon"><br><code>fibbers-sysmon</code><br><sub>host telemetry</sub></td>
<td></td>
</tr>
</table>

**Devices** — a media player, a thermostat, a wake scheduler, and a universal remote.

<table>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/media.png" width="240" alt="fibbers-media"><br><code>fibbers-media</code><br><sub>now-playing</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/climate.png" width="240" alt="fibbers-climate"><br><code>fibbers-climate</code><br><sub>thermostat</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/scheduler.png" width="240" alt="fibbers-scheduler"><br><code>fibbers-scheduler</code><br><sub>wake control</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/remote.png" width="240" alt="fibbers-remote"><br><code>fibbers-remote</code><br><sub>universal remote</sub></td>
<td></td>
<td></td>
</tr>
</table>

**Inputs & controls** — helpers for `input_number` / `input_select` / `input_boolean` / `input_datetime`.

<table>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/number.png" width="240" alt="fibbers-number"><br><code>fibbers-number</code><br><sub>slider / stepper</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/select.png" width="240" alt="fibbers-select"><br><code>fibbers-select</code><br><sub>option picker</sub></td>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/toggle.png" width="240" alt="fibbers-toggle"><br><code>fibbers-toggle</code><br><sub>switch row</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="https://raw.githubusercontent.com/Elian0213/fibbers-home-assistant/main/docs/images/cards/datetime.png" width="240" alt="fibbers-datetime"><br><code>fibbers-datetime</code><br><sub>time / date</sub></td>
<td></td>
<td></td>
</tr>
</table>

> **Every card has a live example and copy-paste YAML in the
> [Storybook](https://elian0213.github.io/fibbers-home-assistant/).** Open a card, hit
> **Show code**, copy the Lovelace config. A complete “Huis” view built only from Fibbers
> lives on the [Usage](https://elian0213.github.io/fibbers-home-assistant/?path=/docs/getting-started-usage--docs)
> page.

---

## Example views

Two views people copy first — both two-column so they fill a desktop instead of a narrow
ribbon. Swap the entity ids for your own.

**TV** — the remote on the left; now-playing, the app grid and the light scenes on the right
(where they belong, next to the TV):

```yaml
type: sections
max_columns: 2
sections:
  - type: grid
    cards:
      - type: custom:fibbers-remote
        entity: remote.living_room
        media_player: media_player.living_room # now-playing, sources, volume
        device: appletv
        sources: auto # from the player's source_list
        favourites: [Netflix, YouTube, Plex, Disney+]
        controls: # optional extra panel — see note below
          - { entity: switch.tv_screen_off, name: Screen off }
  - type: grid
    cards:
      - type: custom:fibbers-media
        entity: media_player.living_room
        compact: true
      - type: custom:fibbers-section
        label: Light
      - type: custom:fibbers-scene
        scenes:
          - { name: Movie, icon: solar:moon-bold-duotone, scene: scene.movie_light }
          - { name: Bright, icon: solar:sun-bold-duotone, scene: scene.bright }
```

The remote's Back/Home sit in their own row under the wheel, transport is
`⏮ ▶ ⏭`, and volume is a real slider when the player reports a level or a
drag-to-change **scrub strip** when it doesn't (many Apple TVs). `controls:` adds a
companion panel for anything the remote can't infer — a `select` becomes preset
chips, a `light`/`number` a slider, a `switch` a toggle.

> **🧪 Beta — TV picture-style presets.** _Dolby Vision Dark/Bright_ and picture
> brightness aren't Home Assistant entities by default (`philips_js` exposes none). On
> **Android-TV** Philips models you can expose them yourself (`pylips` / a `rest_command`
> to the JointSpace `menuitems` API) and point `controls:` at the resulting
> `select`/`number`. On **Titan OS** models (2022+, e.g. PUS7608) it's **not possible
> over the network** — the API has no picture-settings module. Which one do you have, and
> why? → **[docs/philips-tv.md](docs/philips-tv.md)** (and
> [docs/remote-commands.md](docs/remote-commands.md) for the `controls:` reference).

**Muziek** — a now-playing hero with artwork + seek bar and speaker grouping, with the TV
players in a clearly separate section:

```yaml
type: sections
max_columns: 2
sections:
  - type: grid
    cards:
      - type: custom:fibbers-media
        entity: media_player.living_room
        name: Living room
        group: # "play this here too"
          - media_player.kitchen
          - media_player.bedroom
        favourites:
          - name: Focus
            media_content_id: "spotify:playlist:37i9dQZF1DWZeKCadgRdKQ"
            media_content_type: playlist
  - type: grid
    cards:
      - type: custom:fibbers-section
        label: TV
      - type: custom:fibbers-media
        entity: media_player.living_room_tv
        compact: true
```

---

## Theming

Installing Fibbers **changes nothing** about the rest of Home Assistant — your sidebar, header and
other dashboards keep your own theme. The palette is opt-in, per dashboard, via `theme:` on the nav
card:

```yaml
type: custom:fibbers-nav
theme: fibbers # fibbers (dark) · fibbers-light · auto · none (default)
tabs: [...]
```

It's injected into `hui-root` only while that Fibbers dashboard is mounted and removed when you
leave, so it never leaks into unrelated views. `auto` follows `prefers-color-scheme`.

- Want the palette **everywhere** — every dashboard and every dialog? That's what a real HA theme
  is for: [`docs/optional-theme.yaml`](docs/optional-theme.yaml) is the same palette as a standalone
  theme you select under **Profile → Theme**.
- The old load-time global injector is still there for anyone who relied on it —
  `window.FIBBERS.injectGlobalCss()` — and `window.FIBBERS_DISABLE_GLOBAL_CSS = true` still opts out.

---

## Icons

Fibbers ships the **Solar Bold Duotone style** (~1,325 icons) in two parts, so any
`solar:<name>-bold-duotone` works without you rebuilding: the icons the code itself uses are
inlined in the bundle (a small core), and the first time a card names one that isn't in the core
`<fib-icon>` fetches the full set **once** from `icons.full.json` (shipped next to `fibbers.js`)
and caches it — no icon font, one small request per dashboard.

- **`mdi:` names always work.** HA's frontend ships MDI, so `icon: mdi:…` (or `hass:…`, a custom
  set) falls back to HA's own `ha-icon` renderer — the permanent escape hatch if the Solar set
  can't be reached.
- **Non-standard installs:** the full set is fetched from
  `/hacsfiles/fibbers-home-assistant/icons.full.json` by default. For a manual `/local/` copy or a
  differently-named HACS directory, set `window.FIBBERS_ICONS_URL = "/local/icons.full.json"` (e.g.
  from a small resource loaded before Fibbers).
- Reference a name that isn't in the Solar set — a non-duotone style (`-linear`, `-outline`, …) or
  a typo — and it can't render (HA has no `solar` iconset), so `<fib-icon>` warns once and draws a
  placeholder. If the full set fails to load (offline), it says so distinctly and retries.

`bun run check` fails if anything in `src/` or the stories references a `solar:` name that isn't in
the inlined core, so a code-path icon never depends on the fetch.

## Development

Built with **Lit** (web components) + **Tailwind CSS v4**, bundled by **Bun** into a single
IIFE at `dist/fibbers.js` — still one file HACS serves. Two generated files under
`src/generated/` are committed so the bundle is reproducible: Tailwind is compiled from
`styles/tailwind.css` (`@theme` maps the Fibbers palette) into `src/generated/tailwind.gen.js`,
then `src/shared/tw.js` builds one shared adopted stylesheet for every card’s shadow root
(hoisting Tailwind v4’s `@property` rules to the document so shadow-DOM `box-shadow` works); the
Solar icons the code references are inlined into `src/generated/icons.core.gen.js`, and the rest
of the bold-duotone style is fetched on demand from `dist/icons.full.json`.

`src/` is organised as `index.js` (the registry), `cards/<domain>/` (cards grouped by domain —
`lights`, `media`, `climate`, `sensors`, `inputs`, `layout`), `core/` (the body-portal singletons,
theming and navigation), `shared/` (widgets and helpers cards import), `generated/`, and
`translations/`.

```bash
bun install         # runtime: lit · dev: tailwindcss, prettier, eslint, @iconify-json/solar
bun run gen-tw      # styles/tailwind.css -> src/generated/tailwind.gen.js   (build runs this too)
bun run gen-icons   # @iconify-json/solar -> src/generated/icons.core.gen.js + dist/icons.full.json
bun run build       # gen-tw + src/ -> dist/fibbers.js  (single IIFE)
bun run watch       # rebuild on change
bun run lint        # eslint (flat config: @eslint/js + curated Airbnb rules + lit/wc)
bun run check       # prettier + lint + build + icon guard + parse
```

Linting is ESLint flat config (`eslint.config.js`): `@eslint/js` recommended plus a curated set of
Airbnb rules (`no-var`, `prefer-const`, `eqeqeq`, `prefer-template`, …), import ordering,
kebab-case filenames, and `eslint-plugin-lit`/`-wc` for the web components. Prettier owns
formatting.

One file to watch on a major HA upgrade: `hide-tabs.js` reaches into HA's own DOM (verified on HA
2026.8.x).

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
