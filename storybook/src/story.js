/* The heart of the showcase: one `config` object drives BOTH the live card and
 * the YAML shown in the "Show code" / Docs panel — so they can never drift.
 *
 *   export const Lit = story({ type: "custom:fibbers-room", name: "Woonkamer", ... });
 */
import yaml from "js-yaml";
import { HASS } from "./hass.js";

const tagOf = (type) => String(type || "").replace(/^custom:/, "");

// The light/dark toolbar toggle (see .storybook/preview.js) flips this before a
// story renders; renderCard seeds the mock hass's `themes.darkMode` from it so
// each card's ThemeController switches the palette exactly as it would in HA.
let previewDark = true;

/** Set by the theme toolbar decorator before each render. */
export function setPreviewDark(dark) {
  previewDark = dark;
}

/** Page/ground colours for a composed page story that paints its own column.
 *  Reads the theme toolbar value off the story context so Pages/* follow it too. */
export function pageColors(ctx) {
  const light = ctx && ctx.globals && ctx.globals.theme === "light";
  return light
    ? { bg: "#EEF1F0", ink: "#14201A" }
    : { bg: "#111516", ink: "#EDF1F1" };
}

export function renderCard(config, hass = HASS) {
  const el = document.createElement(tagOf(config.type));
  el.setConfig(JSON.parse(JSON.stringify(config)));
  el.hass = { ...hass, themes: { ...(hass && hass.themes), darkMode: previewDark } };
  return el;
}

const toYaml = (config) =>
  yaml.dump(config, {
    indent: 2,
    lineWidth: -1,
    quotingType: '"',
    noRefs: true,
  });

/** Build a story: renders the card, and shows its YAML config in Docs. */
export function story(config, opts = {}) {
  return {
    render: () => renderCard(config, opts.hass),
    parameters: {
      docs: { source: { code: toYaml(config), language: "yaml" } },
      ...(opts.parameters || {}),
    },
  };
}
