/* ================================================================== *
 * light-detail-views — the presentational fragments (template functions) of the
 * light-detail card: brightness/temp slider row, quick swatches, the colour/warm
 * wheel disc, lamp tiles, single-light header, and the room top bar. Each is a
 * pure function returning a TemplateResult, taking a narrow `LightDetailHost` the
 * element implements — mirrors how sliderTrack/pillSwitch take an options object.
 * ================================================================== */
import { html, type TemplateResult } from "lit";
import { ref } from "lit/directives/ref.js";

import { closeSheet } from "@core/body-sheet";
import { t } from "@shared/i18n";
import {
  sliderTrack,
  pillSwitch,
  activateOnKey,
  dragScroll,
  type SliderController,
} from "@shared/ui";
import { cx, pressable } from "@shared/variants";
import type { HomeAssistant } from "@/types/home-assistant";
import "@shared/icon";

import { WHITES, HUES } from "./light-detail-math";
import {
  lampState,
  lampOn,
  lampUnavail,
  lampAttr,
  lampHasTemp,
  lampHasColor,
  swatchColor,
} from "./light-detail-lamps";
import type { WheelController } from "./light-detail-wheel";
import type { LightDetailConfig } from "./light-detail";

/**
 * The element-side contract the view functions read. The element implements it;
 * the wheel controller's WheelHost is a subset of the same members.
 */
export interface LightDetailHost {
  hass?: HomeAssistant;
  config: LightDetailConfig;
  wheel: WheelController;
  /** The current lamp set (a room's siblings, else just the one light). */
  lamps(): string[];
  /** The brightness/temp/group slider controller for a key. */
  slider(key: string): SliderController;
  /** The displayed 0–100 value for a slider key. */
  pct(key: string): number;
  /** Active-lamp unavailable? (disables the single-light sliders.) */
  unavail(): boolean;
  /** Whole room gone? (gates the group slider.) */
  allUnavail(): boolean;
  /** Toggle a lamp (or the active one). */
  toggle(id?: string): void;
  /** Apply one service call to every lamp (or the active one). */
  applyAll(data: Record<string, unknown>): void;
}

/** A labelled slider row (brightness / temperature / group). */
export function sliderRow(
  host: LightDetailHost,
  key: string,
  label: string,
  valueText: string,
  opts: { gradient?: string; disabled?: boolean } = {},
): TemplateResult {
  const s = host.slider(key);
  const pct = host.pct(key);
  // Off is not disabled — parity with light-row. Only an unavailable lamp is
  // disabled (dragging an off lamp turns it on; drag to zero turns it off).
  const disabled = opts.disabled ?? host.unavail();
  return html`<div class="grid gap-1.5">
    <div class="flex items-center justify-between text-[11px]">
      <span class="font-medium uppercase tracking-[0.1em] text-muted"
        >${label}</span
      >
      <span class="tabular-nums text-ink2">${disabled ? "" : valueText}</span>
    </div>
    ${sliderTrack({
      pct,
      disabled,
      dragging: s.dragging,
      gradient: opts.gradient,
      label,
      value: pct,
      min: 0,
      max: 100,
      step: 5,
      valueText,
      onInput: (v) => s.input(Math.round(v)),
      onDown: s.drag.down,
      onMove: s.drag.move,
      onUp: s.drag.up,
      onCancel: s.drag.cancel,
      onLost: s.drag.lost,
    })}
  </div>`;
}

/** Quick swatches: whites (kelvin) then a spread of hues, applied to all lamps. */
export function swatches(host: LightDetailHost, hl: unknown): TemplateResult {
  const btn = (bg: string, aria: string, onClick: () => void): TemplateResult =>
    html`<button
      type="button"
      aria-label=${aria}
      class="fib-hit h-8 w-8 flex-none rounded-full border border-[rgba(255,255,255,.15)]
           shadow-[0_1px_3px_rgba(0,0,0,.4)] transition-transform active:scale-90 ${pressable({ hover: "bright" })}"
      style="background:${bg}"
      @click=${onClick}
    ></button>`;
  const anyTemp = host.lamps().some((id) => lampHasTemp(host.hass, id));
  const anyColour = host.lamps().some((id) => lampHasColor(host.hass, id));
  return html`<div class="fib-scroll flex gap-2 overflow-x-auto pb-1">
    ${
      anyTemp
        ? WHITES.map((w) =>
            btn(w.css, `${t(hl, `light_detail.${w.key}`)} (${w.k}K)`, () =>
              host.applyAll({ color_temp_kelvin: w.k }),
            ),
          )
        : ""
    }
    ${
      anyColour
        ? HUES.map((h) =>
            btn(
              `hsl(${h} 90% 55%)`,
              `${t(hl, "light_detail.colour")} ${h}°`,
              () => host.applyAll({ hs_color: [h, 90] }),
            ),
          )
        : ""
    }
  </div>`;
}

