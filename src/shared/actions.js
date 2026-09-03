/* ================================================================== *
 * ACTIONS — runs a standard HA action object.
 * Shared by chips + light-row; `fallbackEntity` is used by toggle/more-info.
 * ================================================================== */
import { navigate, moreInfo } from "./util.js";

/**
 * Run a standard HA action object (navigate / url / toggle / more-info /
 * call-service). Absent or unknown actions are a no-op. `fallbackEntity` fills the
 * target for toggle/more-info when the action omits its own entity.
 * @param {object} action — an HA action config
 * @param {object} hass
 * @param {Element} host — element the more-info dialog dispatches from
 * @param {string} [fallbackEntity]
 */
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
    case "more-info":
      moreInfo(host, a.entity || fallbackEntity);
      break;
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
