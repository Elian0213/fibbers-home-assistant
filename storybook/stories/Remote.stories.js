import { story } from "../src/story.js";

export default {
  title: "Cards/Remote",
  tags: ["autodocs"],
};

/** D-pad + back/home/menu + volume/playback; buttons send remote commands. */
export const Default = story({
  type: "custom:fibbers-remote",
  entity: "remote.woonkamer_tv",
  name: "TV",
});
