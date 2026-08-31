# `hide_ha_tabs` — suppressing Home Assistant's tab strip

A card that owns bottom navigation has an obvious reason to hide HA's top tab
strip. `kiosk-mode` can only do `hide_header`, which is all-or-nothing: it takes
the hamburger and the edit pencil with it. This is the surgical version, and it
removes the kiosk-mode dependency for this dashboard.

## Verified DOM — HA 2026.8.3, inspected live on 31 Aug 2026

Do not trust older tutorials; the element name changed. As of 2026.8.3 the tab
strip is **`ha-tab-group`** (not `ha-tabs`, not `sl-tab-group`, not
`paper-tabs`). Confirmed by walking the live shadow DOM:

```
home-assistant
  └─ (shadow) … home-assistant-main → ha-drawer → partial-panel-resolver
       └─ ha-panel-lovelace
            └─ hui-root
                 └─ (shadow root)          ← the injection target
                      ├─ card-mod          ← card-mod already injects here; precedent
                      └─ div.narrow
                           └─ .header
                                └─ .toolbar        display:flex, height:56px
                                     ├─ ha-menu-button      48px   hamburger
                                     ├─ ha-tab-group       443px   ← hide this
                                     └─ div.action-items    48px   overflow / edit
```

Two consequences that matter:

1. **`ha-tab-group` lives inside `hui-root`'s shadow root.** A stylesheet in
   `document.head` cannot reach it — shadow DOM blocks descendant selectors, and
   there is no `::part()` exposed. The only route is appending a `<style>` into
   `hui-root.shadowRoot`, which is exactly what card-mod does.
2. **Hiding the tabs leaves the 56px toolbar in place**, holding just the
   hamburger and the overflow menu. That is the point — you keep the edit pencil,
   which `hide_header` costs you — but it is a mostly-empty bar. Support both
   behaviours and let the config choose.

## Config API

```yaml
type: custom:fibbers-nav
hide_ha_tabs: true        # false (default) | true | "header"
tabs: [...]
```

| Value | Effect |
|---|---|
| `false` / omitted | Nothing touched. Default — never surprise someone. |
| `true` | `ha-tab-group { display: none !important }`. Toolbar, hamburger and edit pencil stay. |
| `"header"` | Hides `.header` entirely. Self-contained equivalent of `kiosk_mode: hide_header`, so the kiosk-mode plugin can be dropped. |

Validate in `setConfig`: reject anything that is not `false`, `true` or
`"header"` with a readable error.

## Implementation requirements

- [ ] `findHuiRoot()` — walk open shadow roots to locate `hui-root`. Reuse the
      existing deep-query approach; do not hard-code the ancestor chain, HA
      reshuffles it between releases.
- [ ] `applyTabHiding(mode)` — append
      `<style id="fibbers-hide-tabs">` into `hui-root.shadowRoot`. **Idempotent**:
      if the style element already exists, update its `textContent` rather than
      appending a second one.
- [ ] `removeTabHiding()` — delete that style element. Called from the singleton's
      `detach()`, so leaving the dashboard restores HA's own chrome. A dashboard
      without a `fibbers-nav` card must never inherit hidden tabs.
- [ ] **Re-apply after `hui-root` is replaced.** HA recreates `hui-root` when you
      switch dashboards, and may recreate the toolbar on a config save. Hook the
      existing `location-changed` listener, and additionally use a
      `MutationObserver` on the resolved panel so a re-render cannot silently
      restore the tabs. Debounce it — this fires often.
- [ ] Degrade silently. If `hui-root` is not found (a future HA rename), log one
      `console.debug` and do nothing. Never throw, and never leave the dashboard
      unnavigable.

## Acceptance criteria

Assert programmatically in `docs/preview.html` where possible, and verify the
rest on the live Lab dashboard:

1. `hide_ha_tabs: true` → `ha-tab-group` computes to `display: none`, while
   `ha-menu-button` and `div.action-items` remain visible and clickable.
2. `hide_ha_tabs: "header"` → `.header` computes to `display: none`.
3. Omitting the option changes nothing: `ha-tab-group` stays visible.
4. Exactly one `#fibbers-hide-tabs` style element exists after 20 tab switches.
5. Navigating to a dashboard **without** a `fibbers-nav` card restores the tab
   strip — proves `detach()` cleans up.
6. A dashboard config save (which re-renders the toolbar) does not bring the tabs
   back — proves the observer works.

## Then remove the workaround

Once this ships, delete `kiosk_mode` from the Lab dashboard's raw config; the
plugin covers it. Keep `kiosk_mode: {hide_header: true, hide_sidebar: true}` on
`dashboard-thuis` until that dashboard migrates to Fibbers cards too.

Note the escape hatch changes: `?disable_km` will no longer restore the header,
because kiosk-mode is no longer doing the hiding. Provide your own —
`window.FIBBERS_SHOW_TABS = true` before load, or honour `?disable_km` yourself
so the muscle memory keeps working.
