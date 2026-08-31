/* The heart of the showcase: one `config` object drives BOTH the live card and
 * the YAML shown in the "Show code" / Docs panel — so they can never drift.
 *
 *   export const Lit = story({ type: "custom:fibbers-room", name: "Woonkamer", ... });
 */
import yaml from "js-yaml";
import { HASS } from "./hass.js";

const tagOf = (type) => String(type || "").replace(/^custom:/, "");

export function renderCard(config, hass = HASS) {
  const el = document.createElement(tagOf(config.type));
  el.setConfig(JSON.parse(JSON.stringify(config)));
  el.hass = hass;
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
