import { story } from "../src/story.js";

export default {
  title: "Cards/Media",
  tags: ["autodocs"],
};

/** Full player: title/artist, transport, volume slider and auto source chips. */
export const Playing = story({
  type: "custom:fibbers-media",
  entity: "media_player.keuken_sonos",
  name: "Keuken",
  sources: "auto",
});

/** Paused player with a custom-labelled source list. */
export const Paused = story({
  type: "custom:fibbers-media",
  entity: "media_player.keuken_sonos",
  name: "Keuken",
  sources: [
    { name: "Spotify", source: "Spotify" },
    { name: "538", source: "Radio 538" },
    { name: "TuneIn", source: "TuneIn" },
  ],
});

/** A TV playing Netflix: video tile icon, transport + sources but no volume
 * slider (advertises VOLUME_SET yet reports no level, so it stays hidden). */
export const Video = story({
  type: "custom:fibbers-media",
  entity: "media_player.appletv",
  name: "Apple TV",
  sources: "auto",
});

/** Powered-on TV with nothing playing: idle placeholder, volume-only. */
export const Idle = story({
  type: "custom:fibbers-media",
  entity: "media_player.philips",
  name: "Philips TV",
});

/** Favourites grid: 4-up preset tiles that call play_media on tap. */
export const Favourites = story({
  type: "custom:fibbers-media",
  entity: "media_player.keuken_sonos",
  name: "Keuken",
  favourites: [
    {
      name: "Focus",
      media_content_id: "spotify:playlist:37i9dQZF1DWZeKCadgRdKQ",
      icon: "solar:headphones-round-bold-duotone",
    },
    {
      name: "Radio 2",
      media_content_id: "TuneIn:NPO Radio 2",
      icon: "solar:radio-bold-duotone",
    },
    {
      name: "Jazz",
      media_content_id: "spotify:playlist:37i9dQZF1DXbITWG1ZJKYt",
      icon: "solar:music-notes-bold-duotone",
    },
    {
      name: "80s",
      media_content_id: "spotify:playlist:37i9dQZF1DX4UtSsGT1Sbe",
      icon: "solar:vinyl-record-bold-duotone",
    },
  ],
});

/** The compact "Nu bezig" now-playing row for the home view. */
export const Compact = story({
  type: "custom:fibbers-media",
  entity: "media_player.keuken_sonos",
  compact: true,
});

/** Speaker group: a GROUPING player with join/unjoin chips (Badkamer joined). */
export const SpeakerGroup = story({
  type: "custom:fibbers-media",
  entity: "media_player.badkamer",
  name: "Badkamer",
  group: [
    { name: "Woonkamer", entity: "media_player.woonkamer" },
    { name: "Keuken", entity: "media_player.keuken_sonos" },
    { name: "Slaapkamer", entity: "media_player.slaapkamer" },
  ],
});

/** Unavailable/offline player: idle placeholder, no transport or volume. */
export const Unavailable = story({
  type: "custom:fibbers-media",
  entity: "media_player.zolder",
  name: "Zolder",
});
