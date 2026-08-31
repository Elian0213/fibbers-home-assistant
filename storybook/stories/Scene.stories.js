import { story } from "../src/story.js";

export default {
  title: "Cards/Scene",
  tags: ["autodocs"],
};

/** Scene tiles; the most recently applied scene (by `last_activated`) is highlighted. */
export const Default = story({
  type: "custom:fibbers-scene",
  scenes: [
    { name: "Avond", icon: "solar:moon-bold-duotone", scene: "scene.avond" },
    { name: "Helder", icon: "solar:sun-bold-duotone", scene: "scene.helder" },
    { name: "Film", icon: "solar:clapperboard-play-bold-duotone", scene: "scene.film" },
  ],
});
