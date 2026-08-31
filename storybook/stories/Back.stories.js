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
    // seed a navigation stack so it reads "Terug naar Huis"
    if (window.FIBBERS) {
      window.FIBBERS.nav.stack = ["/dashboard-thuis/huis", "/dashboard-thuis/licht"];
    }
    return renderCard(BACK);
  },
};
