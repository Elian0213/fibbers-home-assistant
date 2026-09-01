# Accessibility

Fibbers aims to be fully operable by keyboard and legible to a screen reader.
This page states what's supported as of 0.7.0; if you hit a gap, please open an
issue — it's treated as a bug, not a nice-to-have.

## Keyboard

- **Every control is reachable by Tab** and shows a visible focus ring (an
  accent-coloured `:focus-visible` outline that reads on the dark and light
  palettes). Controls that aren't native buttons (`role="button"` rows/tiles)
  carry `tabindex` and activate on **Enter / Space**.
- **Sliders** (brightness on `fibbers-light-row` and `fibbers-light-group`, the
  `fibbers-number` value, and `fibbers-media` volume) are real
  `role="slider"` widgets:
  - **← / ↓** and **→ / ↑** adjust by one step,
  - **Page Down / Page Up** by a larger jump (a tenth of the range),
  - **Home / End** jump to min / max.
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
