import { story, renderCard } from "../src/story.js";

export default {
  title: "Cards/Sheet",
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

const SHEET = {
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

/** The sheet card is invisible in the view; this story opens the modal via the URL hash,
 * with a section + three light rows rendered inside via `loadCardHelpers()`. */
export const Open = {
  ...story(SHEET),
  render: () => {
    const el = renderCard(SHEET);
    setTimeout(() => {
      window.location.hash = SHEET.id;
    }, 40);
    return el;
  },
};
