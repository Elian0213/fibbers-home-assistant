import { story } from "../src/story.js";

export default {
  title: "Cards/Backup",
  tags: ["autodocs"],
};

/** Last backup a few hours ago, next one scheduled — green tile. */
export const Recent = story({
  type: "custom:fibbers-backup",
  entity: "sensor.backup_last",
  next: "sensor.backup_next",
});

/** Older than `stale_hours` — the tile turns amber. */
export const Stale = story({
  type: "custom:fibbers-backup",
  entity: "sensor.backup_last",
  next: "sensor.backup_next",
  stale_hours: 1,
});
