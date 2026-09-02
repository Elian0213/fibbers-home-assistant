/*!
 * Fibbers — custom cards + dark theming for Home Assistant.
 * Registers ~25 cards (see the CARDS table below) plus the body-appended nav bar
 * and modal sheet, then injects the theme. Edit src/, run `bun run build`.
 */
import "./icon.js"; // registers <fib-icon>
import "./editor.js"; // registers <fibbers-form-editor> for getConfigElement()
import { bar } from "./body-layer.js";
import { FibbersAlert } from "./cards/alert.js";
import { FibbersBack } from "./cards/back.js";
import { FibbersBackup } from "./cards/backup.js";
import { FibbersChips } from "./cards/chips.js";
import { FibbersClimate } from "./cards/climate.js";
import { FibbersDateTime } from "./cards/datetime.js";
import { FibbersEntities } from "./cards/entities.js";
import { FibbersGraph } from "./cards/graph.js";
import { FibbersGreeting } from "./cards/greeting.js";
import { FibbersLightGroup } from "./cards/light-group.js";
import { FibbersLightRow } from "./cards/light-row.js";
import { FibbersMedia } from "./cards/media.js";
import { FibbersNav } from "./cards/nav.js";
import { FibbersNumber } from "./cards/number.js";
import { FibbersPresence } from "./cards/presence.js";
import { FibbersRemote } from "./cards/remote.js";
import { FibbersRoom } from "./cards/room.js";
import { FibbersScene } from "./cards/scene.js";
import { FibbersScheduler } from "./cards/scheduler.js";
import { FibbersSection } from "./cards/section.js";
import { FibbersSelect } from "./cards/select.js";
import { FibbersSheet } from "./cards/sheet.js";
import { FibbersStat } from "./cards/stat.js";
import { FibbersSysmon } from "./cards/sysmon.js";
import { FibbersToggle } from "./cards/toggle.js";
import { FibbersWeather } from "./cards/weather.js";
import { injectGlobalCss } from "./global-css.js";
import { nav, goBack, previous } from "./nav-stack.js";
import { T, styleBlock } from "./tokens.js";
import { navigate } from "./util.js";

const VERSION = "0.7.4";

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
    "fibbers-light-group",
    FibbersLightGroup,
    "Fibbers Light Group",
    "Master light control — group slider with expandable member rows.",
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
  [
    "fibbers-stat",
    FibbersStat,
    "Fibbers Stat",
    "Single value tile — icon, label, value and unit.",
  ],
  [
    "fibbers-graph",
    FibbersGraph,
    "Fibbers Graph",
    "Single-entity sparkline of recent history.",
  ],
  [
    "fibbers-entities",
    FibbersEntities,
    "Fibbers Entities",
    "Self-maintaining filtered list of entities.",
  ],
  [
    "fibbers-presence",
    FibbersPresence,
    "Fibbers Presence",
    "Who's home — person tiles with a summary.",
  ],
  [
    "fibbers-backup",
    FibbersBackup,
    "Fibbers Backup",
    "Backup status — last run, result and next.",
  ],
  [
    "fibbers-weather",
    FibbersWeather,
    "Fibbers Weather",
    "Current conditions and a short forecast.",
  ],
  [
    "fibbers-media",
    FibbersMedia,
    "Fibbers Media",
    "Media player — now-playing, transport, volume, sources.",
  ],
  [
    "fibbers-sysmon",
    FibbersSysmon,
    "Fibbers Sysmon",
    "Host telemetry tiles with an optional sparkline.",
  ],
  [
    "fibbers-scheduler",
    FibbersScheduler,
    "Fibbers Scheduler",
    "Wake/alarm control driven by HA helpers.",
  ],
  [
    "fibbers-remote",
    FibbersRemote,
    "Fibbers Remote",
    "Universal remote — D-pad and buttons.",
  ],
  [
    "fibbers-climate",
    FibbersClimate,
    "Fibbers Climate",
    "Thermostat — setpoint and hvac modes.",
  ],
  [
    "fibbers-number",
    FibbersNumber,
    "Fibbers Number",
    "Slider / stepper for input_number and number.",
  ],
  [
    "fibbers-select",
    FibbersSelect,
    "Fibbers Select",
    "Option picker (chips or dropdown) for input_select and select.",
  ],
  [
    "fibbers-toggle",
    FibbersToggle,
    "Fibbers Toggle",
    "Switch row for input_boolean, switch and automation.",
  ],
  [
    "fibbers-datetime",
    FibbersDateTime,
    "Fibbers Datetime",
    "Time / date row for input_datetime.",
  ],
  [
    "fibbers-greeting",
    FibbersGreeting,
    "Fibbers Greeting",
    "Time-of-day header with a lights / presence / sensor subline.",
  ],
];

CARDS.forEach(([tag, cls]) => {
  if (!customElements.get(tag)) customElements.define(tag, cls);
});

const DOCS_URL = "https://elian0213.github.io/fibbers-home-assistant/";
window.customCards = window.customCards || [];
CARDS.forEach(([tag, , name, description]) => {
  if (!window.customCards.some((c) => c.type === tag)) {
    window.customCards.push({
      type: tag,
      name,
      description,
      preview: true, // live thumbnail in the card picker (getStubConfig)
      documentationURL: DOCS_URL,
    });
  }
});

/* 0.6.0: the global restyle is no longer applied on load — installing Fibbers
 * leaves the rest of Home Assistant untouched. Per-dashboard theming is opt-in
 * via `theme:` on fibbers-nav (see src/theme.js). `injectGlobalCss` stays exposed
 * on window.FIBBERS for anyone who wants the old "restyle everything" behaviour. */

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
