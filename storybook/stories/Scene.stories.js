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
    {
      name: "Film",
      icon: "solar:clapperboard-play-bold-duotone",
      scene: "scene.film",
    },
  ],
});

/** Six favourites up top; the rest collapse behind an "Alle N scènes" drawer. */
export const Favourites = story({
  type: "custom:fibbers-scene",
  favourites: 6,
  scenes: [
    { name: "Avond", icon: "solar:moon-bold-duotone", scene: "scene.avond" },
    { name: "Helder", icon: "solar:sun-bold-duotone", scene: "scene.helder" },
    {
      name: "Film",
      icon: "solar:clapperboard-play-bold-duotone",
      scene: "scene.film",
    },
    { name: "Eten", icon: "solar:tea-cup-bold-duotone", scene: "scene.eten" },
    {
      name: "Ontspannen",
      icon: "solar:sofa-2-bold-duotone",
      scene: "scene.ontspannen",
    },
    { name: "Lezen", icon: "solar:book-2-bold-duotone", scene: "scene.lezen" },
    {
      name: "Feest",
      icon: "solar:star-fall-bold-duotone",
      scene: "scene.feest",
    },
    {
      name: "Nacht",
      icon: "solar:moon-stars-bold-duotone",
      scene: "scene.nacht",
    },
  ],
});
