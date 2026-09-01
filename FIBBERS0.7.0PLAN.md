# Fibbers 0.7.0 — accessibility, and the media cards

Paste into Claude Code in `fibbers-home-assistant`.

Two unrelated things, both measured on a live 8-view dashboard running 0.6.0 on
HA 2026.8.3.

---

# Part 0 — HACS store readiness (the audit, first)

I checked the repo against every requirement on hacs.xyz. **It passes all of them.**

| Requirement | State |
|---|---|
| Public, on GitHub, not archived | ✅ |
| Repository description | ✅ 163 chars |
| Issues enabled | ✅ |
| Topics defined | ✅ (one is wrong, see below) |
| README with images | ✅ hero, sheet, nav, storybook + per-card shots |
| Full GitHub **releases**, not just tags | ✅ 6 releases; 0.4–0.6 carry an asset |
| Valid `hacs.json` with `name` | ✅ |
| HACS Action passes | ✅ green on `main` **and** on the `0.6.0` tag |
| Listed in `hacs/default` | ❌ **not submitted** |

So the only thing standing between this and a one-click install is the submission
PR. Two small fixes first:

- [ ] **Drop the `hacs-integration` topic.** This is a Dashboard plugin, not an
      integration; the topic is misleading and will confuse reviewers. Current
      topics: `ha`, `hacs-custom`, `hacs-dashboard`, `hacs-integration`,
      `homeassistant`. Add `lovelace`, `custom-cards`.
- [ ] **Sanity-check the filename rule.** HACS wants a `.js` matching the repo
      name; the repo is `fibbers-home-assistant`, the file is `dist/fibbers.js`.
      This is legal because `hacs.json` declares `filename`, and the Action is
      green — but state it in the PR so a reviewer doesn't bounce it.
- [ ] Open the PR against `hacs/default` adding the repo to `plugin`. Personal
      account, new branch, template filled in.

Nothing else is blocking. Everything below is quality, not eligibility.

---

# Part 1 — Accessibility (the real gap)

The store doesn't check this, and it's the weakest part of the plugin. Measured
across 25 rendered cards on one view:

| | Count |
|---|---|
| Clickable elements | 91 |
| Reachable by keyboard | **24** |
| With an `aria-label` | **1** |
| Slider-like elements | 15 |
| Sliders with `role="slider"` / `aria-valuenow` | **0** |

So roughly two thirds of the controls cannot be reached by keyboard at all, and
**every brightness and volume slider is invisible to a screen reader and inert to
arrow keys.** For a plugin whose whole premise is "the chrome your household
touches", that matters — and it's the kind of thing that gets raised loudly once
the repo is in the default store.

- [ ] **Sliders** (`light-row`, `light-group`, `number`, `media` volume): add
      `role="slider"`, `aria-valuemin/max/now`, `aria-label`, `tabindex="0"`, and
      arrow-key handling (←/→ or ↑/↓ by `step`, Home/End to min/max, PageUp/Down
      for a larger jump). This is the single highest-value fix.
- [ ] **Every clickable becomes a real control.** Use `<button type="button">`
      where it's an action; otherwise `role="button"` + `tabindex="0"` +
      Enter/Space handlers. Covers chips, scene tiles, room tiles, nav tabs,
      remote buttons, the sheet close button and the light-group chevron.
- [ ] **Labels.** `aria-label` on every icon-only control — the remote's d-pad,
      the media transport, the chevron, the nav tabs. One label across 91 controls
      is effectively none.
- [ ] **Focus visible.** A token-coloured `:focus-visible` ring that survives the
      dark and light palettes. Do not remove outlines without replacing them.
- [ ] **Nav** is a tab bar: `role="tablist"` / `role="tab"` / `aria-selected`,
      arrow-key movement between tabs.
- [ ] **Sheet** is a dialog: `role="dialog"`, `aria-modal="true"`, focus moves in
      on open, is trapped while open, and returns to the opener on close. Escape
      already works.
- [ ] Honour `prefers-reduced-motion` for the sheet transition and the
      light-group expand.
- [ ] Add a short `docs/accessibility.md` stating what is supported — it signals
      the project takes this seriously.

---

