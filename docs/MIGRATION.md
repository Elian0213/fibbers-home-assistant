# Migrating the live dashboard to Fibbers

Which Fibbers card replaces each thing in the current `dashboard-thuis` / Lab config, and
what `card-mod` / plugin cruft you can delete once it’s in.

## Card-for-card

| Today                                                                                    | Replace with               | Notes                                                                                                   |
| ---------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Bubble Card `horizontal-buttons-stack` (bottom nav) + ~60 lines of `!important` per view | `custom:fibbers-nav`       | One card per view, same `tabs`. The pinning, safe-area, tap-delay and duplicate-bar fixes are built in. |
| A back button templated with `card-mod`                                                  | `custom:fibbers-back`      | Uses a real nav stack; `labels:` name the origin view.                                                  |
| Bubble Card `pop-up`                                                                     | `custom:fibbers-sheet`     | Hash-routed (`#id`), drag-to-dismiss, scroll-locking, desktop dialog.                                   |
| `mushroom-template-card` + a templated `card-mod` block (room tile)                      | `custom:fibbers-room`      | Computes `Uit` / `N van M aan` / `Offline` itself — delete the Jinja.                                   |
| `mushroom-light-card` inside pop-ups                                                     | `custom:fibbers-light-row` | Brightness slider bound to `brightness_pct`.                                                            |
| `markdown` card with ~20 lines of Jinja (“Aandacht nodig”)                               | `custom:fibbers-alert`     | Config-driven `checks:`; `updates` counts the whole `update` domain.                                    |
| `heading` card + `card-mod`                                                              | `custom:fibbers-section`   | Just the label.                                                                                         |
| `mushroom-chips-card` + `card-mod`                                                       | `custom:fibbers-chips`     | Standard HA action objects; `active_when` for the blue tint.                                            |
| `mushroom-template-card` with `layout: vertical` (scenes)                                | `custom:fibbers-scene`     | Highlights the last-applied scene.                                                                      |

## Plugins you can drop

- **`kiosk-mode`** on the Lab dashboard → `hide_ha_tabs: true` (or `"header"`) on
  `fibbers-nav`. Keep `kiosk_mode: {hide_header: true, hide_sidebar: true}` on
  `dashboard-thuis` until _that_ dashboard is migrated too.
  - Note: the old `?disable_km` escape hatch no longer un-hides via kiosk-mode. Fibbers
    honours `?disable_km` itself, and adds `window.FIBBERS_SHOW_TABS = true` — the muscle
    memory keeps working.
- **The separate Fibbers theme** (if you ever installed one) → the plugin injects it. Only
  keep `docs/optional-theme.yaml` in `/config/themes/` if you specifically want a
  user-selectable theme.

## The `card-mod` blocks that become deletable

Once the cards above are in, every `card-mod` block that was only doing Fibbers styling can
go — section-heading typography, room-tile gradients, chip pills, the nav bar `!important`
stack, and the pop-up surface/scrim overrides (now handled by the global injector). Anything
in `card-mod-root` / `card-mod-theme` that matches the palette in
[`optional-theme.yaml`](optional-theme.yaml) is redundant.

## Suggested order

1. Add `fibbers-nav` to one view with `hide_ha_tabs: true`; confirm the bar pins and the top
   tabs are gone. Remove that view’s Bubble nav + `card-mod`.
2. Convert the room tiles + their pop-ups to `fibbers-room` + `fibbers-sheet` +
   `fibbers-light-row`.
3. Swap the alert markdown, chips and scenes.
4. Delete `kiosk-mode` from the Lab dashboard.
5. Repeat the nav on the remaining views.