// A small count badge for a grouped lamp (tile corner). 0/1 → nothing.
function groupBadge(
  host: LightDetailHost,
  id: string,
): TemplateResult | string {
  const n = host.wheel.groupCount(id);
  if (n < 2) return "";
  return html`<span
    class="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center
           rounded-full bg-accent px-0.5 text-[9px] font-bold leading-none text-[#0c1510]"
    >${n}</span
  >`;
}

/**
 * One wheel: colour lamps by hue/saturation, warm-only lamps by kelvin radius,
 * warm-white centre; each on lamp is a draggable icon marker.
 */
export function wheelDisc(host: LightDetailHost, hl: unknown): TemplateResult {
  const { wheel } = host;
  const lamps = wheel.wheelLamps();
  const disabled = !lamps.length;
  const active = host.config.entity;
  let activeText = "";
  if (wheel.isWarm(active)) {
    activeText = `${Math.round(wheel.dispK(active) || 0)} K`;
  } else {
    const [ah, as] = wheel.dispHs(active);
    activeText = `${Math.round(ah)}°, ${Math.round(as)}%`;
  }
  // The wheel is a 2D hue/saturation picker, not a linear slider, so it carries
  // aria-valuetext (e.g. "210°, 80%") rather than a single aria-valuenow. The disc
  // is a DONUT: an outer colour ring (`.fib-wheel-ring`, masked to a hole in CSS)
  // around a warm-white centre (`.fib-wheel-center`); both are decorative and
  // pointer-transparent so the container keeps every touch handler unchanged.
  // eslint-disable-next-line lit-a11y/role-has-required-aria-attrs
  return html`<div
    class="fib-wheel relative mx-auto aspect-square w-full max-w-[280px] touch-none
           select-none rounded-full ${disabled ? "pointer-events-none opacity-40" : "cursor-pointer"}"
    role="slider"
    tabindex=${disabled ? -1 : 0}
    aria-label=${t(hl, "light_detail.colour")}
    aria-valuetext=${activeText}
    aria-disabled=${disabled ? "true" : "false"}
    @pointerdown=${wheel.drag.down}
    @pointermove=${wheel.drag.move}
    @pointerup=${wheel.drag.up}
    @pointercancel=${wheel.drag.cancel}
    @lostpointercapture=${wheel.drag.lost}
    @keydown=${wheel.onKey}
  >
    <div
      class="fib-wheel-ring ${wheel.isWarmDrag() ? "is-dim" : ""}"
      aria-hidden="true"
    ></div>
    <div class="fib-wheel-center" aria-hidden="true"></div>
    ${wheel.units().map((u) => {
      const p = wheel.unitXY(u);
      const isActive = u.members.includes(active);
      const icon =
        (lampAttr(host.hass, u.rep, "icon") as string) ||
        "solar:lightbulb-bold-duotone";
      const count = u.members.length;
      return html`<div
        class="fib-node pointer-events-none absolute flex items-center justify-center
               rounded-full border shadow-[0_2px_6px_rgba(0,0,0,.55)]
               ${isActive ? "fib-node--active h-9 w-9 border-2 border-accent" : "h-8 w-8 border-[rgba(0,0,0,.35)]"}
               ${wheel.isDragging(u.rep) ? "fib-node--dragging" : ""}"
        style="left:${p.x}%;top:${p.y}%;background:${swatchColor(host.hass, u.rep)}"
      >
        <fib-icon
          class="h-4 w-4 [--mdc-icon-size:16px] text-white
                 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
          icon=${icon}
        ></fib-icon>
        ${
          count > 1
            ? html`<span
                class="fib-badge absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center
                       justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold
                       leading-none text-[#0c1510] shadow-[0_1px_2px_rgba(0,0,0,.6)]"
                >${count}</span
              >`
            : ""
        }
      </div>`;
    })}
  </div>`;
}

/**
 * Equal square tiles in a horizontal scroll: each shows the lamp's real colour, an
 * instant on/off toggle, and its name; tapping a tile focuses that lamp for the
 * colour/warm picker (active = accent border).
 */
