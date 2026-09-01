/* ================================================================== *
 * BODY LAYER — the singleton nav bar.
 * Rendered into document.body so position:fixed pins to the viewport (not
 * Lovelace's transformed container). The iOS-tuned container CSS is load-bearing.
 * ================================================================== */
import { render, html, nothing } from "lit";

import { setTabHiding, removeTabHiding } from "./hide-tabs.js";
import { nav, registerTabs } from "./nav-stack.js";
import { applyTheme, removeTheme } from "./theme.js";
import { T } from "./tokens.js";
import { twSheet } from "./tw.js";
import { norm, here, navigate, deepFind } from "./util.js";
import { setViewReserve, removeViewReserve } from "./view-reserve.js";
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
  /* desktop sidebar inset: drop the 60px horizontal spread so the overscroll
     floor never bleeds a nav-coloured slab over the sidebar */
  :host([data-inset="true"]) .bar { box-shadow: 0 60px 0 0 ${T.nav}; }
`;
const hostSheet = new CSSStyleSheet();
hostSheet.replaceSync(HOST_CSS);

export function measureBar() {
  if (!bar.host) return;
  const div = bar.host.shadowRoot.querySelector(".bar");
  const h = div ? div.getBoundingClientRect().height : 0;
  if (h && Math.abs(h - bar.height) > 0.5) {
    bar.height = h;
    syncViewReserve();
  }
}

// Reserve bottom space on the view so the bar never covers the last card.
// `reserve` is an absolute override (as before); otherwise it's the measured bar
// height plus optional `extra_bottom` breathing room. `offset_bottom` (which
// lifts the bar off the viewport floor) is added on top either way.
function syncViewReserve() {
  const cfg = bar.config || {};
  const offset = Number(cfg.offset_bottom) || 0;
  const extra = Number(cfg.extra_bottom) || 0;
  const base =
    cfg.reserve != null ? Number(cfg.reserve) : (bar.height || 74) + extra;
  setViewReserve(base + offset);
}

// Named module-level handlers so re-adding on a rebuild is a no-op (the browser
// dedupes identical type+listener+options) — an anonymous closure would leak one
// listener per attach/detach cycle.
const onOrientationChange = () => {
  setTimeout(measureBar, 250);
  scheduleInset();
};
const onResizeInset = () => scheduleInset();

/* ------------------------------------------------------------------ *
 * Sidebar inset — on desktop the docked ha-sidebar overlaps the pinned bar,
 * so inset the bar's start edge by the sidebar's measured width. 0 when the
 * drawer is modal (narrow), the sidebar is hidden, or respect_sidebar: false.
 * ------------------------------------------------------------------ */
let sidebarRO = null;
let drawerMO = null;
let insetScheduled = false;

function computeInset() {
  if (!bar.config || bar.config.respect_sidebar === false) return 0;
  const drawer = deepFind("ha-drawer");
  if (drawer && drawer.getAttribute("type") === "modal") return 0; // narrow → overlay
  if (nav.hassRef && nav.hassRef.dockedSidebar === "always_hidden") return 0;
  const sidebar = deepFind("ha-sidebar");
  const w = sidebar ? sidebar.getBoundingClientRect().width : 0;
  return w > 0 ? Math.round(w) : 0;
}

// Attach the observers once HA's shell exists; idempotent, safe to re-call.
function observeSidebar() {
  if (!sidebarRO && window.ResizeObserver) {
    const sidebar = deepFind("ha-sidebar");
    if (sidebar) {
      sidebarRO = new ResizeObserver(scheduleInset); // expand/collapse + rail
      sidebarRO.observe(sidebar);
    }
  }
  if (!drawerMO && window.MutationObserver) {
    const drawer = deepFind("ha-drawer");
    if (drawer) {
      drawerMO = new MutationObserver(scheduleInset); // narrow ↔ wide flip
      drawerMO.observe(drawer, { attributes: true, attributeFilter: ["type"] });
    }
  }
}

function syncSidebarInset() {
  if (!bar.host) return;
  observeSidebar();
  const inset = computeInset();
  bar.host.style.insetInlineStart = inset ? `${inset}px` : ""; // RTL-correct; right:0 stays
  if (inset) bar.host.setAttribute("data-inset", "true");
  else bar.host.removeAttribute("data-inset");
}

// One write per frame — the sidebar animates and fires a lot.
function scheduleInset() {
  if (insetScheduled) return;
  insetScheduled = true;
  requestAnimationFrame(() => {
    insetScheduled = false;
    syncSidebarInset();
  });
}

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
  window.addEventListener("resize", onResizeInset);

  return host;
}

function tabMatches(tab, path) {
  const target = norm(tab.path);
  if (tab.match === "prefix")
    return path === target || path.startsWith(`${target}/`);
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
        class="group relative flex min-w-0 flex-1 flex-col items-center pb-[3px] pt-[5px]
               focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent
               focus-visible:[outline-offset:-2px]"
        @pointerdown=${(e) => press(e, true)}
        @pointerup=${(e) => press(e, false)}
        @pointercancel=${(e) => press(e, false)}
        @pointerleave=${(e) => press(e, false)}
        @click=${() => {
          if (norm(tab.path) === here()) return;
          navigate(tab.path);
        }}
      >
        <!-- the highlight is capped to content width so it doesn't become a
             290px slab in a wide flex cell on desktop; the button stays the tap target -->
        <span
          class="pointer-events-none mx-auto flex w-full max-w-[96px] flex-col items-center
                 gap-[3px] rounded-[9px] px-3 py-1 text-[9.5px] font-medium leading-[1.1]
                 tracking-[0.01em] group-data-[pressed=true]:bg-[rgba(255,255,255,0.06)]
                 ${
                   i === active
                     ? "bg-[rgba(116,185,138,0.10)] text-accent"
                     : "text-muted"
                 }"
        >
          <fib-icon
            class="h-[17px] w-[17px] [--mdc-icon-size:17px]"
            icon=${tab.icon || "solar:record-circle-bold-duotone"}
          ></fib-icon>
          <span>${tab.name || ""}</span>
        </span>
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
  bar.host.style.bottom = offset ? `${offset}px` : "";
  renderBar();
  measureBar();
  syncViewReserve(); // apply on (re)config even if the height didn't change
  syncSidebarInset();
  setTimeout(scheduleInset, 200); // HA's shell may mount the sidebar a beat later
  if (config.auto_hide) enableAutoHide();
  setTabHiding(config.hide_ha_tabs);
  applyTheme(config.theme);
}

export function detach(owner) {
  bar.owners.delete(owner);
  if (bar.owners.size === 0 && bar.host) {
    bar.host.remove();
    bar.host = null;
    bar.height = 0;
    if (sidebarRO) {
      sidebarRO.disconnect();
      sidebarRO = null;
    }
    if (drawerMO) {
      drawerMO.disconnect();
      drawerMO = null;
    }
    removeTabHiding();
    removeTheme();
    removeViewReserve();
  }
}

nav.listeners.add(renderBar);
window.addEventListener("hashchange", renderBar);
