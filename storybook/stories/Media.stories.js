import { story } from "../src/story.js";

export default {
  title: "Cards/Media",
  tags: ["autodocs"],
};

/** Full player: art, title/artist, transport, volume and favourite sources. */
export const Playing = story({
  type: "custom:fibbers-media",
  entity: "media_player.woonkamer",
  name: "Woonkamer",
  sources: [
    { name: "NPO 1", source: "NPO Radio 1" },
    { name: "NPO 2", source: "NPO Radio 2" },
    { name: "3FM", source: "NPO 3FM" },
    { name: "538", source: "Radio 538" },
  ],
});

/** The compact "Nu bezig" row for the home view. */
export const Compact = story({
  type: "custom:fibbers-media",
  entity: "media_player.woonkamer",
  compact: true,
});
