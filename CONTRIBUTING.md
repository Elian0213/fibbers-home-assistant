# Contributing to Fibbers

Thanks for taking a look. This is a single Home Assistant HACS **Dashboard (plugin)**
repository — one JS bundle that ships custom cards _and_ the global theming for a dark,
app-like dashboard.

## Architecture at a glance

- **Vanilla web components**, no framework, **zero runtime dependencies**. Source lives in
  `src/` as small ES modules and is bundled into a single committed IIFE at `dist/fibbers.js`
  by `bun build` — no transpile, no minify, no polyfills.
- **Everything a user loads ships from `dist/fibbers.js`.** It's a generated artifact but is
  committed on purpose (HACS serves it). **Edit `src/`, run `bun run build`; never hand-edit
  the bundle.**
- Anything that must pin to the viewport (nav bar, sheet, backdrop) renders into
  `document.body`, because inside a Lovelace view `position: fixed` resolves against the
  scrolling content box, not the window. Body-rendered elements are singletons with reference
  counting so multiple card instances (one per view) never stack duplicates.

## Build & test

```bash
bun install
bun run gen-icons   # only when adding icons — regenerates src/icons.gen.js from Solar
bun run build       # src/ -> dist/fibbers.js (IIFE)
bun run watch       # rebuild on change
bun run check       # prettier --check + build + parse
```

There is no Home Assistant instance required to develop. **Storybook** (`cd storybook && npm i &&
npm run storybook`) is the primary tool — every card, each state as its own story, YAML under
**Show code**. Two standalone harnesses cover behaviour Storybook can't (they load
`../dist/fibbers.js` against a stubbed `hass`, no network):

- **`docs/fixture.html`** — proves the nav bar pins by reproducing Lovelace's containing block
  (a transformed ancestor), with a deliberately-naive in-tree control that _must_ fail.
- **`docs/hatabs-fixture.html`** — asserts the six `hide_ha_tabs` acceptance criteria.

CI runs prettier, the build, a **"dist is in sync with src"** check (`git diff --exit-code
dist/fibbers.js`), and a parse check — so always `bun run build` and commit `dist/` with your
`src/` change.

## Design tokens

Defined once in `src/tokens.js` and emitted per shadow root by `styleBlock()`. Use the exact
values; new cards read `var(--fib-x)`.

```
--fib-bg          #111516   page ground          --fib-accent      #74B98A   brand accent (soft green)
--fib-card        #1D2426   card surface         --fib-accent-bg   #17281C   green tint (icon-on box)
--fib-card-2      #262F31   chip / inset         --fib-accent-line #2B4A34   green tint border
--fib-line        #333E41   borders              --fib-accent-tx   #CFE6D5   text on green tint
--fib-ink         #EDF1F1   primary text         --fib-amber       #E8A33D   WARNING only (alert)
--fib-ink-2       #A9B6B9   secondary text       --fib-blue        #5AAFD6   info / active-secondary
--fib-muted       #7D8B8E   labels/inactive      --fib-green        #63C295   success
--fib-sheet       #171E20   sheet surface        --fib-red          #EC8377   error / offline
--fib-nav         #161C1E   bottom bar surface   --fib-grab         #3E4A4D   sheet grab handle
```

Semantics: **green** = brand / active / positive, **amber** = attention/warning (the alert card
only), **red** = error, **blue** = info. Lit rooms/scenes glow
`linear-gradient(145deg,#1E3427,#132016)` with a `#2E5238` border.

## Home Assistant gotchas (learned the hard way)

- **`position: fixed` doesn't pin to the viewport inside a view** — render viewport-pinned
  chrome into `document.body`. This is the single most important constraint here.
- **HA sets theme variables inline on `document.documentElement`**, so the global CSS injector
  must use `html { --x: … !important }` to win. Custom properties inherit into shadow DOM,
  which is how it restyles more-info dialogs.
- **`ha-icon` is globally available** in HA; outside HA (the harnesses) it's stubbed. Fibbers'
  own icons use `<fib-icon>`, which inlines Solar SVGs or falls back to `ha-icon` for `mdi:`.
- **"Updates pending" is the `update` domain, not a named entity** — count `states.update`
  with state `on`.
- `set hass` fires on **every** state change in the house — diff the entities you care about
  and bail early.

## Adding an icon

The full Solar Bold Duotone style is bundled, so just use `icon: solar:<name>-bold-duotone` in a
card — no generator step. `bun run check` fails if a card or story references a name that isn't a
real bold-duotone icon (or a non-duotone Solar style). Any `mdi:` / `hass:` icon still works too
(rendered by HA's `ha-icon`).

## Releasing

1. Bump `version` in `package.json` (and the bundle banner) and update `CHANGELOG.md`.
2. `bun run check` (prettier + eslint + build + icon guard + parse), commit, push to `main` — CI +
   HACS validation run.
3. Tag and push: `git tag v0.4.0 && git push origin v0.4.0` (the **release** workflow also accepts a
   bare `0.4.0` tag). It cuts a GitHub Release (what HACS reads).
4. Set the repo description + topics (required by HACS), once:
   ```bash
   gh repo edit Elian0213/fibbers-home-assistant \
     --description "A bottom-nav dashboard plugin for Home Assistant: viewport-pinned bar, modal sheets, self-computing room tiles, dark theming." \
     --add-topic home-assistant --add-topic lovelace --add-topic hacs --add-topic custom-card
   ```
5. **Default HACS store** (optional, one-time, manual): open a PR adding the repo to
   [`hacs/default`](https://github.com/hacs/default) under `plugin`, alphabetically. Until then
   users install via **HACS → Custom repositories** (category **Dashboard**).

## License

By contributing you agree your contributions are licensed under the [MIT License](LICENSE).
