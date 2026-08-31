/* ================================================================== *
 * BODY LAYER — the singleton bar
 * ================================================================== */
import { T } from "./tokens.js";
import { norm, here, navigate } from "./util.js";
import { nav, registerTabs } from "./nav-stack.js";
import { setTabHiding, removeTabHiding } from "./hide-tabs.js";

export const bar = {
  host: null,
  owners: new Set(),
  config: null,
  height: 0,
  hidden: false,
  lastScroll: 0,
};

const BAR_CSS = `
  :host {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 6;
    display: block;
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none; user-select: none;
    touch-action: manipulation;
    transition: transform .22s ease;
  }
  :host([data-hidden="true"]) { transform: translateY(110%); }
  @media (prefers-reduced-motion: reduce) { :host { transition: none; } }

  .bar {
    display: flex;
    align-items: stretch;
    gap: 2px;
    background: ${T.nav};
    border-top: 1px solid ${T.line};
    /* env() is 0 unless the webview sets viewport-fit=cover, hence the 9px
       floor rather than trusting the inset alone */
    padding: 7px 6px calc(9px + env(safe-area-inset-bottom, 0px));
    /* Solid block painted below the bar. iOS rubber-band overscroll can drag
       the page past it; without this you get a seam of app background.
       Deliberately NOT backdrop-filter, which flickers in WKWebView on a
       fixed element — that was the original artefact. */
    box-shadow: 0 60px 0 60px ${T.nav};
    /* own compositing layer: stops judder during momentum scroll */
    transform: translateZ(0);
  }

  button {
    flex: 1 1 0;
    min-width: 0;
    appearance: none;
    border: 0;
    background: none;
    color: ${T.muted};
    font: inherit;
    font-size: 9.5px;
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: .01em;
    padding: 5px 2px 3px;
    border-radius: 9px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    position: relative;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  button fib-icon {
    --mdc-icon-size: 17px;
    width: 17px; height: 17px;
    color: inherit;
    pointer-events: none;
  }
  button span { pointer-events: none; }
  /* :active is unreliable in WKWebView, so pressed state is driven from JS */
  button[data-pressed="true"] { background: rgba(255,255,255,.06); }
  button[aria-current="page"] { color: ${T.accent}; background: ${T.accentSoft}; }
  button:focus-visible { outline: 2px solid ${T.accent}; outline-offset: -2px; }

  .dot {
    position: absolute;
    top: 4px; left: 50%;
    margin-left: 7px;
    width: 5px; height: 5px;
    border-radius: 50%;
    background: ${T.accent};
  }
`;

export function measureBar() {
  if (!bar.host) return;
  const div = bar.host.shadowRoot.querySelector(".bar");
  const h = div ? div.getBoundingClientRect().height : 0;
  if (h && Math.abs(h - bar.height) > 0.5) {
    bar.height = h;
    bar.owners.forEach((o) => o._syncSpacer && o._syncSpacer());
  }
}

function buildBar() {
  const host = document.createElement("div");
  host.id = "fibbers-nav";
  host.setAttribute("role", "navigation");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = BAR_CSS;
  const div = document.createElement("div");
  div.className = "bar";
  shadow.append(style, div);
  document.body.appendChild(host);

  // keep the reserved spacer honest across rotation and font-size changes
  if (window.ResizeObserver)
    new ResizeObserver(() => measureBar()).observe(div);
  window.addEventListener("orientationchange", () =>
    setTimeout(measureBar, 250),
  );
  window.addEventListener("resize", measureBar);

  return host;
}

/** prefix match so a subview can highlight the tab it belongs to */
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
  // a subview keeps its originating tab lit
  const root = nav.stack.length ? norm(nav.stack[0]) : null;
  return root ? tabs.findIndex((t) => norm(t.path) === root) : -1;
}

function badgeActive(badge, hass) {
  const st = hass && hass.states[badge.entity];
  if (!st) return false;
  if (badge.when) return st.state === badge.when;
  return !["off", "unavailable", "unknown"].includes(st.state);
}

export function renderBar() {
  if (!bar.host || !bar.config) return;
  const root = bar.host.shadowRoot.querySelector(".bar");
  const tabs = bar.config.tabs || [];

  if (root.childElementCount !== tabs.length) {
    root.textContent = "";
    tabs.forEach((tab) => {
      const b = document.createElement("button");
      b.type = "button";
      const icon = document.createElement("fib-icon");
      icon.setAttribute("icon", tab.icon || "solar:record-circle-bold-duotone");
      const span = document.createElement("span");
      span.textContent = tab.name || "";
      b.append(icon, span);
      b.addEventListener("pointerdown", () =>
        b.setAttribute("data-pressed", "true"),
      );
      ["pointerup", "pointercancel", "pointerleave"].forEach((ev) =>
        b.addEventListener(ev, () => b.removeAttribute("data-pressed")),
      );
      b.addEventListener("click", () => {
        if (norm(tab.path) === here()) return;
        navigate(tab.path);
      });
      root.appendChild(b);
    });
    measureBar();
  }

  const active = activeIndex(tabs, here());
  [...root.children].forEach((b, i) => {
    if (i === active) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");

    const badge = tabs[i] && tabs[i].badge;
    const existing = b.querySelector(".dot");
    const show = badge && badgeActive(badge, nav.hassRef);
    if (show && !existing) {
      const d = document.createElement("span");
      d.className = "dot";
      b.appendChild(d);
    } else if (!show && existing) {
      existing.remove();
    }
  });
}

/* hide on scroll down, reveal on scroll up — opt in via auto_hide: true */
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
  // Lift the whole bar above the OS/companion-app tab strip that may run under
  // it. The box-shadow floor (60px) still covers the gap for typical offsets;
  // the reserved spacer grows by the same amount (see FibbersNav._syncSpacer).
  const offset = Number(config.offset_bottom) || 0;
  bar.host.style.bottom = offset ? offset + "px" : "";
  renderBar();
  measureBar();
  if (config.auto_hide) enableAutoHide();
  // follow the current config's HA-tab-hiding preference
  setTabHiding(config.hide_ha_tabs);
}

export function detach(owner) {
  bar.owners.delete(owner);
  if (bar.owners.size === 0 && bar.host) {
    bar.host.remove();
    bar.host = null;
    bar.height = 0;
    // last bar gone — restore HA's own chrome so a bar-less dashboard is never
    // left with hidden, unnavigable tabs.
    removeTabHiding();
  }
}

nav.listeners.add(renderBar);
window.addEventListener("hashchange", renderBar);
