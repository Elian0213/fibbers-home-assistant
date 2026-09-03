import { story, renderCard } from "../src/story.js";

export default {
  title: "Cards/Back",
  tags: ["autodocs"],
};

const BACK = {
  type: "custom:fibbers-back",
  fallback: "/dashboard-thuis/huis",
  labels: {
    "/dashboard-thuis/huis": "Huis",
    "/dashboard-thuis/licht": "Licht",
  },
};

/** Reads a seeded navigation stack — "Terug naar Huis" — instead of the bare fallback. */
export const Default = {
  ...story(BACK),
  render: () => {
    if (window.FIBBERS) {
      window.FIBBERS.nav.stack = [
        "/dashboard-thuis/huis",
        "/dashboard-thuis/licht",
      ];
    }
    return renderCard(BACK);
  },
};

/** Cold deep-link with an empty stack: falls back to the `fallback` route's label. */
export const Fallback = {
  ...story(BACK),
  render: () => {
    if (window.FIBBERS) window.FIBBERS.nav.stack = [];
    return renderCard(BACK);
  },
};

/** A static `label` override — ignores the nav stack and always reads "Terug naar overzicht". */
export const StaticLabel = story({
  type: "custom:fibbers-back",
  fallback: "/dashboard-thuis/huis",
  label: "Terug naar overzicht",
});

/** Custom leading icon instead of the default left-arrow. */
export const CustomIcon = story({
  type: "custom:fibbers-back",
  fallback: "/dashboard-thuis/huis",
  label: "Terug naar Huis",
  icon: "solar:home-2-bold-duotone",
});

/** No labels map and empty stack: the bare, unnamed "Terug" button. */
export const Bare = {
  ...story({ type: "custom:fibbers-back", fallback: "/lovelace/0" }),
  render: () => {
    if (window.FIBBERS) window.FIBBERS.nav.stack = [];
    return renderCard({ type: "custom:fibbers-back", fallback: "/lovelace/0" });
  },
};
