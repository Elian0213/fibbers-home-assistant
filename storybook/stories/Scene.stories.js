import { story } from "../src/story.js";

export default {
  title: "Cards/Scene",
  tags: ["autodocs"],
};

/** Three scene tiles; the most recently applied one (Avond, by `last_activated`) is highlighted. */
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

/** Eight scenes, all shown at once (no `favourites`) — the auto-fit grid wraps them. */
export const Grid = story({
  type: "custom:fibbers-scene",
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

/** Six favourites up top; the other two collapse behind an "Alle N scènes" drawer. */
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

/** A scene without an explicit `icon` falls back to the default palette glyph. */
export const DefaultIcon = story({
  type: "custom:fibbers-scene",
  scenes: [
    { name: "Avond", scene: "scene.avond" },
    { name: "Helder", scene: "scene.helder" },
  ],
});

/** A single scene tile — the smallest valid config the card accepts. */
export const Single = story({
  type: "custom:fibbers-scene",
  scenes: [
    {
      name: "Film",
      icon: "solar:clapperboard-play-bold-duotone",
      scene: "scene.film",
    },
  ],
});
