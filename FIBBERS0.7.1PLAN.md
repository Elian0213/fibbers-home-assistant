# Fibbers 0.7.1 — patch

Paste into Claude Code in `fibbers-home-assistant`.

Small, focused follow-up to 0.7.0. Three code fixes and the paperwork that's been
carried since 0.6.0. Measured on a live 8-view dashboard running 0.7.0 on
HA 2026.8.3.

0.7.0 is in good shape — this is not a rescue release. Full sweep across eight
views: zero error cards, zero placeholder icons, zero cards behind the nav bar,
zero `grid_options`. Sliders went from 0 of 15 instrumented to 8 of 8, and the nav
is a correct tablist with roving tabindex. What follows is what's left.

---

## 1. `fibbers-remote` — sources have no overflow, so most apps are unreachable

The card renders exactly the `favourites` you list and nothing else. There is no
"more" affordance anywhere in its shadow root.

Concretely, on my Apple TV:

```
media_player.living_room   source_list: 26 entries
fibbers-remote favourites: 6   →   the other 20 apps cannot be reached
```

Adding an app currently means editing YAML. That's the one thing on the rebuilt TV
tab that still sends you back to the config.

**`fibbers-scene` already solves this exact problem** — `favourites: 6` renders six
tiles plus an "Alle 11 scènes" drawer. The remote should reuse that component and
that wording, not invent a second pattern.

- [ ] When `sources` resolves to more entries than `favourites` shows, render the
      favourites plus a drawer toggle labelled with the existing scene string
      (`Alle {n} …` / `Minder`), opening the full list.
- [ ] Highlight the active source in both the favourite row and the drawer, using
      the same treatment `fibbers-scene` gives the active scene.
- [ ] Keyboard: the toggle is a real button; the drawer list is arrow-navigable and
      Escape closes it.
- [ ] Same treatment for `fibbers-media`'s `sources`, so the two media cards behave
      identically.

**Done when** all 26 Apple TV apps are reachable from the dashboard without
touching YAML.

---

## 2. Two accessibility stragglers from 0.7.0

The sweep is much better, but two tap targets are still mouse-only. Both are
elements with `cursor: pointer`, `tabindex="-1"` and no `role`, with no control
ancestor:

**`fibbers-light-row`** — the name/value area:

```
div.flex.cursor-pointer.items-baseline…   tabindex=-1   aria-label: none
```

The icon box is a proper button, but the row body — the part most people actually
tap — is not reachable by keyboard and is announced as nothing.

**`fibbers-alert`** — the finding rows. Four of them on my Huis view. Tapping a
finding opens more-info for the entity behind it, which is a genuinely useful
action that keyboard users can't perform.

- [ ] Give both a real control: `role="button"`, `tabindex="0"`, Enter/Space, and
      an `aria-label` naming what it opens (e.g. *"Gitaarlamp — meer info"*).
- [ ] While you're in there: decorative SVG inside `fib-icon` inherits
      `cursor: pointer` and shows up as a stack of pseudo-interactive `path`
      elements. Add `pointer-events: none` to the glyph so hit-testing and any
      future audit both see one target, not six.

**Done when** an audit for "cursor:pointer with no control ancestor" returns zero
across every view. It currently returns 4 on Huis and 1 per light row on Licht.

---

## 3. Ship the HACS submission

Carried since 0.6.0. `docs/HACS_SUBMISSION.md` is written; the PR isn't filed.

The repo passes every published requirement — public, description, issues,
topics, README with images, six full releases, valid `hacs.json`, and the HACS
Action green on `main` and on the tag. The only gap is that it isn't in
`hacs/default`, so every user still adds it as a custom repository by URL.

- [ ] Drop the **`hacs-integration`** topic — this is a Dashboard plugin and the
      topic misleads reviewers. Add `lovelace` and `custom-cards`.
- [ ] File the PR against `hacs/default` adding the repo to `plugin`. Personal
      account, new branch, template completed. Note in the description that
      `dist/fibbers.js` doesn't match the repo name but is declared via
      `hacs.json`'s `filename` key, and that the Action passes — pre-empting the
      most likely review question.

---

## Acceptance

1. All 26 Apple TV sources reachable from `fibbers-remote`, active one highlighted,
   drawer keyboard-operable.
2. `fibbers-media` sources behave the same way.
3. Zero "clickable but not a control" elements across all views.
4. Tabbing through a light row reaches the icon **and** the name/value target, each
   announcing what it does.
5. `hacs/default` PR open; topics corrected.

Then bump CHANGELOG and tag `0.7.1`.

---

## Deliberately not in this patch

- **Bundle size** (2.27 MB, ~½ MB gzipped). A known, documented 0.3.0 trade-off for
  offline robustness. Revisit only if someone reports it.
- **Sonos grouping in `fibbers-media`.** Shipped in 0.7.0 but I could not verify it
  — this house has exactly one group-capable speaker, so there is nothing to group
  with. Needs a second speaker to test, not a code change.
- **`fibbers-climate`.** Still the only card never rendered here; no `climate.*`
  entity exists to test against.
