/* ================================================================== *
 * MORE-INFO — replace Home Assistant's default more-info dialog with a Fibbers
 * modal for the domains we render well, and fall through to HA's (themed) dialog
 * for everything else.
 *
 * A single capture-phase `hass-more-info` listener on window fires before HA's own
 * handler on <home-assistant>; for a supported entity it stops the event and opens
 * a Fibbers modal (built from the existing cards). Enabled/torn down by the nav
 * (opt-in via `more_info: true`), so it never runs on a plain HA page.
 * ================================================================== */
import {
  openModal,
  closeModal,
  teardownIfIdle,
  openModalEntity,
} from "./body-sheet.js";
import { nav } from "./nav-stack.js";

// entity domain → the child card configs the modal renders. Each is an existing
// Fibbers card, so they stay live once the modal pumps hass into them.
const DOMAIN_CARDS = {
  media_player: (id) => [{ type: "custom:fibbers-media", entity: id }],
  climate: (id) => [{ type: "custom:fibbers-climate", entity: id }],
  light: (id) => [{ type: "custom:fibbers-light-detail", entity: id }],
};

// A numeric sensor → current value + a 24h history graph with min/max/change.
const sensorCards = (id) => [
  { type: "custom:fibbers-stat", entity: id },
  {
    type: "custom:fibbers-graph",
    entity: id,
    hours: 24,
    show_stats: true,
    height: 120,
  },
];

const DOMAIN_ICON = {
  media_player: "solar:soundwave-bold-duotone",
  climate: "solar:thermometer-bold-duotone",
  light: "solar:lightbulb-bolt-bold-duotone",
  sensor: "solar:graph-new-bold-duotone",
};

const currentHass = () =>
  nav.hassRef ||
  (document.querySelector("home-assistant") &&
    document.querySelector("home-assistant").hass) ||
  null;

// Decide the modal content for an entity, or null to let HA handle it.
function cardsFor(hass, id) {
  const domain = id.split(".")[0];
  if (DOMAIN_CARDS[domain]) return DOMAIN_CARDS[domain](id);
  if (domain === "sensor") {
    const st = hass.states[id];
    if (st && Number.isFinite(Number(st.state))) return sensorCards(id);
  }
  return null;
}

function handle(e) {
  const detail = e.detail || {};
  const id = detail.entityId;
  if (!id) return;
  const hass = currentHass();
  if (!hass || !hass.states[id]) return; // unknown entity → HA's dialog
  const cards = cardsFor(hass, id);
  if (!cards) return; // unsupported domain → fall through to HA (themed)
  // A card inside the modal (e.g. the stat tile) re-fires more-info for the same
  // entity — swallow it so the modal doesn't close-and-reopen (flash + scroll jump).
  if (openModalEntity() === id) {
    e.stopImmediatePropagation();
    return;
  }
  // Ours — stop the event before <home-assistant> sees it, open the Fibbers modal.
  e.stopImmediatePropagation();
  const st = hass.states[id];
  const a = (st && st.attributes) || {};
  // A room/group can pass its sibling lights; hand them to the light-detail card so
  // it renders an in-modal lamp switcher, and title the modal with the room name.
  const siblings = Array.isArray(detail.siblings)
    ? detail.siblings.filter((s) => hass.states[s])
    : null;
  const grouped =
    siblings && siblings.length > 1 && id.split(".")[0] === "light";
  if (grouped)
    cards[0] = { ...cards[0], siblings, groupName: detail.groupName };
  openModal({
    title: (grouped && detail.groupName) || a.friendly_name || id,
    icon: a.icon || DOMAIN_ICON[id.split(".")[0]],
    cards,
    hass,
    entityId: id,
  });
}

const state = { on: false, fn: null };

/**
 * Start intercepting more-info for supported domains. Idempotent; called from the
 * bar singleton's attach() when the nav has `more_info: true`.
 */
export function enableMoreInfo() {
  if (state.on) return;
  state.on = true;
  state.fn = handle;
  window.addEventListener("hass-more-info", state.fn, true); // capture phase
}

/**
 * Stop intercepting, close any open Fibbers modal, and release the shared sheet
 * host if nothing else needs it. Called from detach() / when `more_info` is off.
 */
export function disableMoreInfo() {
  if (!state.on) return;
  state.on = false;
  window.removeEventListener("hass-more-info", state.fn, true);
  state.fn = null;
  closeModal();
  teardownIfIdle();
}
