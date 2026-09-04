# Changelog

All notable changes to this project are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [0.8.2] — 2026-09-04

Sliders you can actually hit on a phone, a Fibbers modal in place of Home
Assistant's more-info dialog, and an option to paint all of HA green.

### Added

- **A live value bubble on every slider.** Drag any slider and a tooltip above the
  knob shows the live percentage/value; the knob is bigger (and grows while you
  drag) so it's easier to grab precisely. Every slider also updates the entity
  _live_ as you drag (debounced, no snap-back) — the media seek and volume sliders
  were the last to only commit on release; now they match the rest.
- **`theme: fibbers-global` on `fibbers-nav`** — the Fibbers palette across _all_ of
  Home Assistant (sidebar, header, Settings, dialogs), not just the dashboard.
  `fibbers-global-light` is the light variant. Any other value leaves HA's own theme
  untouched, so it's fully opt-out.
- **`more_info: true` on `fibbers-nav`** — replaces HA's more-info dialog with a
  Fibbers-styled modal for the domains Fibbers renders well: `media_player`,
  `climate`, `light`, and a numeric `sensor` (current value + a 24-hour history graph
  with min/max/change). Every other domain falls through to HA's own (themed) dialog.
  Off by default.

### Changed

- Expanded light-group members are tighter — the member rows no longer stack a 44px
  name row on top of the 44px slider, so a group doesn't leave big gaps between lamps.

## [0.8.1] — 2026-09-04

A touch/a11y patch for 0.8.0's remote and the shared sliders, plus a full
Storybook documentation pass.

### Fixed

- **The volume scrub's keyboard path was unthrottled** — a held arrow key fired one
  relative `volume_up` per OS auto-repeat (~30/s), and with relative steps there's no
  last-write-wins to save you. The scrub's two ends are now real Volume−/Volume+
  buttons (the middle groove is an aria-hidden drag surface): keyboard is native
  button activation, throttled 120ms, and a screen reader announces the buttons
  instead of an inert "volume, group".
- **Sliders no longer eat a vertical page swipe.** The brightness/number/volume
  slider surfaces were `touch-action: none`, so a touch starting on a full-width 44px
  band couldn't scroll the page — up to ~27% of a view's height on a phone. They're
  now `pan-y`: a vertical swipe scrolls, a horizontal drag still works the control.
- **The SVG d-pad wheel flashed a rectangular tap-highlight** on press. The touch
  polish that was nav-bar-only (`-webkit-tap-highlight-color`, `user-select`,
  `touch-action: manipulation`) now applies to every card control.
- **The select dropdown scroll-chained** into the page/sheet behind it once the
  option list hit its end — now `overscroll-behavior: contain`.

### Docs

- Storybook brought up to date: the remote gains full 0.8.x coverage (scrub, controls
  panel, multi-device, speaker, grid, generic), and every card story now covers its
  meaningful states (65 → 150 variants across 26 cards). The remote's full option list
  and the `controls:` panel are documented in the README, Usage, and
  `docs/remote-commands.md`, and the card gallery screenshots are refreshed.

## [0.8.0] — 2026-09-03

`fibbers-remote` gets its below-the-wheel half rebuilt. Everything under the d-pad
was one undifferentiated zone — Back and Home were jammed into the media-transport
strip (so they read as "missing"), and a device that reports no volume level fell
back to a cramped `− VOL +` stepper. The wheel and header are untouched.

### Changed

- **Navigation and transport are now separate groups.** Back / Home / Menu sit in
  their own labelled row directly under the wheel; the transport strip below it holds
  only Previous · Play/Pause · Next. Nav belongs with the d-pad, not with playback —
  and Back/Home are finally unmistakable. Speakers (no d-pad) drop the nav row
  cleanly; Menu still shows only when it's a command distinct from Back.

### Added

- **A slider-shaped volume scrub strip** for devices that don't report a
  `volume_level` (e.g. an Apple TV whose player exposes `volume_up`/`down` but no
  level). Full-width, same height as the real slider: drag to change, tap a side to
  step, hold to repeat, arrow keys to nudge. Honest — it never invents a thumb
  position the device can't give. Fixes the old stepper's missing long-press repeat
  and its dead 38px of empty space. Players that _do_ report a level keep the real
  positional slider.
- **An optional per-device `controls:` panel** in the companion column, for the
  extras a remote can't infer. Each entry is `{ entity, name?, icon?, type? }`,
  rendered by domain: `select`/`input_select` → preset chips (e.g. a TV picture-style
  select), `light`/`number` → a drag slider, `switch`/`input_boolean` → a toggle,
  `button`/`scene` → a press. Reuses the existing slider/chip/hold primitives; unknown
  entities are skipped so a stale id leaves no dead row.

## [0.7.6] — 2026-09-03

A small patch: the last two undebounced sliders, two timing defects in 0.7.5's
shared style injector, and one shared drag gesture instead of four copies.

### Fixed

