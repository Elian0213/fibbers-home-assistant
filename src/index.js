/*!
 * Fibbers — custom cards + theming for the Thuis Home Assistant dashboard.
 *
 * Ships:
 *   custom:fibbers-nav    bottom navigation bar, genuinely pinned to the viewport
 *   custom:fibbers-back   back control driven by a real navigation stack
 *
 * WHY THE BAR RENDERS INTO document.body
 * Inside a Lovelace view, `position: fixed` resolves against the scrolling
 * content box rather than the window, so a bar "fixed to the bottom" lands at
 * the bottom of the page instead of the screen. Rendering into document.body is
 * the only reliable escape, and it is also what keeps the bar working
 * independent of Lovelace's own DOM. Everything else here follows from that.
 *
 * Source is modular under src/. `bun run build` bundles it into an IIFE at
 * dist/fibbers.js — edit src/, never the bundle.
 */
import { T, styleBlock } from "./tokens.js";
import { navigate } from "./util.js";
import { nav, goBack, previous } from "./nav-stack.js";
import { bar } from "./body-layer.js";
import { injectGlobalCss } from "./global-css.js";
import "./icon.js"; // registers <fib-icon>
import { FibbersNav } from "./cards/nav.js";
import { FibbersBack } from "./cards/back.js";
import { FibbersSheet } from "./cards/sheet.js";
import { FibbersSection } from "./cards/section.js";
import { FibbersRoom } from "./cards/room.js";
import { FibbersLightRow } from "./cards/light-row.js";
import { FibbersAlert } from "./cards/alert.js";
import { FibbersChips } from "./cards/chips.js";
import { FibbersScene } from "./cards/scene.js";

const VERSION = "0.1.0";

/* ================================================================== *
 * REGISTRY
 * ================================================================== */
const CARDS = [
  [
    "fibbers-nav",
    FibbersNav,
    "Fibbers Nav",
    "Bottom navigation bar pinned to the viewport.",
  ],
  [
    "fibbers-back",
    FibbersBack,
    "Fibbers Back",
    "Back control driven by a real navigation stack.",
  ],
  [
    "fibbers-sheet",
    FibbersSheet,
    "Fibbers Sheet",
    "Hash-routed modal bottom sheet.",
  ],
  [
    "fibbers-section",
    FibbersSection,
    "Fibbers Section",
    "Uppercase mono section label.",
  ],
  [
    "fibbers-room",
    FibbersRoom,
    "Fibbers Room",
    "Room tile that computes its own light state.",
  ],
  [
    "fibbers-light-row",
    FibbersLightRow,
    "Fibbers Light Row",
    "Light row with a brightness slider, for sheets.",
  ],
  [
    "fibbers-alert",
    FibbersAlert,
    "Fibbers Alert",
    "Attention card driven by real checks.",
  ],
  ["fibbers-chips", FibbersChips, "Fibbers Chips", "A row of action pills."],
  [
    "fibbers-scene",
    FibbersScene,
    "Fibbers Scene",
    "Scene tiles that highlight the active scene.",
  ],
];

CARDS.forEach(([tag, cls]) => {
  if (!customElements.get(tag)) customElements.define(tag, cls);
});

window.customCards = window.customCards || [];
CARDS.forEach(([tag, , name, description]) => {
  if (!window.customCards.some((c) => c.type === tag)) {
    window.customCards.push({ type: tag, name, description, preview: false });
  }
});

/* global theming — replaces the theme repo (honours FIBBERS_DISABLE_GLOBAL_CSS) */
injectGlobalCss();

/* exposed for the preview harness and console debugging */
window.FIBBERS = {
  VERSION,
  nav,
  goBack,
  previous,
  navigate,
  tokens: T,
  styleBlock,
  injectGlobalCss,
  bar,
};

console.info(
  `%c FIBBERS %c v${VERSION} `,
  "color:#111516;background:#74B98A;font-weight:600;border-radius:3px 0 0 3px;padding:2px 4px",
  "color:#74B98A;background:#1D2426;border-radius:0 3px 3px 0;padding:2px 4px",
);
