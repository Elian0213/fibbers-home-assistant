# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [0.7.2] — 2026-09-02

Two real bugs, sliders and the remote.

### Fixed

- **Sliders no longer snap back on release.** Releasing a slider showed the
  entity's *old* value for one round trip (drag a lamp to 70% → 70 → 5 → 70;
  worst on a media seek bar). A shared `SliderHold` controller now holds the
  committed value on screen until the entity catches up (within a tolerance) or a
  timeout, clearing if it goes unavailable. Fixed once for `fibbers-light-row`,
  `fibbers-light-group`, `fibbers-number`, `fibbers-media` (volume **and** seek)
  and the remote volume.
- **`fibbers-remote` now sends the right commands.** It shipped Android-TV command
  names (`DPAD_UP`, `HOME`, …) for every device, so the Apple TV remote was
  entirely non-functional (pyatv rejects them) and Philips silently no-op'd.
  Commands are now per-platform and **derived from the entity's integration**
  (`apple_tv` → pyatv lowercase, `philips_js` → `Cursor*`/`Standby`, Android TV →
  `DPAD_*`); `device:`/`commands:` override. Unsupported buttons aren't rendered,
  a rejected command is logged (once, with the platform) and flashes the button.
- **`sliderTrack` no longer commits on a cancelled gesture.** `pointercancel` fell
  through to `onUp`; it now aborts, and `lostpointercapture` (real on mobile) is
  handled the same.

### Changed

- **The remote is usable now.** Responsive d-pad (`min(72vw, 260px)`), every
  control ≥44px (power was 36px), a bigger OK, an optional swipe surface for the
  Siri remote (`dpad: swipe | buttons | both`), and bounded long-press repeat
  (~3/s, capped, stops on cancel/lost-capture/tab-hide) instead of ~7/s unbounded.
- `docs/remote-commands.md` documents the per-device command families and how to
  self-diagnose a new platform.

## [0.7.1] — 2026-09-01

Small follow-up to 0.7.0.

### Added