- **The light-row and remote-volume sliders were still undebounced on the keyboard
  path** — holding an arrow key fired ~30 `light.turn_on` / `volume_set` calls a
  second (this is what made the lights feel laggy). Both now match the other
  sliders: the display advances immediately, the write is debounced 150ms, and a
  pending write is dropped on unmount — and, on the remote, on a device switch, so
  a volume meant for device A can't land on device B.
- **Drag behaviour unified**: all four value sliders now live-track during a drag
  (~4px slop, then debounced writes as you move, final value wins on release) —
  previously the group master dimmed the room mid-drag while an individual light
  row did nothing until you lifted.
- **The shared style injector could latch onto `document.body` permanently** when a
  dashboard loaded before HA's panel resolver mounted — a whole-document subtree
  observer, exactly the cost the 0.7.5 refactor removed. It now re-targets onto the
  panel as soon as it exists.
- **The sheet scroll lock is retried.** It used to be a one-shot: if `hui-root`
  wasn't resolvable the instant a sheet opened, the background kept scrolling
  behind it for the life of that sheet. It now routes through the shared injector
  and gets the retry/re-render resilience for free.
- The d-pad hub no longer announces "OK" twice to screen readers.

### Internal

- The drag-gesture bookkeeping shared by light-row, light-group, number and the
  remote volume is one `sliderDrag()` helper in `shared/ui.js` (next to
  `SliderHold`) instead of four copies; an implicit `lostpointercapture` after
  `pointerup` is a no-op by construction. `hui-inject`'s unused `repaint` export
  is gone.

## [0.7.5] — 2026-09-03

A redesigned remote, and a long list of functional fixes across the media/remote,
sheets, sliders and the global side-effects.

### Changed

- **The remote is redesigned — flat and Fibbers-native.** The d-pad is one SVG donut
  with four true annular sectors (real arc paths, so the outer edge is the circle and
  the gaps are true radial channels — no clip-path corner-clipping), each sector a
  ≥44px button; a 3×3 grid remains as `dpad: grid`. Everything sits below the wheel in
  use order — switcher, header (with a 44×44 power key), one segmented transport strip
  (no floating circles, no dangling divider), a single volume row that swaps slider ⇄
  −/VOL/+ stepper without changing height, channel, sources. The body is capped at
  320px and centred; on a wide card a 600px container query moves the sources into a
  second column — but only when there are sources, so a speaker stays one column with
  no dead space.

### Fixed

- **Remote volume no longer snaps back on release** — the drag's `onCancel` was
  clearing the value it had just set (an implicit `lostpointercapture` fires right
  after `pointerup`).
- **Transport routes to whatever can actually run it.** Each button gates on the
  media_player feature bit (`PLAY`/`PAUSE`/`PREVIOUS_TRACK`/`NEXT_TRACK`) and prefers
  that path, else the remote command — so an Android TV whose player lacks the track
  bits uses `remote.send_command MEDIA_NEXT` instead of a call HA rejects.
- **D-pad keyboard works in `dpad: both`** — Enter on a focused arrow no longer sends
  OK. Source chips (remote + media) gate on `SELECT_SOURCE`, the media group row on
  `GROUPING`, and every fire-and-forget service call now handles its promise.
- **`fibbers-media`'s volume slider** gates on a reported `volume_level`, not just the
  `VOLUME_SET` bit, so a CEC/volume-only player no longer shows a slider parked at 0%.
- **Sheets:** Escape and the focus-trap yield to an HA dialog opened on top (more-info,
  Material dialogs, native `<dialog>`); switching `#a`→`#b` closes `#a` first and keeps
  the real opener; a hash change mid-load can't append `#a`'s cards into `#b`; and focus
  returns to the trigger even when the last sheet unregisters while open.
- **Keyboard slider steps** on `number`/`light-group` are debounced (they fired ~30
  service calls a second on auto-repeat) while still accumulating on screen; a disabled
  slider no longer announces a value to screen readers.
- **Icons survive a failed fetch** — a dropped `icons.full.json` request now retries and
  reports that the set couldn't be *loaded* (not that your icon name is wrong), instead
  of turning every non-core icon into a permanent question mark. The fetch URL is
  overridable via `window.FIBBERS_ICONS_URL`.
- **Globals & teardown:** the nav-stack route listeners run only while a nav bar or
  back card is mounted (loading the resource can no longer push Settings onto the back
  stack); the nav bar disconnects its ResizeObserver and resets its scroll state on
  detach; external `url` actions open with `noopener,noreferrer`.

### Internal

- The three hui-root style injectors (hide-tabs, view-reserve, theme) now share one
  observer + debounce via `core/hui-inject.js` instead of running three each. Tab
  hiding covers older HA tab strips (`ha-tabs`/`paper-tabs`/`sl-tab-group`) with a
  diagnostic when nothing matched.

## [0.7.4] — 2026-09-02

One remote for every device, honest touch targets, and a bundle a fraction of the
size.

### Added

