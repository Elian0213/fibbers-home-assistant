import { story } from "../src/story.js";

export default {
  title: "Cards/Shell & Navigation/Section",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: "Uppercase mono section label.",
      },
    },
  },
};

/** The uppercase mono section label — replaces the HA heading card + card-mod. */
export const Default = story({
  type: "custom:fibbers-section",
  label: "Kamers",
});

/** A longer label — the mono tracking and uppercase transform hold at width. */
export const LongLabel = story({
  type: "custom:fibbers-section",
  label: "Verlichting & sferen",
});
