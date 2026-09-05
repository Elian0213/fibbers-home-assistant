# Accessibility

Fibbers aims to be fully operable by keyboard and legible to a screen reader.
This page states what's supported as of 0.9.0; if you hit a gap, please open an
issue — it's treated as a bug, not a nice-to-have.

## Keyboard

- **Every control is reachable by Tab** and shows a visible focus ring (an
  accent-coloured `:focus-visible` outline that reads on the dark and light
  palettes). Controls that aren't native buttons (`role="button"` rows/tiles)
  carry `tabindex` and activate on **Enter / Space**.
- **Sliders** (brightness on `fibbers-light-row`, `fibbers-light-group` and
  `fibbers-light-detail`, the `fibbers-number` value, and `fibbers-media` volume)
  are real `role="slider"` widgets:
  - **← / ↓** and **→ / ↑** adjust by one step,
  - **Page Down / Page Up** by a larger jump (a tenth of the range),
  - **Home / End** jump to min / max.
- **The light-detail colour wheel** is a `role="slider"`: **arrow keys** adjust the
  **focused** lamp's hue / saturation (or, for a tunable-white lamp, its colour
  temperature — warm ↔ cool). Which lamp the wheel drives is chosen from the **lamp
  tiles** below it — each a `role="button"` reachable by Tab and activated with
  **Enter / Space** — so a keyboard user picks a lamp on a tile, then tunes it with the
  wheel's arrows. If the focused lamp is part of a **group** the arrows move the whole
  group; tapping its tile pops it back out. Opened from a room the modal becomes two
  columns on a wide screen; the content and tab order are unchanged.
- **The nav bar is a tablist**: **← / →** (and Home / End) move focus between
  tabs, **Enter / Space** activates one; the active tab carries
  `aria-selected` / `aria-current`.
- **The sheet is a modal dialog**: opening it moves focus onto the dialog and
  traps it there; **Esc** or the close button dismisses it and returns focus to
  the control that opened it.

## Screen readers

- Sliders announce a name and a value (`aria-valuenow` + a `%` / unit
  `aria-valuetext`).
- Icon-only controls (media transport, the setpoint −/+, the remote buttons, the
  nav tabs, the sheet close button) carry an `aria-label`.
- The sheet is announced as a dialog with its title as the accessible name.
- On-screen text follows your Home Assistant language (see the i18n section of
  the README).

## Motion

- `prefers-reduced-motion: reduce` is honoured: card transitions, the sheet
  slide, and the nav-bar animation are suppressed for users who ask for it.

## Known limitations

- Screen-reader `aria-label`s on a few icon-only controls are currently English
  regardless of the HA language; on-screen text is fully localised. Localising
  those labels is planned.
- The sheet focus trap keeps focus inside the dialog but does not yet implement a
  strict forward/back tab cycle across the nested card shadow roots.
- On the light-detail colour wheel the individual lamp **markers** aren't
  separately focusable; keyboard users select which lamp to tune (and un-group a
  lamp) from the lamp tiles, then use the wheel's arrow keys. Grouping lamps by
  dragging their markers together is pointer-only — the keyboard equivalent (adjust
  each lamp to the same value) is still reachable, just not a single gesture.