- **Source drawer** on `fibbers-remote` and `fibbers-media`: the cards show the
  collapsed row (the remote's `favourites`, or the first 8 for media) plus a
  drawer toggle — reusing `fibbers-scene`'s "All {n}" / "Less" wording — that
  reveals the full `source_list`, so every app is reachable without editing YAML.
  The active source is highlighted in both, and the drawer is keyboard-operable
  (arrows between chips, Escape to close). `fibbers-media` gains `sources: auto`.

### Fixed

- **Accessibility stragglers.** The last mouse-only tap targets — `fibbers-light-row`'s
  name/value area and `fibbers-alert`'s finding rows — are now real controls
  (`role="button"`, `tabindex`, Enter/Space, an aria-label naming what they open).
  `fib-icon` glyphs are `pointer-events: none`, so hit-testing sees one target per
  control instead of a stack of SVG paths.

### Known

- The `hacs/default` submission PR (and the repo topic fix: drop `hacs-integration`,
  add `lovelace` + `custom-cards`) is still the maintainer's to file — see
  `docs/HACS_SUBMISSION.md`.

## [0.7.0] — 2026-09-01

Accessibility, and the two media cards.

### Added

- **Accessibility.** The whole set is now keyboard-operable and screen-reader
  legible:
  - Sliders (light-row/light-group brightness, number, media & remote volume) are
    real `role="slider"` widgets with `aria-valuenow`/`aria-valuetext` and
    arrow / Home / End / PageUp-Down keys.
  - `role="button"` rows/tiles get `tabindex` + Enter/Space; icon-only controls
    get an `aria-label`; a shared accent `:focus-visible` ring reads on both
    palettes.
  - `fibbers-nav` is a tablist (`role="tab"`, `aria-selected`, roving arrow
    keys); `fibbers-sheet` is a dialog that moves focus in, traps it, and returns
    it to the opener on close.
  - `prefers-reduced-motion` is honoured across the cards, nav and sheet.
  - New `docs/accessibility.md`.
- **`fibbers-remote` rewrite.** A round d-pad (≥44px targets) with a centre OK; an
  optional `media_player:` drives a now-playing header, a `select_source` grid
  (`sources: auto` from `source_list`, `favourites:` to pin) and a volume slider
  with mute; channel/volume have press-and-hold repeat; transport is split from
  navigation; `device:` (philips|appletv|generic) distinguishes two remotes.
- **`fibbers-media`**: a drift-corrected seek bar (`media_position` +
  `media_position_updated_at`, live tick) with elapsed/remaining and `media_seek`;
  speaker grouping via `group:` (join/unjoin); a `favourites:` grid
  (`play_media`); a content-derived compact icon (a TV playing Netflix no longer
  shows a music note); an accent play/pause button in compact.
- README **TV** and **Muziek** worked example views (two-column).

### Fixed

- Two Dutch strings that escaped 0.6.0's i18n — `fibbers-scene`'s drawer
  ("Minder" / "Alle N scènes") and the sheet's close/error labels. `check-i18n`
  now also scans the body-portal modules so they can't regress.

### Known

- `fibbers-remote` sources/volume and `fibbers-media` seek/grouping/`play_media`
  need a real device to verify. The `hacs/default` submission PR (and the repo
  topic fix) are still open — see `docs/HACS_SUBMISSION.md`.

## [0.6.0] — 2026-09-01

"Installs clean, works for strangers" — the release that makes Fibbers safe to hand to someone who
isn't the author, on any language and theme.

### Added

- **Internationalisation.** Every on-screen string now flows through a tiny `t()` layer
  (`src/i18n.js`) with per-card English (`en.json`) and Dutch (`nl.json`) catalogs — **English is
  the default**, Dutch is a translation. Language resolves from `hass.locale.language` (with
  base-language then English fallback); numbers and dates follow the user's locale. Optional per-card
  `language:` override. A build guard (`check-i18n`) fails on a hard-coded Dutch string.
- **Opt-in theming.** A `theme:` option on `fibbers-nav` (`fibbers` | `fibbers-light` | `auto` |
  `none`, default `none`) applies the dark palette or a new, contrast-checked **light** palette,
  scoped to that dashboard's `hui-root` and removed when you leave. `auto` follows
  `prefers-color-scheme`.
- **Zero-config sizing.** Every card implements `getGridOptions()` (content cards size to
  `rows: "auto"`), so a Sections view lays out bare cards with no hand-written `grid_options`.
- **Card-picker previews.** All 26 cards register `preview: true` with a `documentationURL`, and
  `getStubConfig(hass, entities, entitiesFallback)` derives a real entity from the user's system
  instead of a hard-coded id.
- **Visual editors.** `nav`, `room`, `light-group`, `light-row`, `stat`, `toggle`, `number`,
  `select`, `datetime` and `section` open an `ha-form` editor in the picker (shared `src/editor.js`,
  byte-identical round-trip); the rest stay YAML-only.
- **`extra_bottom`** on `fibbers-nav` — breathing room added on top of the *measured* bar height
  (`reserve` remains the absolute override).

### Changed

- **Installing Fibbers no longer restyles Home Assistant.** The load-time global theme injector is
  off by default (still callable via `window.FIBBERS.injectGlobalCss()`; `FIBBERS_DISABLE_GLOBAL_CSS`
  still honoured). Cards carry their own palette, so they look right with zero global effect.
- **The nav bar reserves its space on the view, not via an in-flow spacer.** On a multi-column
  Sections view the last card is no longer hidden behind the bar, and the `column_span` workaround
  is unnecessary.

### Fixed

- **`fibbers-stat`** rendered a `device_class: timestamp` as an overflowing absolute date; it now
  shows relative time (`<ha-relative-time>`), with `absolute_time: true` to opt out.

### Tooling

- `bun run check` gains the `check-i18n` guard; ESLint resolves the `.json` translation imports.

## [0.5.0] — 2026-09-01

### Added

- **`fibbers-light-group`** — a master light control that reads as heavier than a lamp row: a card
  surface with a room icon and a taller master slider (`brightness_pct` on the group, debounced,
  absolute), that expands to show its members as nested `fibbers-light-row`s. Mixed brightness shows
  the average with a striped fill; a partially-offline group stays usable (`3 van 4 aan · 1 offline`);
  members can be given explicitly or derived from the group (stale ids with no state are skipped).
  Works without a group helper via `entities:`.
- **`fibbers-nav`** is now sidebar-aware on desktop: it insets its start edge past Home Assistant's
  docked sidebar (so the leftmost tab is no longer hidden behind it) and follows the sidebar as it
  expands / collapses. It stays full-width on narrow (modal-drawer) layouts and when the sidebar is
  hidden. Opt out with `respect_sidebar: false`.

## [0.4.0] — 2026-09-01

### Added

- **`fibbers-number`** — a drag slider (or −/+ stepper) for `input_number`/`number`, respecting
  min/max/step, with debounced writes (dragging no longer fires a call per pixel).
- **`fibbers-select`** — an option picker for `input_select`/`select`: a chip row for a few
  options, a self-styled dropdown for many. Never falls through to `ha-select`.
- **`fibbers-toggle`** — a switch row for `input_boolean`/`switch`/`automation` using the shared
  pill switch (now lifted out of `fibbers-scheduler`); optional secondary line and `confirm`.
- **`fibbers-datetime`** — a big legible `input_datetime` value (time/date/both); tap opens
  more-info to edit.
- **`fibbers-greeting`** — a Dutch time-of-day header with a lights / presence / sensor subline,
  replacing a 15-line Jinja `markdown` card. Light groups are expanded to their members (a group
  is not counted as one bulb) and offline lights are counted separately.

That brings the set to **25 cards**.

### Fixed

- **`fibbers-stat` / `fibbers-sysmon`** printed raw internal state for non-numeric entities
  (`binary_sensor` → `off`, timestamps → an ISO string, `NaN`). Non-numeric states now go through
  Home Assistant's own `formatEntityState`; the numeric decimals/unit path is unchanged.
- **`fibbers-alert`** `exclude_pattern` matched only `entity_id`, case-sensitively — so a natural
  `iPhone` never matched a lowercase id. It is now compiled once (case-insensitive) and tested
  against `entity_id` **and** friendly name; `unavailable_lights` gained the same option.
- **`fibbers-graph` / `fibbers-sysmon`** cached the "fetched" flag before the request resolved, so
  one empty cold-load response disabled the sparkline for the card's whole lifetime. The flag is
  now set only after rows arrive, with an 8-second backoff.
- **Nav** — the active-tab highlight is capped to content width, so it no longer becomes a ~290px
  slab in a wide flex cell on desktop.

### Internal / tooling

- Added **ESLint** (flat config: `@eslint/js` + a curated set of Airbnb best-practices + import
  ordering + kebab-case filenames + `eslint-plugin-lit`/`-wc`; Prettier owns formatting).
  `bun run check` and CI now run it.
- DRY: the drag slider (light-row / number / media) shares `sliderTrack` + `pctFromX`; the graph +
  sysmon history fetch shares `fetchHistory`; five inlined `unavailable` checks now use `isUnavail`.
- CI runs the full `bun run check` (restores the icon guard, adds lint); the release workflow now
  fires on bare `0.x.0` tags too; build-input deps pinned for deterministic regeneration.

### Known

- The bundle ships the full Solar bold-duotone set (~2.2 MB, ~½ MB gzipped) — a deliberate 0.3.0
  choice for offline/ingress robustness. A future subset+opt-in build could shrink it; not planned
  yet.

## [0.3.0] — 2026-09-01

### Fixed

- **Icons no longer go blank on HACS installs.** Fibbers now bundles the **entire Solar Bold
  Duotone style** (~1,325 icons) instead of a hand-curated ~57-icon subset, so any
  `solar:<name>-bold-duotone` referenced in a dashboard renders out of the box — no rebuild
  needed. Previously only the icons the maintainer had baked in shipped, so any other Solar name
  rendered as an empty glyph (invisible on desktop, a missing icon on the phone/app). Adds ~½ MB
  gzipped to the bundle — a one-time, per-version cached download; still one file, still no
  external network.
- **`fibbers-entities`** no longer crashes on an invalid `entity_id` regex — the pattern is now
  compiled and validated once in `setConfig` (a clear config error) instead of being rebuilt for
  every entity on every render.
- Fixed a leaked `orientationchange` listener that accumulated on repeated dashboard mounts, and
  guarded `fibbers-scheduler`'s service calls against a missing `hass`.

### Changed

- Retired `scripts/icon-map.json`: `gen-icons` now emits the whole bold-duotone style from
  `@iconify-json/solar`, so coverage is no longer curated by hand. `<fib-icon>`'s warn +
  placeholder and the `bun run check` guard now catch only non-duotone styles (`-linear`, …) or
  typos.

## [0.2.0] — 2026-09-01

Rebuilt on a real component framework and rounded out the card set.

### Cards

- **`fibbers-media`** — a `media_player` card: now-playing (art/title/artist), transport
  (prev / play-pause / next), a drag volume slider, favourite `sources` chips, and a compact
  "Nu bezig" variant.
- **`fibbers-sysmon`** — host/Pi telemetry tiles (cpu / temp / disk / ram / …) with an optional
  history sparkline.
- **`fibbers-climate`** — a thermostat: current temp + hvac action, setpoint −/+
  (`climate.set_temperature`), and hvac-mode chips.
- **`fibbers-scheduler`** — a wake/alarm control over `input_datetime` / `input_boolean` /
  `input_number` helpers: time, enable toggle, fade window, weekday chips.
- **`fibbers-remote`** — a universal remote: power, D-pad, back/home/menu and volume/playback
  via `remote.send_command`.

That brings the set to **20 cards**, all sharing one Tailwind design-token set.

### Changed

- **Migrated the whole plugin to Lit + Tailwind CSS v4.** Every card is a `LitElement`; styling
  comes from one shared adopted `CSSStyleSheet` per shadow root (compiled from
  `styles/tailwind.css`, with Tailwind v4's `@property` rules hoisted to the document so
  shadow-DOM `box-shadow` works). The bundle now depends on `lit` at runtime — the previous
  "vanilla / zero runtime dependencies" claim no longer applies.
- README rewritten for the 20-card set and the real Lit/Tailwind build pipeline; new
  card-gallery hero screenshot.

### Fixed

- **`fibbers-room`** — the long-press timer is now cleared on disconnect, so a pending hold can
  no longer open more-info on an unmounted tile.
- **`fibbers-graph`** — colours survive Tailwind's purge: the stroke class is now a static
  full-string map, so `text-blue` (and the other accents) render instead of being stripped.
- **`fib-icon`** — an un-bundled `solar:` name no longer renders as a silent blank (HA has no
  `solar` iconset): it now warns once and draws a placeholder glyph. A new build guard fails
  `bun run check` if `src/` or the stories reference an un-baked `solar:` name.

## [0.1.0] — 2026-08-31

First public release.

### Cards

- **`fibbers-nav`** — a bottom navigation bar genuinely pinned to the viewport (renders into
  `document.body` to escape Lovelace's scrolling content box), with a singleton + reference
  counting so tabs never stack duplicates. Options: `hide_ha_tabs` (drop `kiosk-mode`),
  `offset_bottom`, `auto_hide`, per-tab notification `badge`.
- **`fibbers-back`** — a back control driven by a real navigation stack (`sessionStorage`),
  naming the view you actually came from.
- **`fibbers-sheet`** — a hash-routed modal bottom sheet: drag-to-dismiss, background scroll
  lock + restore, and a centered dialog on ≥640px. Renders child cards via `loadCardHelpers()`.
- **`fibbers-section`** — the uppercase mono section label.
- **`fibbers-room`** — a room tile that computes its own state (`Uit` / `N van M aan` /
  `Offline`), glows green when lit, opens a sheet on tap and more-info on hold.
- **`fibbers-light-row`** — a light row with a brightness slider and a configurable icon
  action button (`icon_tap_action` / `icon_entity`, default: toggle).
- **`fibbers-alert`** — the "Aandacht nodig" card as real checks (`unavailable_lights`,
  `low_battery`, `updates`, `backup_age`) instead of Jinja.
- **`fibbers-chips`** — an action pill row with standard HA action objects and `active_when`.
- **`fibbers-scene`** — scene tiles that highlight the most recently applied scene.

### Theming & icons

- Global CSS injector applies the full dark theme (HA theme vars on `html` with `!important`),
  so even more-info dialogs match — no separate theme repo, no `card-mod` needed.
- **Soft forest-green** brand accent; amber retained only for warnings.
- **Solar Bold Duotone** icons, inlined at build time (no runtime network) via `<fib-icon>`,
  with a transparent fallback to HA's own `ha-icon` for any `mdi:` / `hass:` icon.

### Engineering

- Vanilla web components, **zero runtime dependencies**; `src/` bundled to a single IIFE
  `dist/fibbers.js` by `bun build` (no transpile, no minify).
- Standalone browser harnesses (`docs/preview.html`, `docs/fixture.html`,
  `docs/hatabs-fixture.html`) with scripted in-page assertions — no Home Assistant required.
