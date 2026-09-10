# Fibbers card gallery

Every card, with a live example and copy-paste Lovelace YAML, runs in the
[Storybook demo](https://elian0213.github.io/fibbers-home-assistant/) — open a card and hit
**Show code**. The thumbnails below are a static overview; the demo is the reference.

Back to the [README](../README.md).

## Shell & navigation

The app shell: a pinned bottom bar (sidebar-aware on desktop), a back button that remembers its
stack, drag-up modal sheets, a section label, and the greeting header.

<img src="images/nav.png" alt="fibbers-nav — the pinned bottom bar" width="620">

<table>
<tr>
<td width="33%" align="center"><img src="images/cards/greeting.png" width="240" alt="fibbers-greeting"><br><code>fibbers-greeting</code><br><sub>time-of-day header</sub></td>
<td width="33%" align="center"><img src="images/cards/back.png" width="240" alt="fibbers-back"><br><code>fibbers-back</code><br><sub>back with memory</sub></td>
<td width="33%" align="center"><img src="images/cards/section.png" width="240" alt="fibbers-section"><br><code>fibbers-section</code><br><sub>section label</sub></td>
</tr>
</table>

## Rooms, lights & scenes

Room tiles that count their own lights, a master light-group control, a light row with a slider,
the Hue-style colour picker (the light modal), scene tiles, and action chips.

<table>
<tr>
<td width="33%" align="center"><img src="images/cards/room.png" width="240" alt="fibbers-room"><br><code>fibbers-room</code><br><sub>counts its own lights</sub></td>
<td width="33%" align="center"><img src="images/cards/light-group.png" width="240" alt="fibbers-light-group"><br><code>fibbers-light-group</code><br><sub>master control</sub></td>
<td width="33%" align="center"><img src="images/cards/light-row.png" width="240" alt="fibbers-light-row"><br><code>fibbers-light-row</code><br><sub>brightness slider</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="images/cards/light-detail.png" width="240" alt="fibbers-light-detail"><br><code>fibbers-light-detail</code><br><sub>room colour picker</sub></td>
<td width="33%" align="center"><img src="images/cards/scene.png" width="240" alt="fibbers-scene"><br><code>fibbers-scene</code><br><sub>scene tiles</sub></td>
<td width="33%" align="center"><img src="images/cards/chips.png" width="240" alt="fibbers-chips"><br><code>fibbers-chips</code><br><sub>action pills</sub></td>
</tr>
</table>

## Status & data

An alert card built from real checks, value tiles, a history sparkline, a self-filtering entity
list, presence, backups, weather, and host telemetry.

<table>
<tr>
<td width="33%" align="center"><img src="images/cards/alert.png" width="240" alt="fibbers-alert"><br><code>fibbers-alert</code><br><sub>real checks</sub></td>
<td width="33%" align="center"><img src="images/cards/stat.png" width="240" alt="fibbers-stat"><br><code>fibbers-stat</code><br><sub>value tile</sub></td>
<td width="33%" align="center"><img src="images/cards/graph.png" width="240" alt="fibbers-graph"><br><code>fibbers-graph</code><br><sub>history sparkline</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="images/cards/entities.png" width="240" alt="fibbers-entities"><br><code>fibbers-entities</code><br><sub>filtered list</sub></td>
<td width="33%" align="center"><img src="images/cards/presence.png" width="240" alt="fibbers-presence"><br><code>fibbers-presence</code><br><sub>who's home</sub></td>
<td width="33%" align="center"><img src="images/cards/backup.png" width="240" alt="fibbers-backup"><br><code>fibbers-backup</code><br><sub>backup status</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="images/cards/weather.png" width="240" alt="fibbers-weather"><br><code>fibbers-weather</code><br><sub>forecast strip</sub></td>
<td width="33%" align="center"><img src="images/cards/sysmon.png" width="240" alt="fibbers-sysmon"><br><code>fibbers-sysmon</code><br><sub>host telemetry</sub></td>
<td></td>
</tr>
</table>

## Devices

A media player, a thermostat, a universal remote, a wake scheduler, and a one-tile wake-up alarm.

<table>
<tr>
<td width="33%" align="center"><img src="images/cards/media.png" width="240" alt="fibbers-media"><br><code>fibbers-media</code><br><sub>now-playing</sub></td>
<td width="33%" align="center"><img src="images/cards/climate.png" width="240" alt="fibbers-climate"><br><code>fibbers-climate</code><br><sub>thermostat</sub></td>
<td width="33%" align="center"><img src="images/cards/remote.png" width="240" alt="fibbers-remote"><br><code>fibbers-remote</code><br><sub>universal remote</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="images/cards/scheduler.png" width="240" alt="fibbers-scheduler"><br><code>fibbers-scheduler</code><br><sub>wake control</sub></td>
<td width="33%" align="center"><img src="images/cards/alarm.png" width="240" alt="fibbers-alarm"><br><code>fibbers-alarm</code><br><sub>wake-up alarm</sub></td>
<td></td>
</tr>
</table>

## Inputs & controls

Helpers for `input_number` / `input_select` / `input_boolean` / `input_datetime`.

<table>
<tr>
<td width="33%" align="center"><img src="images/cards/number.png" width="240" alt="fibbers-number"><br><code>fibbers-number</code><br><sub>slider / stepper</sub></td>
<td width="33%" align="center"><img src="images/cards/select.png" width="240" alt="fibbers-select"><br><code>fibbers-select</code><br><sub>option picker</sub></td>
<td width="33%" align="center"><img src="images/cards/toggle.png" width="240" alt="fibbers-toggle"><br><code>fibbers-toggle</code><br><sub>switch row</sub></td>
</tr>
<tr>
<td width="33%" align="center"><img src="images/cards/datetime.png" width="240" alt="fibbers-datetime"><br><code>fibbers-datetime</code><br><sub>time / date</sub></td>
<td></td>
<td></td>
</tr>
</table>
