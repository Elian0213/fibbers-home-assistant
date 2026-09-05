/**
 * Local barrel for the Home Assistant types the cards use. Re-exported from
 * `custom-card-helpers` (a dev-only, type-only dependency — nothing is bundled).
 * Import from here (`@types/home-assistant`) so the underlying source can be
 * swapped in one place without touching every card.
 */
export type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardEditor,
  LovelaceCardConfig,
} from "custom-card-helpers";

/** A single entity's state object, as found on `hass.states[entity_id]`. */
export type HassEntity = import("home-assistant-js-websocket").HassEntity;
