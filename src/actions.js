/* ================================================================== *
 * ACTIONS — a small runner for standard HA action objects
 *
 * Shared by fibbers-chips and fibbers-light-row (and future cards). Takes a
 * plain action object `{ action, ... }`, the hass API, the host element (for
 * `hass-more-info`), and a fallback entity used by `toggle`/`more-info` when
 * the action doesn't name its own.
 * ================================================================== */
import { navigate } from "./util.js";

export function runAction(action, hass, host, fallbackEntity) {
  const a = action || { action: "none" };
  switch (a.action) {
    case "navigate":
      if (a.navigation_path) navigate(a.navigation_path);
      break;
    case "url":
      if (a.url_path)
        window.open(
          a.url_path,
          a.url_path.startsWith("http") ? "_blank" : "_self",
        );
      break;
    case "toggle": {
      const entity = a.entity || fallbackEntity;
      if (entity && hass)
        hass.callService("homeassistant", "toggle", { entity_id: entity });
      break;
    }
    case "more-info": {
      const entityId = a.entity || fallbackEntity;
      if (entityId)
        host.dispatchEvent(
          new CustomEvent("hass-more-info", {
            detail: { entityId },
            bubbles: true,
            composed: true,
          }),
        );
      break;
    }
    case "call-service":
    case "perform-action": {
      const svc = a.service || a.perform_action;
      if (svc && svc.includes(".") && hass) {
        const [domain, service] = svc.split(".");
        hass.callService(
          domain,
          service,
          a.data || a.service_data || {},
          a.target,
        );
      }
      break;
    }
    default:
      break;
  }
}
