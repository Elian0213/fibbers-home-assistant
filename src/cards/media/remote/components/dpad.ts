/* ================================================================== *
 * fibbers-remote — the direction pad: an SVG donut wheel (with an optional swipe
 * surface + arrow-key handling) or a 3×3 grid. Pure view functions over a RemoteHost.
 * ================================================================== */
import { html, svg, nothing, type TemplateResult } from "lit";

import { t } from "@shared/i18n";
import { activateOnKey } from "@shared/ui";

import { SEG, CHEV, ARROW } from "../const";
import type { RemoteHost } from "../host";
import { renderTouchpad } from "./touchpad";
import { renderHero } from "./hero";

// Keyboard for the swipe surface (which has no arrow buttons to Tab to). Only
// acts on the container's own key events — a keydown bubbling up from a focused
// sector is handled by that sector, not stolen here.
function dpadKey(host: RemoteHost, e: KeyboardEvent): void {
  if (e.target !== e.currentTarget) return;
  const map: Record<string, string> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Enter: "ok",
    " ": "ok",
  };
  const key = map[e.key];
  if (!key) return;
  e.preventDefault();
  host.send(key);
}

// The SVG donut. Sectors are individually focusable buttons (native Enter/Space);
// `swipe`/`both` add a swipe surface (from the gaps and hub) + arrow-key handling.
function wheel(
  host: RemoteHost,
  has: (k: string) => boolean,
  mode: string,
): TemplateResult {
  const swipe = mode === "swipe" || mode === "both";
  // On a swipe surface a tap on a sector must not also trigger the container swipe.
  const stop = swipe ? (e: Event) => e.stopPropagation() : undefined;
  const sector = (k: string, label: string) =>
    has(k)
      ? svg`<path
          class="seg ${host.flash === k ? "flash" : ""}"
          d=${SEG[k].d}
          role="button"
          tabindex="0"
          aria-label=${label}
          @click=${() => host.send(k)}
          @keydown=${activateOnKey(() => host.send(k))}
          @pointerdown=${stop}
        ></path>
        <path
          class="glyph"
          d=${CHEV[k]}
          transform="translate(${SEG[k].ix},${SEG[k].iy})"
        ></path>`
      : nothing;
  return html`<svg
    class="wheel ${swipe ? "swipe" : ""}"
    data-fib-gesture=${swipe ? "own" : nothing}
    viewBox="-104 -104 208 208"
    role="group"
    aria-label=${
      swipe
        ? "Direction pad — tap a sector, swipe, or use the arrow keys"
        : "Direction pad"
    }
    tabindex=${swipe ? 0 : nothing}
    @keydown=${swipe ? (e: KeyboardEvent) => dpadKey(host, e) : nothing}
    @pointerdown=${swipe ? host.swipe.start : nothing}
    @pointerup=${swipe ? host.swipe.end : nothing}
    @pointercancel=${swipe ? host.swipe.cancel : nothing}
  >
    ${sector("up", "Up")}${sector("right", "Right")}${sector("down", "Down")}${sector(
      "left",
      "Left",
    )}
    ${
      has("ok")
        ? svg`<circle
            class="hub"
            cx="0"
            cy="0"
            r="35"
            role="button"
            tabindex="0"
            aria-label="OK"
            @click=${() => host.send("ok")}
            @keydown=${activateOnKey(() => host.send("ok"))}
            @pointerdown=${stop}
          ></circle>
          <text class="hubtx" x="0" y="1" aria-hidden="true">OK</text>`
        : nothing
    }
  </svg>`;
}

// 3×3 grid alternative: up/left/OK/right/down, empty corners; every cell ≥44px.
function pad(host: RemoteHost, has: (k: string) => boolean): TemplateResult {
  const cell = (k: string, label: string) =>
    has(k)
      ? html`<button
          type="button"
          aria-label=${label}
          class=${host.flash === k ? "flash" : ""}
          @click=${() => host.send(k)}
        >
          <fib-icon
            class="h-5 w-5 [--mdc-icon-size:20px]"
            icon=${ARROW[k]}
          ></fib-icon>
        </button>`
      : html`<span class="blank"></span>`;
  return html`<div class="pad" role="group" aria-label="D-pad">
    <span class="blank"></span>${cell("up", "Up")}<span class="blank"></span>
    ${cell("left", "Left")}
    ${
      has("ok")
        ? html`<button
            type="button"
            class="ok"
            aria-label="OK"
            @click=${() => host.send("ok")}
          >
            OK
          </button>`
        : html`<span class="blank"></span>`
    }
    ${cell("right", "Right")}
    <span class="blank"></span>${cell("down", "Down")}<span
      class="blank"
    ></span>
  </div>`;
}

/** The primary zone: nothing / a now-playing hero for a device with no directional
 *  commands, else the touchpad, wheel or grid. The hero fills a speaker's primary
 *  zone so every remote in a swipe deck stands the same height. */
export function renderDpad(
  host: RemoteHost,
  hl: unknown,
): TemplateResult | string {
  const has = (k: string): boolean => !!host.cmd(k);
  // No directional commands (a speaker, or generic with none): a media_player device
  // gets the now-playing hero; a bare remote with nothing to drive gets nothing.
  if (!["up", "down", "left", "right", "ok"].some(has))
    return host.mp() ? renderHero(host, hl) : "";
  // Apple TV defaults to the touchpad; every other platform keeps buttons. An
  // explicit `dpad:` always wins.
  const mode =
    host.dev().dpad ||
    (host.kindOf(host.dev()) === "appletv" ? "touchpad" : "buttons");
  if (mode === "touchpad")
    return renderTouchpad({
      ctrl: host.touchpad,
      onKey: (e) => dpadKey(host, e),
      label: t(hl, "remote.touchpad_hint"),
      disabled: host.unavail(),
    });
  return mode === "grid" ? pad(host, has) : wheel(host, has, mode);
}