# Part 2 — `fibbers-remote` is the worst card in the set

Looking at the TV tab: two remotes stacked, rendering **the identical 11-button
layout**, distinguishable only by a small label. Tiny circular buttons floating in
whitespace, no d-pad affordance, an ambiguous left-arrow that could be Back or
Previous, and a 4px green dot for OK.

The functional miss is bigger than the visual one. Current config surface is just
`entity`, `commands`, `name`, `language` — and the card contains **no reference to
`source_list` or `select_source` anywhere**. Meanwhile:

```
media_player.living_room   (Apple TV)   playing Netflix   source_list: 26 entries
```

**26 launchable apps, and the card exposes none of them.** Switching input or
launching an app is the most common thing anyone does with a TV after volume.

- [ ] **Real d-pad.** One circular control — up/right/down/left as arc segments
      around a solid centre OK. It should look like a d-pad, not four separate
      dots. Minimum 44×44px touch targets.
- [ ] **Sources / apps.** New `sources:` block driving `select_source`, rendered
      as a chip row or grid with the active one highlighted; `sources: auto`
      derives from `source_list`. Optional `favourites:` to pin the four you use.
- [ ] **Now-playing header** inside the card: power state, current app or source,
      and `media_title` when present. Right now nothing tells you the TV is even on.
- [ ] **Volume as a slider** where `volume_set` is supported, with mute; fall back
      to +/− buttons where it isn't.
- [ ] **Per-device identity.** A `device:` hint (`philips` | `appletv` | `generic`)
      or simply the icon + accent so two remotes on one page are instantly
      distinguishable.
- [ ] **Channel / transport split.** Keep transport (play/pause/skip) separate from
      navigation; today they're one undifferentiated row.
- [ ] Long-press repeat on volume and channel.

---

# Part 3 — `fibbers-media` needs the two things a music page is for

The card already handles artwork correctly (`entity_picture` / `media_image`) —
the generic note on my dashboard is just Sonos sitting `idle`, not a bug. What it
lacks:

- [ ] **Progress.** No `media_position` / `media_duration` handling at all. A
      music card without a seek bar and elapsed/remaining is half a card. Include
      the drift correction (`media_position_updated_at`) so it doesn't jump.
- [ ] **Speaker grouping.** `media_player.eetkamer` exposes `group_members`, and
      the card has no `join`/`unjoin`. For Sonos this is a headline feature —
      "play this in the kitchen too" is the whole point of multiroom.
- [ ] **Queue / browse** via `media_player.browse_media`, at least one level deep,
      so favourites are reachable without leaving the dashboard.
- [ ] **Correct iconography in `compact`.** A TV playing Netflix currently shows a
      music note. Derive the icon from the entity's domain and `app_name`.
- [ ] The two transport buttons in compact mode read as near-identical glyphs;
      differentiate play/pause from next.

---

# Part 4 — the tabs themselves (dashboard-side, but ship examples)

Both pages waste most of the screen. TV is `max_columns: 1`, so on a 1739px
display it's a 500px ribbon with ~1000px of dead space. Muziek fills about 40% of
the viewport and the rest is empty.

Ship these as worked examples in the README / Storybook, since they're the two
views people will copy:

- [ ] **TV**: two columns — remote left, and right a stack of *Nu speelt*, the
      source/app grid, and the light-scene chips (Filmlicht etc. belong next to
      the TV, not below it).
- [ ] **Muziek**: now-playing with large artwork and a seek bar as the hero,
      speaker/group control beside it, favourites as an artwork grid rather than
      text chips, and the TV players in a clearly separate section.

---

# Acceptance

1. Tab through a Fibbers dashboard using only the keyboard: every control is
   reachable, has a visible focus ring, and sliders respond to arrow keys.
2. A screen reader announces each slider with a name and a percentage.
3. The Apple TV's 26 sources are selectable from `fibbers-remote`, active one
   highlighted.
4. Two remotes on one page are distinguishable at a glance.
5. `fibbers-media` shows a working seek bar and can group a second Sonos speaker.
6. The TV and Muziek example views fill a desktop viewport sensibly.
7. `hacs/default` PR open.

Then bump CHANGELOG and tag `0.7.0`.