- **`fibbers-remote` holds many devices.** Give it a `devices:` list and it draws a
  segmented switcher (a real tablist, with a live on/off dot per device) instead of
  one card per TV. A speaker with only a `media_player:` (no remote entity) is a
  valid device — it shows transport + volume and no d-pad. `remember:` keeps the
  last device per browser; `auto_select: playing` jumps to whatever's playing on
  mount. A single-`entity:` config from 0.7.x is unchanged (no switcher).
- **A volume slider wherever the device reports a level.** One row shape across all
  devices so the card doesn't jump on switch: a draggable slider when the player
  reports `volume_level` (mute only when `VOLUME_MUTE` is supported), otherwise
  − / + for step-only players.
- **`dpad: grid`** — a 3×3 d-pad option alongside the circle/swipe surface.

### Fixed

- **The d-pad no longer paints outside the card.** It was sized with `min(72vw,…)`
  — the viewport, not the card — so on a wide screen it overflowed a narrow cell by
  ~61px. Layout is now container-relative and, on a wide card, container-queries
  into a tidy two-column arrangement.
- **Touch targets are a real 44px.** Tailwind's `h-11`/`h-12` are rem-based and
  render 38.5/42px on a 14px root; a single `--fib-hit: 44px` knob now sizes the
  sliders and remote buttons in absolute px. Wrapping chip rows got a wider vertical
  gap so their 44px hit boxes stop overlapping the row below.
- **The nav bar is a navigation landmark, not a fake tablist** — its buttons
  navigate away, so `role=tablist`/`tab`/`aria-selected` were wrong; plain buttons
  with `aria-current=page` remain.
- The remote's volume hold now releases when the player drops out mid-drag; the
  `SliderHold` controller is reused across `setConfig` in every card (it was leaking
  one per editor keystroke); `fibbers-number`'s hold tolerance scales to the
  entity's range.

### Changed

- **Bundle: 2.27MB → ~0.37MB.** The 1325-icon Solar set was 91% of it and loaded
  eagerly; now only the icons the code uses ship in the bundle, and the full set is
  fetched once on demand from a sibling `icons.full.json`. Any YAML config can still
  name any Solar icon.

## [0.7.3] — 2026-09-02

A full audit pass against a live HA 2026.8 install — bigger touch targets, real
more-info from sheets, a working Apple-TV power button, and a long tail of
correctness fixes.

### Fixed

- **Sliders are far easier to hit.** The brightness / number / volume tracks now
  carry a full 44px-tall transparent hit area around the 6px painted bar, and the
  sub-44px controls (chips, day chips, light-row icon, chevrons, media prev/next,
  remote mute/power, number ±, sheet close) get a shared `.fib-hit` expander.
- **More-info opens from sheets and the nav bar.** Those render into
  `document.body` (a sibling of `<home-assistant>`), so a bubbling `hass-more-info`
  never reached HA's listener — it's now dispatched at `<home-assistant>` directly.
  The sheet scroll-lock moved off `<body>` onto hui-root's `#view`, so HA's own
  dialogs lay out correctly over an open sheet.
- **Apple-TV (and other) power works.** The remote power button now calls the
  remote entity's real `turn_on`/`turn_off`/`toggle` from its own state instead of
  sending a bogus transport command; the card dims and short-circuits when the
  remote is unavailable, resets its derived platform on reconfigure, and renders
  Back/Menu once when aliased.
- **Weather forecast returns.** `fibbers-weather` subscribes to
  `weather/subscribe_forecast` (the `forecast` attribute was removed in HA 2024.4)
  and unsubscribes on disconnect.
- **Sparklines don't flash "no history".** `fibbers-graph` / `fibbers-sysmon` show a
  skeleton until a fetch actually settles, retry fast on a cold miss, expire the
  cache so a wall tablet isn't frozen at page-load, and discard stale responses.
- **Media controls match the player.** Transport, seek and volume are gated on the
  player's `supported_features`, so a CEC TV with no volume no longer shows a dead
  slider; the now-playing title falls back through `app_name`/`source`.
- **A shadowed `t` no longer breaks a stale-backup alert.** `alert.js` reused the
  i18n helper's name for a timestamp; ESLint `no-shadow` now guards against it.
- **Slider commit lifecycle.** A failed service call clears the optimistic hold
  instead of freezing on it; a tap no longer streams a value on press; on/off-only
  lights render a toggle; the group average ignores brightness-less members.
- Empty nav/sheet grid rows collapse; `clamp` no longer yields `NaN`; scheduler /
  datetime parse `HH:MM` strictly; climate handles heat_cool and unavailability;
  entity-picture URLs are escaped; entities sort by locale and localise their
  secondary text; plus a batch of smaller correctness fixes across the cards and
  the nav/theme/tabs/view-reserve infrastructure.

### Changed

- **Quieter bundle.** The build compiles Lit in production mode
  (`--conditions=production`), dropping its dev-mode warnings and asserts. Output
  stays an unminified single IIFE so the committed bundle reproduces byte-for-byte
  in CI regardless of the bundler's minifier version.
- Global listeners in the theme / tab-hiding / view-reserve modules bind only while
  their feature is active, so a default dashboard does no per-navigation work.

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