export function lampTiles(host: LightDetailHost, hl: unknown): TemplateResult {
  const active = host.config.entity;
  // The whole colour-cluster of the focused lamp floats to the front and is
  // highlighted (the focused lamp strongest); the element FLIP-animates the move.
  const front = new Set(host.wheel.membersOf(active));
  return html`<div
    class="lamp-tiles lamp-scroll flex gap-2 overflow-x-auto pb-1"
    ${ref((el) => el && dragScroll(el as HTMLElement))}
  >
    ${host.lamps().map((id) => {
      const on = lampOn(host.hass, id);
      const unavail = lampUnavail(host.hass, id);
      const nm = (lampAttr(host.hass, id, "friendly_name") as string) || id;
      const isActive = id === active;
      const inFront = front.has(id);
      // Border/bg tone: focused lamp strongest, its colour-cluster ringed, rest plain.
      let tone = "border-line bg-card2";
      if (isActive) tone = "border-accent bg-accentbg";
      else if (inFront) tone = "border-accentline bg-accentbg";
      const icon =
        (lampAttr(host.hass, id, "icon") as string) ||
        "solar:lightbulb-bold-duotone";
      // Button-underlay: a full-size transparent select button sits behind the
      // (pointer-events-none) content, and the toggle re-enables its own pointer
      // events on top — so there are no nested interactive elements.
      // Tiles hold a stable order; the focused colour-group is ringed in place (the
      // focused lamp strongest), which fades in via the tile's transition-colors.
      return html`<div
        class="relative flex h-[100px] w-[104px] flex-none flex-col items-center
               justify-between rounded-[14px] border p-2.5 text-center transition-colors
               ${tone} ${unavail ? "opacity-50" : ""}"
      >
        <button
          type="button"
          class="absolute inset-0 cursor-pointer rounded-[14px] transition-colors
                 hover:bg-white/[.04]"
          aria-pressed=${isActive ? "true" : "false"}
          aria-label=${nm}
          @click=${() => host.wheel.focusOrSolo(id)}
          @keydown=${activateOnKey(() => host.wheel.focusOrSolo(id))}
        ></button>
        <div
          class="pointer-events-none relative flex h-full w-full flex-col items-center justify-between"
        >
          <span
            class="relative flex h-8 w-8 flex-none items-center justify-center rounded-full
                   border border-[rgba(0,0,0,.3)] shadow-[0_1px_3px_rgba(0,0,0,.4)] transition-colors"
            style="background:${swatchColor(host.hass, id)}"
          >
            <fib-icon
              class="h-4 w-4 [--mdc-icon-size:16px] text-white
                     drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
              icon=${icon}
            ></fib-icon>
            ${groupBadge(host, id)}
          </span>
          <div class="min-w-0 w-full">
            <div
              class="truncate text-[11px] ${isActive ? "font-medium text-ink" : "text-ink2"}"
            >
              ${nm}
            </div>
            <div
              class="truncate text-[9px] uppercase tracking-[0.06em] text-muted"
            >
              ${
                lampHasColor(host.hass, id)
                  ? t(hl, "light_detail.colour")
                  : t(hl, "light_detail.white")
              }
            </div>
          </div>
          ${
            unavail
              ? html`<span class="text-[9px] uppercase text-muted"
                  >${t(hl, "light_detail.offline")}</span
                >`
              : html`<span class="pointer-events-auto"
                  >${pillSwitch({
                    on,
                    label: nm,
                    onClick: () => host.toggle(id),
                  })}</span
                >`
          }
        </div>
      </div>`;
    })}
  </div>`;
}

/** Single-light header — icon, name, on/off subtitle, power pill. */
export function renderHeader(
  host: LightDetailHost,
  hl: unknown,
  on: boolean,
): TemplateResult {
  const cfg = host.config;
  const st = lampState(host.hass, cfg.entity);
  const unavail = host.unavail();
  const title = cfg.name || (st && st.attributes.friendly_name) || cfg.entity;
  const icon =
    cfg.icon || (st && st.attributes.icon) || "solar:lightbulb-bold-duotone";
  let subtitle: string;
  if (unavail) subtitle = t(hl, "light_detail.offline");
  else if (on) subtitle = t(hl, "light_detail.on");
  else subtitle = t(hl, "light_detail.off");

  return html`<div class="flex items-center gap-3">
    <div
      class="${cx(
        "flex h-9 w-9 flex-none items-center justify-center rounded-xl",
        on ? "bg-accentbg text-accent" : "bg-card2 text-muted",
      )}"
    >
      <fib-icon
        class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
        icon=${icon}
      ></fib-icon>
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-[14px] font-semibold text-ink">${title}</div>
      <div class="text-[11px] text-muted">${subtitle}</div>
    </div>
    ${pillSwitch({
      on,
      label: t(hl, "light_detail.power"),
      onClick: () => host.toggle(),
    })}
  </div>`;
}

/**
 * Room top bar — back on the left, the whole-room brightness beside it, and a
 * hairline under both.
 */
export function renderRoomBar(
  host: LightDetailHost,
  hl: unknown,
): TemplateResult {
  const cfg = host.config;
  const title = cfg.groupName || cfg.title || t(hl, "light_detail.lights");
  return html`<div class="grid gap-3.5">
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="flex h-9 w-9 flex-none items-center justify-center rounded-lg
               bg-card2 text-ink2 transition-colors ${pressable({ hover: "text" })}"
        aria-label=${t(hl, "back.back")}
        @click=${() => closeSheet()}
      >
        <fib-icon
          class="h-[18px] w-[18px] [--mdc-icon-size:18px]"
          icon="solar:alt-arrow-left-bold-duotone"
        ></fib-icon>
      </button>
      <div class="min-w-0 flex-1">
        ${sliderRow(host, "grp", title, `${host.pct("grp")}%`, {
          disabled: host.allUnavail(),
        })}
      </div>
    </div>
    <div class="border-t border-line"></div>
  </div>`;
}
