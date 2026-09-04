/*!
 * Fibbers — entry point + card registry for the Home Assistant plugin.
 * Imports every card for its side effects, then the CARDS table defines each
 * custom element and registers it with HA's card picker (window.customCards).
 * The `/*!` banner is kept verbatim by the minifier. Edit src/, run `bun run build`.
 */
import "./shared/icon.js"; // registers <fib-icon>
import "./core/editor.js"; // registers <fibbers-form-editor> for getConfigElement()
import { FibbersClimate } from "./cards/climate/climate.js";
import { FibbersChips } from "./cards/inputs/chips.js";
import { FibbersDateTime } from "./cards/inputs/datetime.js";
import { FibbersNumber } from "./cards/inputs/number.js";
import { FibbersScene } from "./cards/inputs/scene.js";
import { FibbersScheduler } from "./cards/inputs/scheduler.js";
import { FibbersSelect } from "./cards/inputs/select.js";
import { FibbersToggle } from "./cards/inputs/toggle.js";
import { FibbersBack } from "./cards/layout/back.js";
import { FibbersGreeting } from "./cards/layout/greeting.js";
import { FibbersNav } from "./cards/layout/nav.js";
import { FibbersRoom } from "./cards/layout/room.js";
import { FibbersSection } from "./cards/layout/section.js";
import { FibbersSheet } from "./cards/layout/sheet.js";
import { FibbersLightDetail } from "./cards/lights/light-detail.js";
import { FibbersLightGroup } from "./cards/lights/light-group.js";
import { FibbersLightRow } from "./cards/lights/light-row.js";
import { FibbersMedia } from "./cards/media/media.js";
import { FibbersRemote } from "./cards/media/remote.js";
import { FibbersAlert } from "./cards/sensors/alert.js";
import { FibbersBackup } from "./cards/sensors/backup.js";
import { FibbersEntities } from "./cards/sensors/entities.js";
import { FibbersGraph } from "./cards/sensors/graph.js";
import { FibbersPresence } from "./cards/sensors/presence.js";
import { FibbersStat } from "./cards/sensors/stat.js";
import { FibbersSysmon } from "./cards/sensors/sysmon.js";
import { FibbersWeather } from "./cards/sensors/weather.js";
import { bar } from "./core/body-layer.js";
import { injectGlobalCss } from "./core/global-css.js";
import { nav, goBack, previous } from "./core/nav-stack.js";
import { T, styleBlock } from "./shared/tokens.js";
import { navigate } from "./shared/util.js";

const VERSION = "0.8.2";

/* ================================================================== *
 * REGISTRY — `[tag, class, name, description]` per card. The forEach below
 * defines the elements; a second pass feeds name/description to the card picker.
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
    "fibbers-light-detail",
    FibbersLightDetail,
    "Fibbers Light Detail",
    "Full single-light control — brightness, colour temperature and colour.",
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
 * via `theme:` on fibbers-nav (see src/core/theme.js). `injectGlobalCss` stays exposed
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
