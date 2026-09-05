/* ================================================================== *
 * ACTIONS — runs a standard HA action object.
 * Shared by chips + light-row; `fallbackEntity` is used by toggle/more-info.
 * ================================================================== */
import { navigate, moreInfo } from "@shared/util";
import type { HomeAssistant } from "@/types/home-assistant";

/** A standard Home Assistant action config, as read by {@link runAction}. */
export interface ActionConfig {
  action?: string;
  navigation_path?: string;
  url_path?: string;
  entity?: string;
  service?: string;
  perform_action?: string;
  data?: Record<string, unknown>;
  service_data?: Record<string, unknown>;
  target?: Record<string, unknown>;
}

/**
 * Run a standard HA action object (navigate / url / toggle / more-info /
 * call-service). Absent or unknown actions are a no-op. `fallbackEntity` fills the
 * target for toggle/more-info when the action omits its own entity.
 * @param action — an HA action config
 * @param hass
 * @param host — element the more-info dialog dispatches from
 * @param fallbackEntity
 */
export function runAction(
  action: ActionConfig | null | undefined,
  hass: HomeAssistant | null | undefined,
  host: Element | null | undefined,
  fallbackEntity?: string,
): void {
  const a: ActionConfig = action || { action: "none" };
  switch (a.action) {
    case "navigate":
      if (a.navigation_path) navigate(a.navigation_path);
      break;
    case "url":
      if (a.url_path) {
        const external = a.url_path.startsWith("http");
        // noopener,noreferrer: an external tab must not get a live window.opener
        // handle back onto the HA frontend (reverse tabnabbing).
        window.open(
          a.url_path,
          external ? "_blank" : "_self",
          external ? "noopener,noreferrer" : "",
        );
      }
      break;
    case "toggle": {
      const entity = a.entity || fallbackEntity;
      if (entity && hass)
        hass.callService("homeassistant", "toggle", { entity_id: entity });
      break;
    }
    case "more-info":
      moreInfo(host, a.entity || fallbackEntity || "");
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
