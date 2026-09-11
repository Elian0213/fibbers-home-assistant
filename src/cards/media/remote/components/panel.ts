/* ================================================================== *
 * fibbers-remote — the side panel: source chips (media_player.select_source) and
 * the optional `controls:` list (select/light/number/toggle/button/scene). Pure
 * view functions over a RemoteHost.
 * ================================================================== */
import { html, nothing, type TemplateResult } from "lit";

import { overflowChips, pillSwitch, sliderTrack } from "@shared/ui";
import { isUnavail, fmtNum } from "@shared/util";
import type { HassEntity } from "@/types/home-assistant";

import { mpSupports, allSources, favSources } from "../device";
import { ctlBounds, ctlPct, ctlSnap } from "../ctl-math";
import { controlKind, type RemoteControl } from "../config";
import { MF_SELECT_SOURCE } from "../const";
import type { RemoteHost } from "../host";

// Source chips — gated on SELECT_SOURCE so a player that lists sources it can't
// actually switch doesn't render dead controls.
/** The source chip row; nothing unless the player advertises SELECT_SOURCE with sources. */
export function renderSources(
  host: RemoteHost,
  hl: unknown,
): TemplateResult | string {
  const mp = host.mp();
  if (!mp || !mpSupports(mp, MF_SELECT_SOURCE)) return "";
  const all = allSources(host.dev(), mp);
  if (!all.length) return "";
  return overflowChips({
    hl,
    all,
    collapsed: favSources(host.dev().favourites, all),
    activeValue: mp.attributes.source,
    open: host.srcOpen,
    onToggle: () => host.toggleSrc(),
    onSelect: (s) => host.mpDo("select_source", { source: s.source || s.name }),
  });
}

// A select/input_select as a chip row (picture-style presets etc.), collapsing to
// the first few when there are many.
function ctlSelect(
  host: RemoteHost,
  hl: unknown,
  item: RemoteControl,
  st: HassEntity,
  name: string,
): TemplateResult | typeof nothing {
  const options = (st.attributes && st.attributes.options) || [];
  if (!options.length) return nothing;
  const all = options.map((o: string) => ({ name: o, source: o }));
  const open = host.ctlOpen(item.entity);
  const dom = item.entity.split(".")[0];
  return html`<div class="ctl">
    <div class="ctl-lab"><span>${name}</span></div>
    ${overflowChips({
      hl,
      all,
      collapsed: all.length > 8 ? all.slice(0, 6) : null,
      activeValue: st.state,
      open,
      onToggle: () => host.ctlToggle(item.entity),
      onSelect: (s) =>
        host.ctlDo(dom, "select_option", {
          entity_id: item.entity,
          option: s.source || s.name,
        }),
    })}
  </div>`;
}

// A light (brightness) or number as a drag slider, reusing the shared track +
// per-entity hold/drag built in setConfig.
function ctlSlider(
  host: RemoteHost,
  item: RemoteControl,
  st: HassEntity,
  name: string,
): TemplateResult | typeof nothing {
  const { entity } = item;
  const s = host.ctlSlider(entity);
  if (!s) return nothing;
  const b = ctlBounds(host.hass, entity);
  const gone = isUnavail(st);
  const v = host.ctlValue(entity, s);
  const valueText =
    entity.split(".")[0] === "light"
      ? `${Math.round(v)}%`
      : fmtNum(host.hass, v, Number.isInteger(b.step) ? 0 : 1);
  return html`<div class="ctl">
    <div class="ctl-lab">
      <span>${name}</span><span class="ctl-val">${gone ? "" : valueText}</span>
    </div>
    ${sliderTrack({
      pct: ctlPct(host.hass, entity, v),
      disabled: gone,
      dragging: s.dragging,
      label: name,
      value: v,
      min: b.min,
      max: b.max,
      step: b.step,
      valueText,
      onInput: (nv) => s.input(ctlSnap(host.hass, entity, nv)),
      onDown: s.drag.down,
      onMove: s.drag.move,
      onUp: s.drag.up,
      onCancel: s.drag.cancel,
      onLost: s.drag.lost,
    })}
  </div>`;
}

// A switch/input_boolean as a labelled pill toggle (screen-off etc.).
function ctlToggle(
  host: RemoteHost,
  item: RemoteControl,
  st: HassEntity,
  name: string,
): TemplateResult {
  const dom = item.entity.split(".")[0];
  return html`<div class="ctl ctl-row">
    <div class="ctl-lab"><span>${name}</span></div>
    ${pillSwitch({
      on: st.state === "on",
      label: name,
      onClick: () => host.ctlDo(dom, "toggle", { entity_id: item.entity }),
    })}
  </div>`;
}

// A button/scene as a single press key.
function ctlButton(
  host: RemoteHost,
  type: string,
  item: RemoteControl,
  name: string,
): TemplateResult {
  const dom = item.entity.split(".")[0];
  const service = type === "scene" ? "turn_on" : "press";
  return html`<div class="ctl ctl-row">
    <div class="ctl-lab"><span>${name}</span></div>
    <button
      type="button"
      class="key"
      aria-label=${name}
      @click=${() => host.ctlDo(dom, service, { entity_id: item.entity })}
    >
      <fib-icon icon=${item.icon || "solar:play-bold-duotone"}></fib-icon>
    </button>
  </div>`;
}

function control(
  host: RemoteHost,
  hl: unknown,
  item: RemoteControl,
): TemplateResult | typeof nothing {
  const st = host.hass && host.hass.states[item.entity];
  if (!st) return nothing;
  const type = controlKind(item);
  const name =
    item.name || (st.attributes && st.attributes.friendly_name) || item.entity;
  switch (type) {
    case "select":
      return ctlSelect(host, hl, item, st, name);
    case "light":
    case "number":
      return ctlSlider(host, item, st, name);
    case "toggle":
      return ctlToggle(host, item, st, name);
    case "button":
    case "scene":
      return ctlButton(host, type, item, name);
    default:
      return nothing;
  }
}

// The generic controls panel: render each configured control by kind. Skips
// controls whose entity isn't loaded, so a stale entity id leaves no dead row.
/** The optional `controls:` panel; nothing when no controls resolve to a live entity. */
export function renderControls(
  host: RemoteHost,
  hl: unknown,
): TemplateResult | string {
  const list = host.dev().controls;
  if (!Array.isArray(list) || !list.length) return "";
  const rows = list
    .map((item) => control(host, hl, item))
    .filter((r) => r !== nothing);
  if (!rows.length) return "";
  return html`<div class="controls">${rows}</div>`;
}
