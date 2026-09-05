/* ================================================================== *
 * HIDE HA TABS — suppress HA's top tab strip so a bottom-nav dashboard can drop
 * kiosk-mode. Injects a scoped <style> into hui-root's shadow root (the way
 * card-mod does) through the shared hui-inject machine.
 * Modes: false = untouched; true = hide the tab strip; "header" = hide .header.
 * ================================================================== */
import { injectStyle, removeStyle, findHuiRoot } from "@core/hui-inject";

/** Tab-hiding mode: `true` hides the tab strip, `"header"` hides the header, `false` leaves HA untouched. */
export type TabHideMode = boolean | "header";

const STYLE_ID = "fibbers-hide-tabs";
// Cover the tab strip across HA versions: the modern ha-tab-group and the older
// ha-tabs/paper-tabs/sl-tab-group, so a version bump doesn't silently no-op.
const TAB_SEL = "ha-tab-group, ha-tabs, paper-tabs, sl-tab-group";
const CSS: Record<"true" | "header", string> = {
  true: `${TAB_SEL} { display: none !important; }`,
  header: `.header { display: none !important; }`,
};

const state: { mode: TabHideMode } = { mode: false };

// Escape hatches (global flag or ?disable_km) so a stuck dashboard is always
// recoverable — never leave the user without HA's tabs and no way back.
function suppressed(): boolean {
  if (
    (window as unknown as { FIBBERS_SHOW_TABS?: boolean }).FIBBERS_SHOW_TABS ===
    true
  )
    return true;
  try {
    return new URLSearchParams(window.location.search).has("disable_km");
  } catch (_) {
    return false;
  }
}

function computeCss(): string {
  if (!state.mode || suppressed()) return "";
  return CSS[state.mode === true ? "true" : "header"] || "";
}

// Once, after HA has had time to render: if the tab selectors matched nothing, the
// strip has a different shape on this version — say so instead of silently failing.
function diagnose(): void {
  if (state.mode !== true) return;
  setTimeout(() => {
    const root = findHuiRoot();
    if (root && root.shadowRoot && !root.shadowRoot.querySelector(TAB_SEL))
      console.debug(
        "fibbers: hide_ha_tabs matched no tab strip " +
          `(${TAB_SEL}) in hui-root — the selector may be stale for this HA version`,
      );
  }, 1000);
}

/**
 * Full teardown — called from detach() when the last fibbers-nav unmounts, so a
 * dashboard with no bar never inherits hidden tabs and becomes unnavigable.
 */
export function removeTabHiding(): void {
  state.mode = false;
  removeStyle(STYLE_ID);
}

/**
 * Set the tab-hiding mode from the bar singleton's attach(). `true` hides the tab
 * strip, `"header"` hides the whole header; `false`/undefined tears down.
 * @param mode — the tab-hiding mode
 */
export function setTabHiding(mode: TabHideMode): void {
  const normalized: TabHideMode =
    mode === true || mode === "header" ? mode : false;
  const changed = state.mode !== normalized;
  state.mode = normalized;
  if (!normalized) {
    removeTabHiding();
    return;
  }
  injectStyle(STYLE_ID, computeCss);
  if (changed) diagnose();
}
