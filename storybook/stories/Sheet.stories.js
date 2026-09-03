import { story, renderCard } from "../src/story.js";

export default {
  title: "Cards/Sheet",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

const ROOM = {
  type: "custom:fibbers-sheet",
  id: "demo-sheet",
  title: "Woonkamer",
  icon: "solar:sofa-2-bold-duotone",
  subtitle: "3 lampen · 21,4 °C",
  cards: [
    { type: "custom:fibbers-section", label: "Verlichting" },
    { type: "custom:fibbers-light-row", entity: "light.tv_led_strip" },
    { type: "custom:fibbers-light-row", entity: "light.kitchen" },
    { type: "custom:fibbers-light-row", entity: "light.hue_go_1" },
  ],
};

const MIXED = {
  type: "custom:fibbers-sheet",
  id: "demo-mixed",
  title: "Klimaat",
  icon: "solar:temperature-bold-duotone",
  cards: [
    { type: "custom:fibbers-section", label: "Verwarming" },
    { type: "custom:fibbers-climate", entity: "climate.woonkamer" },
    { type: "custom:fibbers-section", label: "Media" },
    { type: "custom:fibbers-media", entity: "media_player.woonkamer" },
  ],
};

const EMPTY = {
  type: "custom:fibbers-sheet",
  id: "demo-empty",
  title: "Leeg",
  icon: "solar:widget-bold-duotone",
  cards: [],
};

/** The sheet card is invisible in the view; this story opens the modal via the URL hash,
 * with a section + three light rows rendered inside via `loadCardHelpers()`. */
export const Open = {
  ...story(ROOM),
  render: () => {
    const el = renderCard(ROOM);
    setTimeout(() => {
      window.location.hash = ROOM.id;
    }, 40);
    return el;
  },
};

/** A mixed sheet: sections wrapping a climate card and a media player, showing the
 * layer stacks any Fibbers cards it is handed. */
export const MixedContent = {
  ...story(MIXED),
  render: () => {
    const el = renderCard(MIXED);
    setTimeout(() => {
      window.location.hash = MIXED.id;
    }, 40);
    return el;
  },
};

/** An empty `cards: []` sheet still opens on its hash — the modal shell with its
 * title/icon header and no body content. */
export const Empty = {
  ...story(EMPTY),
  render: () => {
    const el = renderCard(EMPTY);
    setTimeout(() => {
      window.location.hash = EMPTY.id;
    }, 40);
    return el;
  },
};

/** The inert summary tile the card picker shows for the otherwise-invisible sheet:
 * its icon, title, and the `opens on #<id>` hint. */
export const PickerPreview = {
  ...story(ROOM),
  render: () => {
    const el = renderCard(ROOM);
    el.preview = true;
    return el;
  },
};
