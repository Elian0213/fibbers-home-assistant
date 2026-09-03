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

/** Custom name and no `next` — just the last-run line under a green tile. */
export const Named = story({
  type: "custom:fibbers-backup",
  entity: "sensor.backup_last",
  name: "Nextcloud",
});

/** A `result` entity reporting failure — amber tile with the failed line. */
export const Failed = story({
  type: "custom:fibbers-backup",
  entity: "sensor.backup_last",
  next: "sensor.backup_next",
  result: "binary_sensor.backup_result",
});

/** The last-backup entity is unavailable — empty state with a warning tile. */
export const Empty = story({
  type: "custom:fibbers-backup",
  entity: "sensor.backup_none",
});
