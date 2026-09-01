/* ================================================================== *
 * BODY LAYER — the singleton bar  (lit-html markup + Tailwind, kept iOS CSS)
 *
 * The bar is a body-appended singleton (so `position: fixed` pins to the
 * viewport, not Lovelace's transformed containing block). Its buttons render
 * via lit-html with Tailwind utilities from the shared adopted sheet; the
 * container's iOS-tuned rules (safe-area padding, the box-shadow overscroll
 * floor, translateZ layer) stay as hand-written CSS — deliberately not
 * disturbed.
 * ================================================================== */
import { render, html, nothing } from "lit";
import { twSheet } from "./tw.js";
import { T } from "./tokens.js";
import { norm, here, navigate } from "./util.js";
import { nav, registerTabs } from "./nav-stack.js";
import { setTabHiding, removeTabHiding } from "./hide-tabs.js";
import "./icon.js";

export const bar = {
  host: null,
  owners: new Set(),
  config: null,
  height: 0,
  hidden: false,
  lastScroll: 0,
};

/* load-bearing container CSS (see file header) — buttons are Tailwind */
const HOST_CSS = `
  :host {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; display: block;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none; user-select: none;
    touch-action: manipulation;
    transition: transform .22s ease;
  }
  :host([data-hidden="true"]) { transform: translateY(110%); }
  @media (prefers-reduced-motion: reduce) { :host { transition: none; } }
  .bar {
    display: flex; align-items: stretch; gap: 2px;
    background: ${T.nav};
    border-top: 1px solid ${T.line};
    padding: 7px 6px calc(9px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 60px 0 60px ${T.nav};
    transform: translateZ(0);
  }
`;
const hostSheet = new CSSStyleSheet();
hostSheet.replaceSync(HOST_CSS);

export function measureBar() {
  if (!bar.host) return;
  const div = bar.host.shadowRoot.querySelector(".bar");
  const h = div ? div.getBoundingClientRect().height : 0;
  if (h && Math.abs(h - bar.height) > 0.5) {
    bar.height = h;
    bar.owners.forEach((o) => o._syncSpacer && o._syncSpacer());
  }
}

// Named module-level handlers so re-adding on a rebuild is a no-op (the browser
// dedupes identical type+listener+options) — an anonymous closure would leak one
// listener per attach/detach cycle.
const onOrientationChange = () => setTimeout(measureBar, 250);

function buildBar() {
  const host = document.createElement("div");
  host.id = "fibbers-nav";
  host.setAttribute("role", "navigation");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.adoptedStyleSheets = [twSheet, hostSheet];
  const div = document.createElement("div");
  div.className = "bar";
  shadow.append(div);
  document.body.appendChild(host);

  if (window.ResizeObserver)
    new ResizeObserver(() => measureBar()).observe(div);
  window.addEventListener("orientationchange", onOrientationChange);
  window.addEventListener("resize", measureBar);

  return host;
}

function tabMatches(tab, path) {
  const target = norm(tab.path);
  if (tab.match === "prefix")
    return path === target || path.startsWith(target + "/");
  return path === target;
}

function activeIndex(tabs, path) {
  const exact = tabs.findIndex((t) => norm(t.path) === path);
  if (exact !== -1) return exact;
  const pre = tabs.findIndex((t) => tabMatches(t, path));
  if (pre !== -1) return pre;
  const root = nav.stack.length ? norm(nav.stack[0]) : null;
  return root ? tabs.findIndex((t) => norm(t.path) === root) : -1;
}

function badgeActive(badge, hass) {
  const st = hass && hass.states[badge.entity];
  if (!st) return false;
  if (badge.when) return st.state === badge.when;
  return !["off", "unavailable", "unknown"].includes(st.state);
}

const press = (e, on) =>
  on
    ? e.currentTarget.setAttribute("data-pressed", "true")
    : e.currentTarget.removeAttribute("data-pressed");

export function renderBar() {
  if (!bar.host || !bar.config) return;
  const div = bar.host.shadowRoot.querySelector(".bar");
  const tabs = bar.config.tabs || [];
  const active = activeIndex(tabs, here());

  render(
    html`${tabs.map((tab, i) => {
      const badge = tab.badge && badgeActive(tab.badge, nav.hassRef);
      return html`<button
        type="button"
        aria-current=${i === active ? "page" : nothing}
        class="relative flex min-w-0 flex-1 flex-col items-center gap-[3px] rounded-[9px]
               px-0.5 pb-[3px] pt-[5px] text-[9.5px] font-medium leading-[1.1] tracking-[0.01em]
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent
               focus-visible:[outline-offset:-2px]
               data-[pressed=true]:bg-[rgba(255,255,255,0.06)]
               ${
                 i === active
                   ? "bg-[rgba(116,185,138,0.10)] text-accent"
                   : "text-muted"
               }"
        @pointerdown=${(e) => press(e, true)}
        @pointerup=${(e) => press(e, false)}
        @pointercancel=${(e) => press(e, false)}
        @pointerleave=${(e) => press(e, false)}
        @click=${() => {
          if (norm(tab.path) === here()) return;
          navigate(tab.path);
        }}
      >
        <fib-icon
          class="pointer-events-none h-[17px] w-[17px] [--mdc-icon-size:17px]"
          icon=${tab.icon || "solar:record-circle-bold-duotone"}
        ></fib-icon>
        <span class="pointer-events-none">${tab.name || ""}</span>
        ${
          badge
            ? html`<span
                class="absolute left-1/2 top-1 ml-[7px] h-[5px] w-[5px] rounded-full bg-accent"
              ></span>`
            : ""
        }
      </button>`;
    })}`,
    div,
  );
  measureBar();
}

let autoHideBound = false;
function enableAutoHide() {
  if (autoHideBound) return;
  autoHideBound = true;
  document.addEventListener(
    "scroll",
    (e) => {
      const y = (e.target && e.target.scrollTop) || 0;
      const dy = y - bar.lastScroll;
      if (Math.abs(dy) < 6) return;
      bar.lastScroll = y;
      const hide = dy > 0 && y > 40;
      if (hide !== bar.hidden && bar.host) {
        bar.hidden = hide;
        bar.host.setAttribute("data-hidden", String(hide));
      }
    },
    { capture: true, passive: true },
  );
}

export function attach(owner, config) {
  bar.owners.add(owner);
  bar.config = config;
  registerTabs((config.tabs || []).map((t) => t.path));
  if (!bar.host || !document.body.contains(bar.host)) bar.host = buildBar();
  const offset = Number(config.offset_bottom) || 0;
  bar.host.style.bottom = offset ? offset + "px" : "";
  renderBar();
  measureBar();
  if (config.auto_hide) enableAutoHide();
  setTabHiding(config.hide_ha_tabs);
}

export function detach(owner) {
  bar.owners.delete(owner);
  if (bar.owners.size === 0 && bar.host) {
    bar.host.remove();
    bar.host = null;
    bar.height = 0;
    removeTabHiding();
  }
}

nav.listeners.add(renderBar);
window.addEventListener("hashchange", renderBar);
