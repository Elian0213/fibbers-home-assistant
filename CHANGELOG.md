# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

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
