/*! Fibbers v0.1.0 — GENERATED from src/ by 'bun run build'. Do not hand-edit. */
(() => {

  // src/tokens.js
  var T = {
    bg: "#111516",
    card: "#1D2426",
    card2: "#262F31",
    line: "#333E41",
    ink: "#EDF1F1",
    ink2: "#A9B6B9",
    muted: "#7D8B8E",
    accent: "#74B98A",
    accentSoft: "rgba(116,185,138,.10)",
    accentBg: "#17281C",
    accentLine: "#2B4A34",
    accentTx: "#CFE6D5",
    amber: "#E8A33D",
    amberSoft: "rgba(232,163,61,.09)",
    amberBg: "#3A2B12",
    amberLine: "#4E3A18",
    amberTx: "#EBD9BC",
    blue: "#5AAFD6",
    blueBg: "#152B36",
    blueLine: "#2C5A70",
    blueInk: "#9BD2EA",
    green: "#63C295",
    red: "#EC8377",
    sheet: "#171E20",
    nav: "#161C1E",
    grab: "#3E4A4D",
    rowLine: "#262F31"
  };
  function styleBlock() {
    return `:host {
    --fib-bg: ${T.bg};
    --fib-card: ${T.card};
    --fib-card-2: ${T.card2};
    --fib-line: ${T.line};
    --fib-ink: ${T.ink};
    --fib-ink-2: ${T.ink2};
    --fib-muted: ${T.muted};
    --fib-accent: ${T.accent};
    --fib-accent-soft: ${T.accentSoft};
    --fib-accent-bg: ${T.accentBg};
    --fib-accent-line: ${T.accentLine};
    --fib-accent-tx: ${T.accentTx};
    --fib-amber: ${T.amber};
    --fib-amber-bg: ${T.amberBg};
    --fib-amber-line: ${T.amberLine};
    --fib-amber-tx: ${T.amberTx};
    --fib-blue: ${T.blue};
    --fib-blue-bg: ${T.blueBg};
    --fib-blue-line: ${T.blueLine};
    --fib-blue-ink: ${T.blueInk};
    --fib-green: ${T.green};
    --fib-red: ${T.red};
    --fib-sheet: ${T.sheet};
    --fib-nav: ${T.nav};
    --fib-grab: ${T.grab};
    --fib-row-line: ${T.rowLine};
  }`;
  }

  // src/util.js
  var store = {
    get(key, fallback) {
      try {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        sessionStorage.setItem(key, JSON.stringify(value));
      } catch (_) {}
    }
  };
  var norm = (p) => String(p || "").replace(/\/+$/, "") || "/";
  var here = () => norm(window.location.pathname);
  function navigate(path, { replace = false } = {}) {
    if (!path)
      return;
    if (String(path).startsWith("#")) {
      window.location.hash = path;
      return;
    }
    if (replace)
      history.replaceState(null, "", path);
    else
      history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace } }));
  }

  // src/nav-stack.js
  var NAV_KEY = "fibbers:navstack";
  var nav = {
    tabs: new Set,
    stack: store.get(NAV_KEY, []),
    listeners: new Set,
    hassRef: null
  };
  var registerTabs = (paths) => paths.forEach((p) => nav.tabs.add(norm(p)));
  var isTab = (path) => nav.tabs.has(norm(path));
  function onRouteChange() {
    const path = here();
    const s = nav.stack;
    if (isTab(path)) {
      nav.stack = [path];
    } else if (s.length >= 2 && norm(s[s.length - 2]) === path) {
      nav.stack = s.slice(0, -1);
    } else if (norm(s[s.length - 1]) !== path) {
      nav.stack = s.concat([path]);
    }
    if (nav.stack.length > 20)
      nav.stack = nav.stack.slice(-20);
    store.set(NAV_KEY, nav.stack);
    nav.listeners.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
  }
  var previous = () => nav.stack.length >= 2 ? nav.stack[nav.stack.length - 2] : null;
  function goBack(fallback) {
    const prev = previous();
    if (prev) {
      nav.stack = nav.stack.slice(0, -1);
      store.set(NAV_KEY, nav.stack);
      navigate(prev);
      return;
    }
    if (fallback) {
      navigate(fallback);
      return;
    }
    if (history.length > 1)
      history.back();
  }
  window.addEventListener("location-changed", onRouteChange);
  window.addEventListener("popstate", onRouteChange);
  onRouteChange();

  // src/hide-tabs.js
  var STYLE_ID = "fibbers-hide-tabs";
  var CSS = {
    true: `ha-tab-group { display: none !important; }`,
    header: `.header { display: none !important; }`
  };
  var state = {
    mode: false,
    observer: null,
    scheduled: false
  };
  function suppressed() {
    if (window.FIBBERS_SHOW_TABS === true)
      return true;
    try {
      return new URLSearchParams(window.location.search).has("disable_km");
    } catch (_) {
      return false;
    }
  }
  function findHuiRoot() {
    const stack = [document.documentElement];
    while (stack.length) {
      const el = stack.pop();
      if (el.localName === "hui-root")
        return el;
      if (el.shadowRoot)
        stack.push(...el.shadowRoot.children);
      if (el.children)
        stack.push(...el.children);
    }
    return null;
  }
  function findResolvedPanel() {
    const stack = [document.documentElement];
    while (stack.length) {
      const el = stack.pop();
      if (el.localName === "partial-panel-resolver")
        return el;
      if (el.shadowRoot)
        stack.push(...el.shadowRoot.children);
      if (el.children)
        stack.push(...el.children);
    }
    return null;
  }
  function paint() {
    if (!state.mode || suppressed())
      return removeStyle();
    const root = findHuiRoot();
    if (!root || !root.shadowRoot) {
      console.debug("fibbers: hui-root not found; leaving HA tabs untouched");
      return;
    }
    const css = CSS[state.mode];
    if (!css)
      return;
    let style = root.shadowRoot.getElementById(STYLE_ID);
    if (style) {
      if (style.textContent !== css)
        style.textContent = css;
      return;
    }
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    root.shadowRoot.appendChild(style);
  }
  function removeStyle() {
    const root = findHuiRoot();
    const style = root && root.shadowRoot && root.shadowRoot.getElementById(STYLE_ID);
    if (style)
      style.remove();
  }
  function schedulePaint() {
    if (state.scheduled)
      return;
    state.scheduled = true;
    setTimeout(() => {
      state.scheduled = false;
      paint();
    }, 60);
  }
  function startObserver() {
    if (state.observer)
      return;
    const panel = findResolvedPanel() || document.body;
    try {
      state.observer = new MutationObserver(schedulePaint);
      state.observer.observe(panel, { childList: true, subtree: true });
    } catch (_) {}
  }
  function stopObserver() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
  }
  function setTabHiding(mode) {
    const normalized = mode === true || mode === "header" ? mode : false;
    state.mode = normalized;
    if (!normalized) {
      removeTabHiding();
      return;
    }
    paint();
    startObserver();
  }
  function removeTabHiding() {
    state.mode = false;
    stopObserver();
    removeStyle();
  }
  window.addEventListener("location-changed", schedulePaint);
  window.addEventListener("popstate", schedulePaint);

  // src/body-layer.js
  var bar = {
    host: null,
    owners: new Set,
    config: null,
    height: 0,
    hidden: false,
    lastScroll: 0
  };
  var BAR_CSS = `
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
  function measureBar() {
    if (!bar.host)
      return;
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
    if (window.ResizeObserver)
      new ResizeObserver(() => measureBar()).observe(div);
    window.addEventListener("orientationchange", () => setTimeout(measureBar, 250));
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
    if (exact !== -1)
      return exact;
    const pre = tabs.findIndex((t) => tabMatches(t, path));
    if (pre !== -1)
      return pre;
    const root = nav.stack.length ? norm(nav.stack[0]) : null;
    return root ? tabs.findIndex((t) => norm(t.path) === root) : -1;
  }
  function badgeActive(badge, hass) {
    const st = hass && hass.states[badge.entity];
    if (!st)
      return false;
    if (badge.when)
      return st.state === badge.when;
    return !["off", "unavailable", "unknown"].includes(st.state);
  }
  function renderBar() {
    if (!bar.host || !bar.config)
      return;
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
        b.addEventListener("pointerdown", () => b.setAttribute("data-pressed", "true"));
        ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => b.addEventListener(ev, () => b.removeAttribute("data-pressed")));
        b.addEventListener("click", () => {
          if (norm(tab.path) === here())
            return;
          navigate(tab.path);
        });
        root.appendChild(b);
      });
      measureBar();
    }
    const active = activeIndex(tabs, here());
    [...root.children].forEach((b, i) => {
      if (i === active)
        b.setAttribute("aria-current", "page");
      else
        b.removeAttribute("aria-current");
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
  var autoHideBound = false;
  function enableAutoHide() {
    if (autoHideBound)
      return;
    autoHideBound = true;
    document.addEventListener("scroll", (e) => {
      const y = e.target && e.target.scrollTop || 0;
      const dy = y - bar.lastScroll;
      if (Math.abs(dy) < 6)
        return;
      bar.lastScroll = y;
      const hide = dy > 0 && y > 40;
      if (hide !== bar.hidden && bar.host) {
        bar.hidden = hide;
        bar.host.setAttribute("data-hidden", String(hide));
      }
    }, { capture: true, passive: true });
  }
  function attach(owner, config) {
    bar.owners.add(owner);
    bar.config = config;
    registerTabs((config.tabs || []).map((t) => t.path));
    if (!bar.host || !document.body.contains(bar.host))
      bar.host = buildBar();
    const offset = Number(config.offset_bottom) || 0;
    bar.host.style.bottom = offset ? offset + "px" : "";
    renderBar();
    measureBar();
    if (config.auto_hide)
      enableAutoHide();
    setTabHiding(config.hide_ha_tabs);
  }
  function detach(owner) {
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

  // src/global-css.js
  var STYLE_ID2 = "fibbers-global";
  var VARS = {
    "--primary-background-color": T.bg,
    "--secondary-background-color": T.nav,
    "--card-background-color": T.card,
    "--ha-card-background": T.card,
    "--app-header-background-color": T.bg,
    "--app-header-text-color": T.ink,
    "--sidebar-background-color": "#0E1315",
    "--sidebar-icon-color": T.muted,
    "--sidebar-text-color": T.ink2,
    "--sidebar-selected-icon-color": T.accent,
    "--sidebar-selected-text-color": T.ink,
    "--divider-color": T.line,
    "--primary-text-color": T.ink,
    "--secondary-text-color": "#8B999C",
    "--disabled-text-color": "#5C6A6D",
    "--text-primary-color": T.bg,
    "--primary-color": T.accent,
    "--accent-color": T.accent,
    "--state-icon-color": "#8B999C",
    "--state-icon-active-color": T.accent,
    "--error-color": T.red,
    "--warning-color": T.amber,
    "--success-color": T.green,
    "--info-color": T.blue,
    "--ha-card-border-radius": "15px",
    "--ha-card-border-width": "1px",
    "--ha-card-border-color": T.line,
    "--ha-card-box-shadow": "none",
    "--ha-dialog-border-radius": "22px",
    "--mdc-dialog-scrim-color": "rgba(6,9,10,.72)",
    "--mdc-theme-surface": T.sheet,
    "--ha-dialog-surface-background": T.sheet,
    "--more-info-header-background": T.sheet,
    "--dialog-backdrop-filter": "blur(3px)",
    "--switch-checked-color": T.accent,
    "--switch-checked-button-color": T.ink,
    "--switch-checked-track-color": "#2E5238",
    "--switch-unchecked-button-color": "#8B999C",
    "--switch-unchecked-track-color": T.line,
    "--paper-slider-active-color": T.accent,
    "--paper-slider-knob-color": T.accent,
    "--paper-slider-container-color": "#2C3639"
  };
  function injectGlobalCss() {
    if (window.FIBBERS_DISABLE_GLOBAL_CSS)
      return;
    if (document.getElementById(STYLE_ID2))
      return;
    const decls = Object.entries(VARS).map(([k, v]) => `  ${k}: ${v} !important;`).join(`
`);
    const style = document.createElement("style");
    style.id = STYLE_ID2;
    style.textContent = `html {
${decls}
}`;
    document.head.appendChild(style);
  }

  // src/icons.gen.js
  var ICONS = {
    "solar:alarm-bold-duotone": {
      body: '<g fill="currentColor"><path d="M11.9998 21.9997C16.836 21.9997 20.7565 18.1159 20.7565 13.325C20.7565 8.53417 16.836 4.65039 11.9998 4.65039C7.16366 4.65039 3.24316 8.53417 3.24316 13.325C3.24316 18.1159 7.16366 21.9997 11.9998 21.9997Z" opacity=".5"/><path d="M11.9993 8.74707C12.4023 8.74707 12.729 9.07072 12.729 9.46996V13.0259L14.9477 15.2238C15.2326 15.5061 15.2326 15.9638 14.9477 16.2461C14.6627 16.5285 14.2006 16.5285 13.9157 16.2461L11.4833 13.8365C11.3464 13.701 11.2695 13.5171 11.2695 13.3254V9.46996C11.2695 9.07072 11.5962 8.74707 11.9993 8.74707Z"/><path fill-rule="evenodd" d="M8.2405 2.33986C8.45409 2.67841 8.3502 3.1244 8.00844 3.33599L4.11657 5.74562C3.77481 5.95722 3.32461 5.8543 3.11102 5.51574C2.89742 5.17718 3.00131 4.7312 3.34307 4.5196L7.23494 2.10998C7.5767 1.89838 8.0269 2.0013 8.2405 2.33986Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M15.7595 2.33985C15.9731 2.0013 16.4233 1.89838 16.7651 2.10998L20.6569 4.5196C20.9987 4.7312 21.1026 5.17719 20.889 5.51574C20.6754 5.8543 20.2252 5.95722 19.8834 5.74562L15.9916 3.33599C15.6498 3.1244 15.5459 2.67841 15.7595 2.33985Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:alt-arrow-left-bold-duotone": {
      body: '<g fill="currentColor"><path d="M11.5956 8.30273L8.16485 11.6296C7.94505 11.8428 7.94505 12.1573 8.16485 12.3704L14.7953 18.8001C15.2091 19.2013 16 18.9581 16 18.4297V12.7071L11.5956 8.30273Z"/><path d="M15.9999 11.2929L15.9999 5.5703C15.9999 5.04189 15.2089 4.79869 14.7952 5.1999L12.3135 7.60648L15.9999 11.2929Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:bath-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M2 11H1.75C1.33579 11 1 11.3358 1 11.75C1 12.1642 1.33579 12.5 1.75 12.5H2V12.75L2.00008 12.7614L2.00001 12.8168L2.00001 12.8546C2 13.2299 2 13.4498 2.01557 13.6952C2.15751 15.9316 3.36604 17.9968 5.11758 19.3472C5.27527 19.4726 6.0307 19.9348 6.3887 20.1501C7.19042 20.5559 8.0623 20.823 8.96911 20.9148C9.21355 20.9396 9.36275 20.9452 9.61687 20.9548L9.62369 20.955C10.3639 20.9828 11.0885 21 11.75 21C12.4115 21 13.1361 20.9828 13.8763 20.955L13.883 20.9548C14.1372 20.9452 14.2865 20.9396 14.5309 20.9148C15.4378 20.823 16.3098 20.5559 17.1116 20.15C17.45 19.9508 18.178 19.5114 18.3827 19.347C20.1341 17.9966 21.3425 15.9315 21.4845 13.6952C21.5 13.4498 21.5 13.2299 21.5 12.8546L21.5 12.8168C21.5 12.7567 21.5001 12.6942 21.4963 12.6365C21.4933 12.5905 21.4886 12.545 21.4821 12.5H21.75C22.1642 12.5 22.5 12.1642 22.5 11.75C22.5 11.3358 22.1642 11 21.75 11H3.5H2Z" clip-rule="evenodd"/><path d="M5.11758 19.3472C5.10383 19.3688 5.09106 19.3913 5.07934 19.4148L4.07934 21.4148C3.8941 21.7853 4.04427 22.2358 4.41475 22.421C4.78524 22.6062 5.23574 22.4561 5.42098 22.0856L6.3887 20.1502C6.0307 19.9348 5.27527 19.4727 5.11758 19.3472Z" opacity=".5"/><path d="M17.1113 20.1499L18.0791 22.0855C18.2643 22.456 18.7149 22.6062 19.0853 22.4209C19.4558 22.2357 19.606 21.7852 19.4207 21.4147L18.4207 19.4147C18.409 19.3912 18.3962 19.3686 18.3824 19.3469C18.1778 19.5113 17.4498 19.9508 17.1113 20.1499Z" opacity=".5"/><path d="M3.5 4.13516C3.5 3.23209 4.23209 2.5 5.13516 2.5C5.80379 2.5 6.40505 2.90708 6.65338 3.52788L6.79665 3.88607L8.15623 3.24613L8.04609 2.97079C7.56997 1.7805 6.41715 1 5.13516 1C3.40366 1 2 2.40366 2 4.13516V11H3.5V4.13516Z" opacity=".5"/><path d="M6.79601 3.88615C6.20149 4.31936 5.71579 4.92343 5.41658 5.66021C4.99627 6.69522 5.01894 7.80672 5.39716 8.76659C5.47156 8.95542 5.61933 9.10604 5.80671 9.18404C5.99408 9.26204 6.20508 9.26077 6.3915 9.18052L12.3523 6.61444C12.7244 6.45425 12.902 6.02752 12.7535 5.65061C12.3751 4.69037 11.6363 3.87197 10.621 3.43821C9.80968 3.0916 8.94888 3.04497 8.15558 3.24621L6.79601 3.88615Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:bed-bold-duotone": {
      body: '<g fill="currentColor"><path d="M3.00244 12.2665C2.6221 12.4854 2.322 12.8248 2.15224 13.2346C2 13.6022 2 14.0681 2 15C2 15.9319 2 16.3978 2.15224 16.7654C2.35523 17.2554 2.74458 17.6448 3.23463 17.8478C3.48702 17.9523 3.78581 17.9851 4.25 17.9953V20C4.25 20.4142 4.58579 20.75 5 20.75C5.41421 20.75 5.75 20.4142 5.75 20V18H18.25V20C18.25 20.4142 18.5858 20.75 19 20.75C19.4142 20.75 19.75 20.4142 19.75 20V17.9953C20.2142 17.9851 20.513 17.9523 20.7654 17.8478C21.2554 17.6448 21.6448 17.2554 21.8478 16.7654C22 16.3978 22 15.9319 22 15C22 14.0681 22 13.6022 21.8478 13.2346C21.678 12.8248 21.3779 12.4854 20.9976 12.2666L19.25 12.0001L19 12H5L4.75003 12.0001L3.00244 12.2665Z"/><path d="M10.9976 4H12.9976C16.7688 4 18.6544 4 19.826 5.17157C20.8485 6.19404 20.9786 7.76038 20.9952 10.6494V12.2662L19.25 12.0001H4.75003L3.00244 12.2665L3 12.2679V10.6494C3.01656 7.76038 3.14669 6.19404 4.16916 5.17157C5.34073 4 7.22635 4 10.9976 4Z" opacity=".5"/><path d="M19 10.5C19 9.31352 18.9981 8.51653 18.919 7.92202C18.8435 7.35407 18.7129 7.11099 18.5543 6.9506C18.3956 6.79022 18.1552 6.65825 17.5934 6.58189C17.0054 6.50196 16.2171 6.5 15.0435 6.5H12.913V10.5L19 10.5Z"/><path d="M11.087 10.5V6.5H8.95652C7.78294 6.5 6.99461 6.50196 6.40656 6.58189C5.84479 6.65825 5.60435 6.79022 5.44571 6.9506C5.28706 7.11099 5.15653 7.35407 5.081 7.92202C5.00194 8.51653 5 9.31352 5 10.5L11.087 10.5Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:check-circle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" opacity=".5"/><path d="M16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:chef-hat-minimalistic-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2 10C2 7.23858 4.23858 5 7 5C7.25052 5 7.49673 5.01842 7.73736 5.05399C8.33961 3.27806 10.0206 2 12 2C13.9794 2 15.6604 3.27806 16.2626 5.05399C16.5033 5.01842 16.7495 5 17 5C19.7614 5 22 7.23858 22 10C22 12.0503 20.7659 13.8124 19 14.584L19 18C19 19.8856 19 20.8284 18.4142 21.4142C17.8284 22 16.8856 22 15 22H9C7.11438 22 6.17157 22 5.58579 21.4142C5 20.8284 5 19.8856 5 18V14.584C3.2341 13.8124 2 12.0503 2 10Z" opacity=".5"/><path d="M9 17.25C8.58579 17.25 8.25 17.5858 8.25 18C8.25 18.4142 8.58579 18.75 9 18.75H15C15.4142 18.75 15.75 18.4142 15.75 18C15.75 17.5858 15.4142 17.25 15 17.25H9Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:clapperboard-play-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M2 12C2 10.7632 2 9.68872 2.02644 8.75H21.9736C22 9.68872 22 10.7632 22 12C22 16.714 22 19.071 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.071 2 16.714 2 12Z" clip-rule="evenodd" opacity=".5"/><path d="M15 14.5C15 13.8666 14.338 13.4395 13.014 12.5852C11.6719 11.7193 11.0008 11.2863 10.5004 11.6042C10 11.9221 10 12.7814 10 14.5C10 16.2186 10 17.0779 10.5004 17.3958C11.0008 17.7137 11.6719 17.2807 13.014 16.4148C14.338 15.5605 15 15.1334 15 14.5Z"/><path d="M11.9998 2C13.845 2 15.3291 2 16.5399 2.08783L13.0984 7.25002H8.40121L11.9012 2H11.9998Z"/><path d="M3.46429 3.46447C4.71666 2.2121 6.62176 2.03072 10.0955 2.00445L6.59844 7.25002H2.104C2.25125 5.48593 2.60663 4.32213 3.46429 3.46447Z"/><path d="M21.8956 7.25002C21.7484 5.48593 21.393 4.32213 20.5354 3.46447C19.938 2.86714 19.1922 2.51345 18.1985 2.30403L14.9012 7.25002H21.8956Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:danger-triangle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M12 3C9.68925 3 8.23007 5.58716 5.31171 10.7615L4.94805 11.4063C2.52291 15.7061 1.31034 17.856 2.40626 19.428C3.50217 21 6.21356 21 11.6363 21H12.3637C17.7864 21 20.4978 21 21.5937 19.428C22.6897 17.856 21.4771 15.7061 19.0519 11.4063L18.6883 10.7615C15.7699 5.58716 14.3107 3 12 3Z" opacity=".5"/><path d="M12 7.25C12.4142 7.25 12.75 7.58579 12.75 8V13C12.75 13.4142 12.4142 13.75 12 13.75C11.5858 13.75 11.25 13.4142 11.25 13V8C11.25 7.58579 11.5858 7.25 12 7.25Z"/><path d="M12 17C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15C11.4477 15 11 15.4477 11 16C11 16.5523 11.4477 17 12 17Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:home-2-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2 12.2039C2 9.91549 2 8.77128 2.5192 7.82274C3.0384 6.87421 3.98695 6.28551 5.88403 5.10813L7.88403 3.86687C9.88939 2.62229 10.8921 2 12 2C13.1079 2 14.1106 2.62229 16.116 3.86687L18.116 5.10812C20.0131 6.28551 20.9616 6.87421 21.4808 7.82274C22 8.77128 22 9.91549 22 12.2039V13.725C22 17.6258 22 19.5763 20.8284 20.7881C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.7881C2 19.5763 2 17.6258 2 13.725V12.2039Z" opacity=".5"/><path d="M11.25 18C11.25 18.4142 11.5858 18.75 12 18.75C12.4142 18.75 12.75 18.4142 12.75 18V15C12.75 14.5858 12.4142 14.25 12 14.25C11.5858 14.25 11.25 14.5858 11.25 15V18Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:home-angle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M13.1061 22H10.8939C7.44737 22 5.72409 22 4.54903 20.9882C3.37396 19.9764 3.13025 18.2827 2.64284 14.8952L2.36407 12.9579C1.98463 10.3208 1.79491 9.00229 2.33537 7.87495C2.87583 6.7476 4.02619 6.06234 6.32691 4.69181L7.71175 3.86687C9.80104 2.62229 10.8457 2 12 2C13.1543 2 14.199 2.62229 16.2882 3.86687L17.6731 4.69181C19.9738 6.06234 21.1242 6.7476 21.6646 7.87495C22.2051 9.00229 22.0154 10.3208 21.6359 12.9579L21.3572 14.8952C20.8697 18.2827 20.626 19.9764 19.451 20.9882C18.2759 22 16.5526 22 13.1061 22Z" opacity=".5"/><path d="M8.25 18C8.25 17.5858 8.58579 17.25 9 17.25H15C15.4142 17.25 15.75 17.5858 15.75 18C15.75 18.4142 15.4142 18.75 15 18.75H9C8.58579 18.75 8.25 18.4142 8.25 18Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:lightbulb-bold-duotone": {
      body: '<g fill="currentColor"><path d="M4 9.67442C4 5.43595 7.35786 2 11.5 2C15.6421 2 19 5.43595 19 9.67442C19 11.9468 18.034 13.9892 16.5014 15.3934C15.9906 15.8614 15.6122 16.2082 15.344 16.4598C15.2099 16.5855 15.1074 16.6838 15.0317 16.7592C14.994 16.7968 14.9651 16.8266 14.9436 16.8496C14.933 16.861 14.925 16.8699 14.9192 16.8766L14.914 16.8826L14.9108 16.8864C14.6743 17.1851 14.6231 17.2622 14.5926 17.332C14.5621 17.4018 14.5402 17.4922 14.4805 17.8717C14.457 18.0216 14.4545 18.2782 14.4545 18.9767V19.0067C14.4546 19.4158 14.4546 19.7687 14.4289 20.0583C14.4018 20.3645 14.3418 20.6677 14.1805 20.9535C14.001 21.2717 13.7428 21.5359 13.4318 21.7196C13.1525 21.8846 12.8562 21.946 12.557 21.9738C12.274 22 11.9292 22 11.5294 22H11.5293H11.4707H11.4706C11.0708 22 10.726 22 10.443 21.9738C10.1438 21.946 9.84747 21.8846 9.56818 21.7196C9.25723 21.5359 8.99902 21.2717 8.81949 20.9535C8.65825 20.6677 8.5982 20.3645 8.57107 20.0583C8.54543 19.7687 8.54544 19.4158 8.54545 19.0067L8.54545 18.9767C8.54545 18.2782 8.54305 18.0216 8.51949 17.8717C8.45982 17.4922 8.43787 17.4018 8.40739 17.332C8.3769 17.2622 8.32571 17.1851 8.0892 16.8864L8.08591 16.8825L8.0808 16.8766C8.07499 16.8699 8.06699 16.861 8.05635 16.8496C8.03486 16.8266 8.00601 16.7968 7.9683 16.7592C7.89262 16.6838 7.7901 16.5855 7.65601 16.4598C7.38782 16.2082 7.0094 15.8614 6.49859 15.3934C4.96602 13.9892 4 11.9468 4 9.67442Z" opacity=".5"/><path d="M10.2978 13.6246C10.0904 13.266 9.63156 13.1435 9.27302 13.3509C8.91447 13.5583 8.79195 14.0171 8.99936 14.3757C9.35263 14.9864 9.93556 15.4498 10.631 15.6465V17.0001C10.631 17.4143 10.9668 17.7501 11.381 17.7501C11.7952 17.7501 12.131 17.4143 12.131 17.0001V15.6466C12.8264 15.4498 13.4094 14.9864 13.7626 14.3757C13.97 14.0171 13.8475 13.5583 13.489 13.3509C13.1304 13.1435 12.6716 13.266 12.4642 13.6246C12.247 14.0002 11.8427 14.2501 11.381 14.2501C10.9193 14.2501 10.515 14.0002 10.2978 13.6246Z"/><path d="M9.91421 19.6745H13.0843C13.0814 19.7715 13.0769 19.8562 13.0701 19.9325C13.0516 20.1419 13.0203 20.2179 12.9988 20.2559C12.939 20.362 12.8529 20.4501 12.7493 20.5113C12.7121 20.5333 12.6378 20.5653 12.4331 20.5843C12.2191 20.6041 11.9366 20.6048 11.4993 20.6048C11.0619 20.6048 10.7795 20.6041 10.5654 20.5843C10.3607 20.5653 10.2864 20.5333 10.2493 20.5113C10.1456 20.4501 10.0595 20.362 9.99971 20.2559C9.97826 20.2179 9.94697 20.1419 9.92842 19.9325C9.92166 19.8562 9.91718 19.7715 9.91421 19.6745Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:lightbulb-bolt-bold-duotone": {
      body: '<g fill="currentColor"><path d="M4 9.67442C4 5.43595 7.35786 2 11.5 2C15.6421 2 19 5.43595 19 9.67442C19 11.9468 18.034 13.9892 16.5014 15.3934C15.9906 15.8614 15.6122 16.2082 15.344 16.4598C15.2099 16.5855 15.1074 16.6838 15.0317 16.7592C14.994 16.7968 14.9651 16.8266 14.9436 16.8496C14.933 16.861 14.925 16.8699 14.9192 16.8766C14.9133 16.8834 14.9108 16.8864 14.9108 16.8864C14.6743 17.1851 14.6231 17.2622 14.5926 17.332C14.5621 17.4018 14.5402 17.4922 14.4805 17.8717C14.457 18.0216 14.4545 18.2782 14.4545 18.9767V19.0067C14.4546 19.4158 14.4546 19.7687 14.4289 20.0583C14.4018 20.3645 14.3418 20.6677 14.1805 20.9535C14.001 21.2717 13.7428 21.5359 13.4318 21.7196C13.1525 21.8846 12.8562 21.946 12.557 21.9738C12.274 22 11.9292 22 11.5294 22H11.5293H11.4707H11.4706C11.0708 22 10.726 22 10.443 21.9738C10.1438 21.946 9.84747 21.8846 9.56818 21.7196C9.25723 21.5359 8.99902 21.2717 8.81949 20.9535C8.65825 20.6677 8.5982 20.3645 8.57107 20.0583C8.54543 19.7687 8.54544 19.4158 8.54545 19.0067L8.54545 18.9767C8.54545 18.2782 8.54305 18.0216 8.51949 17.8717C8.45982 17.4922 8.43787 17.4018 8.40739 17.332C8.3769 17.2622 8.32571 17.1851 8.0892 16.8864C8.0892 16.8864 8.08649 16.8831 8.0808 16.8766C8.07499 16.8699 8.06699 16.861 8.05635 16.8496C8.03486 16.8266 8.00601 16.7968 7.9683 16.7592C7.89262 16.6838 7.7901 16.5855 7.65601 16.4598C7.38782 16.2082 7.0094 15.8614 6.49859 15.3934C4.96602 13.9892 4 11.9468 4 9.67442Z" opacity=".5"/><path d="M13.0848 19.6748H9.91463C9.9176 19.7718 9.92209 19.8565 9.92884 19.9327C9.94739 20.1422 9.97868 20.2182 10.0001 20.2562C10.06 20.3623 10.146 20.4504 10.2497 20.5116C10.2868 20.5335 10.3612 20.5656 10.5658 20.5845C10.7799 20.6044 11.0623 20.6051 11.4997 20.6051C11.9371 20.6051 12.2195 20.6044 12.4336 20.5845C12.6382 20.5656 12.7125 20.5335 12.7497 20.5116C12.8533 20.4504 12.9394 20.3623 12.9993 20.2562C13.0207 20.2182 13.052 20.1422 13.0706 19.9327C13.0773 19.8565 13.0818 19.7718 13.0848 19.6748Z"/><path d="M12.6102 8.17688C12.9166 8.40084 12.9875 8.83658 12.7687 9.15012L11.5907 10.8376H12.9931C13.2485 10.8376 13.4825 10.9837 13.5993 11.2161C13.7162 11.4484 13.6963 11.7282 13.5479 11.9408L11.5998 14.7315C11.381 15.0451 10.9551 15.1177 10.6487 14.8937C10.3423 14.6698 10.2713 14.234 10.4902 13.9205L11.6682 12.233H10.2658C10.0104 12.233 9.77642 12.0869 9.65955 11.8545C9.54269 11.6222 9.56254 11.3424 9.71099 11.1298L11.659 8.33909C11.8779 8.02555 12.3037 7.95292 12.6102 8.17688Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:menu-dots-bold-duotone": {
      body: '<g fill="currentColor"><path d="M7 12C7 13.1046 6.10457 14 5 14C3.89543 14 3 13.1046 3 12C3 10.8954 3.89543 10 5 10C6.10457 10 7 10.8954 7 12Z"/><path d="M21 12C21 13.1046 20.1046 14 19 14C17.8954 14 17 13.1046 17 12C17 10.8954 17.8954 10 19 10C20.1046 10 21 10.8954 21 12Z"/><path d="M14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z" opacity=".5"/></g>',
      vb: "0 0 24 24"
    },
    "solar:moon-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M22 12.0004C22 17.5232 17.5228 22.0004 12 22.0004C10.8358 22.0004 9.71801 21.8014 8.67887 21.4357C8.24138 20.3772 8 19.217 8 18.0004C8 15.7792 8.80467 13.7459 10.1384 12.1762C11.31 13.8818 13.2744 15.0004 15.5 15.0004C17.8615 15.0004 19.9289 13.741 21.0672 11.8572C21.3065 11.4612 22 11.5377 22 12.0004Z" clip-rule="evenodd" opacity=".5"/><path d="M2 12C2 16.3586 4.78852 20.0659 8.67887 21.4353C8.24138 20.3768 8 19.2166 8 18C8 15.7788 8.80467 13.7455 10.1384 12.1758C9.42027 11.1303 9 9.86422 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:music-note-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M10.0905 11.9629L19.3632 8.63087L20.9996 7.95235V7.49236C20.9996 6.37238 20.9996 5.4331 20.9118 4.68472C20.8994 4.57895 20.8848 4.4738 20.8686 4.37569C20.7841 3.86441 20.6348 3.38745 20.3465 2.98917C20.2024 2.79002 20.0235 2.61055 19.8007 2.45628C19.7589 2.42736 19.7156 2.39932 19.6707 2.3722L19.6617 2.36679C18.8901 1.90553 18.0228 1.93852 17.1293 2.14305C16.2652 2.34086 15.194 2.74368 13.8803 3.23763L11.5959 4.09656C10.9801 4.32806 10.4584 4.52419 10.049 4.72734C9.61332 4.94348 9.23805 5.1984 8.95662 5.57828C8.67519 5.95817 8.55831 6.36756 8.50457 6.81203C8.45406 7.22978 8.45408 7.7378 8.4541 8.33743V12.6016L10.0905 11.9629Z" clip-rule="evenodd"/><g opacity=".5"><path d="M8.45455 16.1305C7.90347 15.8136 7.24835 15.6298 6.54545 15.6298C4.58735 15.6298 3 17.0558 3 18.8148C3 20.5738 4.58735 21.9998 6.54545 21.9998C8.50355 21.9998 10.0909 20.5738 10.0909 18.8148L10.0909 11.9627L8.45455 12.6014V16.1305Z"/><path d="M19.3636 8.63067V14.1705C18.8126 13.8536 18.1574 13.6698 17.4545 13.6698C15.4964 13.6698 13.9091 15.0958 13.9091 16.8548C13.9091 18.6138 15.4964 20.0398 17.4545 20.0398C19.4126 20.0398 21 18.6138 21 16.8548L21 7.95215L19.3636 8.63067Z"/></g></g>',
      vb: "0 0 24 24"
    },
    "solar:palette-bold-duotone": {
      body: '<g fill="currentColor"><path d="M7.75 19C7.75 19.4142 7.41421 19.75 7 19.75H5C4.58579 19.75 4.25 19.4142 4.25 19C4.25 18.5858 4.58579 18.25 5 18.25H7C7.41421 18.25 7.75 18.5858 7.75 19Z"/><path d="M10 18V6C10 4.59987 10 3.8998 9.72752 3.36502C9.48783 2.89462 9.10538 2.51217 8.63498 2.27248C8.1002 2 7.40013 2 6 2C4.59987 2 3.8998 2 3.36502 2.27248C2.89462 2.51217 2.51217 2.89462 2.27248 3.36502C2 3.8998 2 4.59987 2 6V18C2 19.4001 2 20.1002 2.27248 20.635C2.51217 21.1054 2.89462 21.4878 3.36502 21.7275C3.8998 22 4.59987 22 6 22C7.40013 22 8.1002 22 8.63498 21.7275C9.10538 21.4878 9.48783 21.1054 9.72752 20.635C10 20.1002 10 19.4001 10 18Z" opacity=".5"/><g opacity=".5"><path d="M10 8.24276V18C10 18.9186 10 19.5359 9.92304 20.0029L13.2219 16.7041L19.0599 10.6145C20.0332 9.6111 20.5199 9.10939 20.6964 8.53425C20.847 8.04375 20.843 7.5188 20.685 7.03065C20.4997 6.45826 19.9999 5.95847 19.0003 4.95892C18.0991 4.07259 17.6484 3.62942 17.1204 3.44458C16.6857 3.29244 16.2175 3.2633 15.7673 3.36039C15.2204 3.47834 14.7183 3.86221 13.7141 4.62996L13 5.24276L10 8.24276Z"/><path d="M8.00288 21.923C8.00192 21.9232 8.00096 21.9234 8 21.9235V21.9259L8.00288 21.923Z"/></g><g opacity=".5"><path d="M10 8.24276V18C10 18.9186 10 19.5359 9.92304 20.0029L13.2219 16.7041L19.0599 10.6145C20.0332 9.6111 20.5199 9.10939 20.6964 8.53425C20.847 8.04375 20.843 7.5188 20.685 7.03065C20.4997 6.45826 19.9999 5.95847 19.0003 4.95892C18.0991 4.07259 17.6484 3.62942 17.1204 3.44458C16.6857 3.29244 16.2175 3.2633 15.7673 3.36039C15.2204 3.47834 14.7183 3.86221 13.7141 4.62996L13 5.24276L10 8.24276Z"/><path d="M8.00288 21.923C8.00192 21.9232 8.00096 21.9234 8 21.9235V21.9259L8.00288 21.923Z"/></g><path d="M15.8143 14H17.8994C19.2995 14 19.9996 14 20.5344 14.2725C21.0048 14.5122 21.3872 14.8946 21.6269 15.365C21.8994 15.8998 21.8994 16.5999 21.8994 18C21.8994 19.4001 21.8994 20.1002 21.6269 20.635C21.3872 21.1054 21.0048 21.4878 20.5344 21.7275C19.9996 22 19.2995 22 17.8994 22H6C6.91721 22 7.53399 22 8.00069 21.9234L8 21.9259L8.00288 21.923C8.24762 21.8827 8.45107 21.8212 8.63498 21.7275C9.10538 21.4878 9.48783 21.1054 9.72752 20.635C9.82122 20.4511 9.8827 20.2476 9.92304 20.0029L13.2219 16.7041L15.8143 14Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:power-bold-duotone": {
      body: '<g fill="currentColor"><path d="M8.7919 5.14712C9.17345 4.98591 9.35208 4.54591 9.19087 4.16435C9.02966 3.7828 8.58966 3.60417 8.2081 3.76538C4.70832 5.24406 2.25 8.70925 2.25 12.7503C2.25 18.1351 6.61522 22.5003 12 22.5003C17.3848 22.5003 21.75 18.1351 21.75 12.7503C21.75 8.70925 19.2917 5.24406 15.7919 3.76538C15.4103 3.60417 14.9703 3.7828 14.8091 4.16435C14.6479 4.54591 14.8265 4.98591 15.2081 5.14712C18.1722 6.39947 20.25 9.33312 20.25 12.7503C20.25 17.3067 16.5563 21.0003 12 21.0003C7.44365 21.0003 3.75 17.3067 3.75 12.7503C3.75 9.33312 5.82779 6.39947 8.7919 5.14712Z" opacity=".5"/><path d="M12.75 2.75C12.75 2.33579 12.4142 2 12 2C11.5858 2 11.25 2.33579 11.25 2.75V6.75C11.25 7.16421 11.5858 7.5 12 7.5C12.4142 7.5 12.75 7.16421 12.75 6.75V2.75Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:record-circle-bold-duotone": {
      body: '<g fill="currentColor"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" opacity=".5"/><path fill-rule="evenodd" d="M12.75 12C12.75 12.6443 12.9375 13.2449 13.2609 13.75H10.7391C11.0625 13.2449 11.25 12.6443 11.25 12C11.25 10.2051 9.79493 8.75 8 8.75C6.20507 8.75 4.75 10.2051 4.75 12C4.75 13.7949 6.20507 15.25 8 15.25H16C17.7949 15.25 19.25 13.7949 19.25 12C19.25 10.2051 17.7949 8.75 16 8.75C14.2051 8.75 12.75 10.2051 12.75 12ZM14.25 12C14.25 11.0335 15.0335 10.25 16 10.25C16.9665 10.25 17.75 11.0335 17.75 12C17.75 12.9665 16.9665 13.75 16 13.75C15.0335 13.75 14.25 12.9665 14.25 12ZM9.75 12C9.75 12.9665 8.9665 13.75 8 13.75C7.0335 13.75 6.25 12.9665 6.25 12C6.25 11.0335 7.0335 10.25 8 10.25C8.9665 10.25 9.75 11.0335 9.75 12Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:sofa-2-bold-duotone": {
      body: '<g fill="currentColor"><path d="M12.75 14H17.2C17.6418 14 18 13.6418 18 13.2V12C18 10.8954 18.8954 10 20 10C21.1046 10 22 10.8954 22 12V14.4444C22 15.5284 21.5149 16.4991 20.75 17.1513V19C20.75 19.4142 20.4142 19.75 20 19.75C19.5858 19.75 19.25 19.4142 19.25 19V17.9084C18.9912 17.9683 18.7215 18 18.4444 18H5.55556C5.27849 18 5.00883 17.9683 4.75 17.9084V19C4.75 19.4142 4.41421 19.75 4 19.75C3.58579 19.75 3.25 19.4142 3.25 19V17.1513C2.48508 16.4991 2 15.5284 2 14.4444V12C2 10.8954 2.89543 10 4 10C5.10457 10 6 10.8954 6 12V13.2C6 13.6418 6.35817 14 6.8 14H11.25V5H12.75V14Z"/><g opacity=".5"><path d="M17.2 14H12.75V5H15C15.9293 5 16.394 5 16.7804 5.07686C18.3671 5.39249 19.6075 6.63288 19.9231 8.21964C19.9657 8.43379 19.9847 8.67199 19.9932 9.00001L20 9V10C18.8954 10 18 10.8954 18 12V13.2C18 13.6418 17.6418 14 17.2 14Z"/><path d="M11.25 14H6.8C6.35817 14 6 13.6418 6 13.2V12C6 10.8977 5.10825 10.0037 4.00681 10V9.00001C4.01527 8.67199 4.03426 8.43379 4.07686 8.21964C4.39249 6.63288 5.63288 5.39249 7.21964 5.07686C7.60603 5 8.07069 5 9 5H11.25V14Z"/></g></g>',
      vb: "0 0 24 24"
    },
    "solar:speaker-bold-duotone": {
      body: '<g fill="currentColor"><path d="M4 10C4 6.22876 4 4.34315 5.17157 3.17157C6.34315 2 8.22876 2 12 2C15.7712 2 17.6569 2 18.8284 3.17157C20 4.34315 20 6.22876 20 10V14C20 17.7712 20 19.6569 18.8284 20.8284C17.6569 22 15.7712 22 12 22C8.22876 22 6.34315 22 5.17157 20.8284C4 19.6569 4 17.7712 4 14V10Z" opacity=".5"/><path fill-rule="evenodd" d="M12 4.75C10.4812 4.75 9.25 5.98122 9.25 7.5C9.25 9.01878 10.4812 10.25 12 10.25C13.5188 10.25 14.75 9.01878 14.75 7.5C14.75 5.98122 13.5188 4.75 12 4.75Z" clip-rule="evenodd"/><path fill-rule="evenodd" d="M8.25 15.5C8.25 13.4289 9.92893 11.75 12 11.75C14.0711 11.75 15.75 13.4289 15.75 15.5C15.75 17.5711 14.0711 19.25 12 19.25C9.92893 19.25 8.25 17.5711 8.25 15.5Z" clip-rule="evenodd"/></g>',
      vb: "0 0 24 24"
    },
    "solar:sun-bold-duotone": {
      body: '<g fill="currentColor"><path d="M18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12Z"/><path fill-rule="evenodd" d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V3C12.75 3.41421 12.4142 3.75 12 3.75C11.5858 3.75 11.25 3.41421 11.25 3V2C11.25 1.58579 11.5858 1.25 12 1.25ZM1.25 12C1.25 11.5858 1.58579 11.25 2 11.25H3C3.41421 11.25 3.75 11.5858 3.75 12C3.75 12.4142 3.41421 12.75 3 12.75H2C1.58579 12.75 1.25 12.4142 1.25 12ZM20.25 12C20.25 11.5858 20.5858 11.25 21 11.25H22C22.4142 11.25 22.75 11.5858 22.75 12C22.75 12.4142 22.4142 12.75 22 12.75H21C20.5858 12.75 20.25 12.4142 20.25 12ZM12 20.25C12.4142 20.25 12.75 20.5858 12.75 21V22C12.75 22.4142 12.4142 22.75 12 22.75C11.5858 22.75 11.25 22.4142 11.25 22V21C11.25 20.5858 11.5858 20.25 12 20.25Z" clip-rule="evenodd"/><g opacity=".5"><path d="M4.39838 4.39838C4.69127 4.10549 5.16615 4.10549 5.45904 4.39838L5.85188 4.79122C6.14477 5.08411 6.14477 5.55898 5.85188 5.85188C5.55898 6.14477 5.08411 6.14477 4.79122 5.85188L4.39838 5.45904C4.10549 5.16615 4.10549 4.69127 4.39838 4.39838Z"/><path d="M19.6009 4.39864C19.8938 4.69153 19.8938 5.16641 19.6009 5.4593L19.2081 5.85214C18.9152 6.14503 18.4403 6.14503 18.1474 5.85214C17.8545 5.55924 17.8545 5.08437 18.1474 4.79148L18.5402 4.39864C18.8331 4.10575 19.308 4.10575 19.6009 4.39864Z"/><path d="M18.1474 18.1474C18.4403 17.8545 18.9152 17.8545 19.2081 18.1474L19.6009 18.5402C19.8938 18.8331 19.8938 19.308 19.6009 19.6009C19.308 19.8938 18.8331 19.8938 18.5402 19.6009L18.1474 19.2081C17.8545 18.9152 17.8545 18.4403 18.1474 18.1474Z"/><path d="M5.85188 18.1477C6.14477 18.4406 6.14477 18.9154 5.85188 19.2083L5.45904 19.6012C5.16615 19.8941 4.69127 19.8941 4.39838 19.6012C4.10549 19.3083 4.10549 18.8334 4.39838 18.5405L4.79122 18.1477C5.08411 17.8548 5.55898 17.8548 5.85188 18.1477Z"/></g></g>',
      vb: "0 0 24 24"
    },
    "solar:tv-bold-duotone": {
      body: '<g fill="currentColor"><path fill-rule="evenodd" d="M16 6H13.4163H10.5837H8C5.17157 6 3.75736 6 2.87868 6.87868C2 7.75736 2 9.17157 2 12V16C2 18.8284 2 20.2426 2.87868 21.1213C3.75736 22 5.17157 22 8 22L16 22V6Z" clip-rule="evenodd"/><path d="M22 11.9998V15.9998C22 18.8282 22 20.2424 21.1213 21.1211C20.296 21.9464 18.9983 21.9966 16.5 21.9996H16V6H16.5C18.9983 6.00305 20.296 6.05318 21.1213 6.87848C22 7.75716 22 9.17138 22 11.9998Z" opacity=".5"/><path d="M13.4163 6.00011L15.5695 3.48811C15.839 3.17361 15.8026 2.70014 15.4881 2.43057C15.1736 2.161 14.7001 2.19743 14.4306 2.51192L12 5.34757L9.56946 2.51192C9.29989 2.19743 8.82641 2.16101 8.51192 2.43057C8.19743 2.70014 8.161 3.17361 8.43057 3.48811L10.5837 6.00011H13.4163Z" opacity=".5"/><path d="M19 11C19.5523 11 20 11.4477 20 12C20 12.5523 19.5523 13 19 13C18.4477 13 18 12.5523 18 12C18 11.4477 18.4477 11 19 11Z"/><path d="M19 15C19.5523 15 20 15.4477 20 16C20 16.5523 19.5523 17 19 17C18.4477 17 18 16.5523 18 16C18 15.4477 18.4477 15 19 15Z"/></g>',
      vb: "0 0 24 24"
    },
    "solar:widget-bold-duotone": {
      body: '<g fill="currentColor"><path d="M2 6.5C2 4.37868 2 3.31802 2.65901 2.65901C3.31802 2 4.37868 2 6.5 2C8.62132 2 9.68198 2 10.341 2.65901C11 3.31802 11 4.37868 11 6.5C11 8.62132 11 9.68198 10.341 10.341C9.68198 11 8.62132 11 6.5 11C4.37868 11 3.31802 11 2.65901 10.341C2 9.68198 2 8.62132 2 6.5Z" opacity=".5"/><path d="M13 17.5C13 15.3787 13 14.318 13.659 13.659C14.318 13 15.3787 13 17.5 13C19.6213 13 20.682 13 21.341 13.659C22 14.318 22 15.3787 22 17.5C22 19.6213 22 20.682 21.341 21.341C20.682 22 19.6213 22 17.5 22C15.3787 22 14.318 22 13.659 21.341C13 20.682 13 19.6213 13 17.5Z" opacity=".5"/><path d="M2 17.5C2 15.3787 2 14.318 2.65901 13.659C3.31802 13 4.37868 13 6.5 13C8.62132 13 9.68198 13 10.341 13.659C11 14.318 11 15.3787 11 17.5C11 19.6213 11 20.682 10.341 21.341C9.68198 22 8.62132 22 6.5 22C4.37868 22 3.31802 22 2.65901 21.341C2 20.682 2 19.6213 2 17.5Z"/><path d="M13 6.5C13 4.37868 13 3.31802 13.659 2.65901C14.318 2 15.3787 2 17.5 2C19.6213 2 20.682 2 21.341 2.65901C22 3.31802 22 4.37868 22 6.5C22 8.62132 22 9.68198 21.341 10.341C20.682 11 19.6213 11 17.5 11C15.3787 11 14.318 11 13.659 10.341C13 9.68198 13 8.62132 13 6.5Z"/></g>',
      vb: "0 0 24 24"
    }
  };

  // src/icon.js
  function iconSvg(name) {
    const ic = name && ICONS[name];
    if (!ic)
      return null;
    return `<svg viewBox="${ic.vb}" fill="currentColor" style="width:100%;height:100%;display:block" aria-hidden="true">${ic.body}</svg>`;
  }

  class FibIcon extends HTMLElement {
    static get observedAttributes() {
      return ["icon"];
    }
    connectedCallback() {
      this.style.display = "inline-flex";
      this.style.alignItems = "center";
      this.style.justifyContent = "center";
      this._render();
    }
    attributeChangedCallback() {
      if (this.isConnected)
        this._render();
    }
    _render() {
      const name = this.getAttribute("icon") || "";
      const svg = iconSvg(name);
      if (svg) {
        this.innerHTML = svg;
        return;
      }
      let ha = this.firstElementChild;
      if (!ha || ha.localName !== "ha-icon") {
        this.innerHTML = "";
        ha = document.createElement("ha-icon");
        ha.style.setProperty("--mdc-icon-size", "inherit");
        this.appendChild(ha);
      }
      ha.setAttribute("icon", name);
    }
  }
  if (!customElements.get("fib-icon"))
    customElements.define("fib-icon", FibIcon);

  // src/cards/nav.js
  class FibbersNav extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:fibbers-nav",
        tabs: [
          {
            name: "Huis",
            icon: "solar:home-2-bold-duotone",
            path: "/dashboard-thuis/huis"
          },
          {
            name: "Licht",
            icon: "solar:lightbulb-bolt-bold-duotone",
            path: "/dashboard-thuis/licht"
          }
        ]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.tabs) || !config.tabs.length) {
        throw new Error("fibbers-nav: `tabs` must be a non-empty list of {name, icon, path}");
      }
      config.tabs.forEach((t, i) => {
        if (!t || !t.path)
          throw new Error(`fibbers-nav: tabs[${i}] is missing \`path\``);
      });
      if (config.offset_bottom != null && !Number.isFinite(Number(config.offset_bottom))) {
        throw new Error("fibbers-nav: `offset_bottom` must be a number of pixels");
      }
      if (config.hide_ha_tabs != null && config.hide_ha_tabs !== true && config.hide_ha_tabs !== false && config.hide_ha_tabs !== "header") {
        throw new Error('fibbers-nav: `hide_ha_tabs` must be false, true, or "header"');
      }
      this._config = config;
      if (!this._spacer) {
        this._spacer = document.createElement("div");
        this.appendChild(this._spacer);
      }
      this._syncSpacer();
      if (this.isConnected)
        attach(this, this._config);
    }
    _syncSpacer() {
      if (!this._spacer)
        return;
      const cfg = this._config || {};
      const offset = Number(cfg.offset_bottom) || 0;
      const base = cfg.reserve != null ? cfg.reserve : bar.height || 74;
      this._spacer.style.height = `${Math.round(base + offset)}px`;
    }
    set hass(hass) {
      nav.hassRef = hass;
      if (this._config && (this._config.tabs || []).some((t) => t.badge))
        renderBar();
    }
    connectedCallback() {
      if (this._config)
        attach(this, this._config);
    }
    disconnectedCallback() {
      detach(this);
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/back.js
  class FibbersBack extends HTMLElement {
    static getStubConfig() {
      return { type: "custom:fibbers-back", fallback: "/dashboard-thuis/huis" };
    }
    setConfig(config) {
      this._config = config || {};
      this._render();
      this._onRoute = () => this._label();
      nav.listeners.add(this._onRoute);
    }
    set hass(_hass) {}
    _render() {
      const c = this._config;
      this.innerHTML = `
      <style>
        .row {
          display: flex; align-items: center; gap: 8px;
          background: ${T.card}; border: 1px solid ${T.line};
          border-radius: 12px; padding: 12px 14px;
          color: ${T.ink2}; font-size: 12.5px; font-weight: 500;
          cursor: pointer; -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .row[data-pressed="true"] { background: ${T.card2}; }
        .row fib-icon { --mdc-icon-size: 18px; width: 18px; height: 18px; color: ${T.muted}; }
      </style>
      <div class="row" role="button" tabindex="0">
        <fib-icon icon="${c.icon || "solar:alt-arrow-left-bold-duotone"}"></fib-icon>
        <span class="lbl"></span>
      </div>`;
      const row = this.querySelector(".row");
      row.addEventListener("pointerdown", () => row.setAttribute("data-pressed", "true"));
      ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => row.addEventListener(ev, () => row.removeAttribute("data-pressed")));
      const go = () => goBack(this._config.fallback);
      row.addEventListener("click", go);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      });
      this._label();
    }
    _label() {
      const el = this.querySelector(".lbl");
      if (!el)
        return;
      const c = this._config;
      if (c.label) {
        el.textContent = c.label;
        return;
      }
      const prev = previous() || c.fallback;
      const names = c.labels || {};
      const name = prev ? names[norm(prev)] || names[prev] : null;
      el.textContent = name ? `Terug naar ${name}` : "Terug";
    }
    disconnectedCallback() {
      if (this._onRoute)
        nav.listeners.delete(this._onRoute);
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/body-sheet.js
  var layer = {
    host: null,
    shadow: null,
    backdrop: null,
    panel: null,
    headEl: null,
    bodyEl: null,
    sheets: new Map,
    openId: null,
    savedScrollY: 0,
    drag: null,
    built: false
  };
  var reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SHEET_CSS = `
  ${styleBlock()}
  * { box-sizing: border-box; }
  :host {
    position: fixed;
    inset: 0;
    z-index: 9;
    display: none;
  }
  :host([data-open="true"]) { display: block; }

  .backdrop {
    position: absolute; inset: 0;
    background: rgba(6, 9, 10, .72);
    -webkit-backdrop-filter: blur(3px);
    backdrop-filter: blur(3px);
    opacity: 0;
    transition: opacity .24s ease;
  }
  :host([data-shown="true"]) .backdrop { opacity: 1; }

  .sheet {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    background: var(--fib-sheet);
    border-top: 1px solid var(--fib-line);
    border-radius: 24px 24px 0 0;
    padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    transform: translateY(100%);
    transition: transform .28s cubic-bezier(.22, 1, .36, 1);
    will-change: transform;
  }
  :host([data-shown="true"]) .sheet { transform: translateY(0); }
  @media (prefers-reduced-motion: reduce) {
    .backdrop, .sheet { transition: none; }
  }

  .grab {
    width: 34px; height: 4px;
    border-radius: 2px;
    background: var(--fib-grab);
    margin: 4px auto 10px;
    flex: 0 0 auto;
    touch-action: none;
    cursor: grab;
  }
  .head {
    display: flex; align-items: center; gap: 10px;
    padding: 0 2px 12px;
    flex: 0 0 auto;
    touch-action: none;
  }
  .head fib-icon { --mdc-icon-size: 20px; width: 20px; height: 20px; color: var(--fib-accent); }
  .titles { flex: 1 1 auto; min-width: 0; }
  .title { font-size: 16px; font-weight: 600; letter-spacing: -.015em; color: var(--fib-ink); }
  .sub { font-size: 11px; color: var(--fib-muted); margin-top: 2px; }
  .close {
    flex: 0 0 auto;
    width: 30px; height: 30px;
    border: 0; border-radius: 999px;
    background: var(--fib-card-2);
    color: var(--fib-ink-2);
    font-size: 15px; line-height: 1;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .body {
    flex: 1 1 auto;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    display: flex; flex-direction: column; gap: 10px;
    padding-bottom: 6px;
  }

  @media (min-width: 640px) {
    .sheet {
      left: 50%; right: auto; bottom: auto; top: 50%;
      transform: translate(-50%, -50%) scale(.98);
      width: min(460px, calc(100vw - 32px));
      border-radius: 24px;
      border: 1px solid var(--fib-line);
      opacity: 0;
      transition: opacity .2s ease, transform .2s ease;
    }
    :host([data-shown="true"]) .sheet { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }
`;
  function build() {
    if (layer.built)
      return;
    const host = document.createElement("div");
    host.id = "fibbers-sheet";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = SHEET_CSS;
    const backdrop = document.createElement("div");
    backdrop.className = "backdrop";
    const sheet = document.createElement("div");
    sheet.className = "sheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    const grab = document.createElement("div");
    grab.className = "grab";
    const head = document.createElement("div");
    head.className = "head";
    const body = document.createElement("div");
    body.className = "body";
    sheet.append(grab, head, body);
    shadow.append(style, backdrop, sheet);
    document.body.appendChild(host);
    backdrop.addEventListener("click", () => closeSheet());
    bindDrag(grab, sheet);
    bindDrag(head, sheet);
    layer.host = host;
    layer.shadow = shadow;
    layer.backdrop = backdrop;
    layer.panel = sheet;
    layer.headEl = head;
    layer.bodyEl = body;
    layer.built = true;
  }
  function bindDrag(handle, sheet) {
    handle.addEventListener("pointerdown", (e) => {
      if (window.innerWidth >= 640)
        return;
      layer.drag = { startY: e.clientY, dy: 0 };
      sheet.style.transition = "none";
      handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", (e) => {
      if (!layer.drag)
        return;
      const dy = Math.max(0, e.clientY - layer.drag.startY);
      layer.drag.dy = dy;
      sheet.style.transform = `translateY(${dy}px)`;
      if (layer.backdrop)
        layer.backdrop.style.opacity = String(Math.max(0, 1 - dy / 400));
    });
    const end = () => {
      if (!layer.drag)
        return;
      const dy = layer.drag.dy;
      layer.drag = null;
      sheet.style.transition = "";
      sheet.style.transform = "";
      if (layer.backdrop)
        layer.backdrop.style.opacity = "";
      if (dy > 80)
        closeSheet();
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
  function lockScroll() {
    layer.savedScrollY = window.scrollY || window.pageYOffset || 0;
    const b = document.body;
    b.style.position = "fixed";
    b.style.top = `-${layer.savedScrollY}px`;
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
  }
  function unlockScroll() {
    const b = document.body;
    b.style.position = "";
    b.style.top = "";
    b.style.left = "";
    b.style.right = "";
    b.style.width = "";
    window.scrollTo(0, layer.savedScrollY);
  }
  async function renderContent(card) {
    const cfg = card._config;
    const head = layer.headEl;
    head.textContent = "";
    if (cfg.icon) {
      const ic = document.createElement("fib-icon");
      ic.setAttribute("icon", cfg.icon);
      head.appendChild(ic);
    }
    const titles = document.createElement("div");
    titles.className = "titles";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = cfg.title || "";
    titles.appendChild(title);
    if (cfg.subtitle) {
      const sub = document.createElement("div");
      sub.className = "sub";
      sub.textContent = cfg.subtitle;
      titles.appendChild(sub);
    }
    const close = document.createElement("button");
    close.className = "close";
    close.setAttribute("aria-label", "Sluiten");
    close.textContent = "✕";
    close.addEventListener("click", () => closeSheet());
    head.append(titles, close);
    const body = layer.bodyEl;
    body.textContent = "";
    card._children = [];
    const configs = Array.isArray(cfg.cards) ? cfg.cards : [];
    if (!configs.length)
      return;
    try {
      const helpers = await window.loadCardHelpers();
      for (const c of configs) {
        const el = helpers.createCardElement(c);
        if (card._hass)
          el.hass = card._hass;
        card._children.push(el);
        body.appendChild(el);
      }
    } catch (_) {
      const msg = document.createElement("div");
      msg.style.cssText = "color:var(--fib-muted);font-size:12px;padding:8px";
      msg.textContent = "Kaarten konden niet geladen worden.";
      body.appendChild(msg);
    }
  }
  function openSheet(id) {
    const card = layer.sheets.get(id);
    if (!card || layer.openId === id)
      return;
    build();
    layer.openId = id;
    layer.host.setAttribute("data-open", "true");
    lockScroll();
    renderContent(card);
    requestAnimationFrame(() => requestAnimationFrame(() => layer.host.setAttribute("data-shown", reduceMotion() ? "true" : "true")));
  }
  function closeSheet() {
    if (layer.openId == null)
      return;
    const id = layer.openId;
    layer.openId = null;
    if (layer.host)
      layer.host.removeAttribute("data-shown");
    if (window.location.hash === "#" + id) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    const finish = () => {
      if (layer.openId != null)
        return;
      if (layer.host)
        layer.host.removeAttribute("data-open");
      if (layer.bodyEl)
        layer.bodyEl.textContent = "";
      unlockScroll();
    };
    if (reduceMotion())
      finish();
    else
      setTimeout(finish, 300);
  }
  function syncFromHash() {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && layer.sheets.has(hash))
      openSheet(hash);
    else if (layer.openId != null)
      closeSheet();
  }
  function registerSheet(id, card) {
    build();
    layer.sheets.set(id, card);
    if (window.location.hash === "#" + id)
      openSheet(id);
  }
  function unregisterSheet(id, card) {
    if (layer.sheets.get(id) === card)
      layer.sheets.delete(id);
    if (layer.openId === id)
      closeSheet();
    if (layer.sheets.size === 0 && layer.host) {
      layer.host.remove();
      layer.built = false;
      layer.host = null;
    }
  }
  function updateSheetHass(id, hass) {
    if (layer.openId !== id)
      return;
    const card = layer.sheets.get(id);
    if (card && card._children)
      card._children.forEach((el) => {
        el.hass = hass;
      });
  }
  window.addEventListener("hashchange", syncFromHash);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      closeSheet();
  });

  // src/cards/sheet.js
  class FibbersSheet extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:fibbers-sheet",
        id: "woonkamer",
        title: "Woonkamer",
        icon: "solar:sofa-2-bold-duotone",
        cards: []
      };
    }
    setConfig(config) {
      if (!config || !config.id || typeof config.id !== "string") {
        throw new Error("fibbers-sheet: `id` (a unique string) is required");
      }
      if (config.cards != null && !Array.isArray(config.cards)) {
        throw new Error("fibbers-sheet: `cards` must be a list");
      }
      if (this._config && this._config.id !== config.id && this.isConnected) {
        unregisterSheet(this._config.id, this);
      }
      this._config = config;
      if (!this._marker) {
        this._marker = document.createElement("span");
        this._marker.style.display = "none";
        this.appendChild(this._marker);
      }
      if (this.isConnected)
        registerSheet(config.id, this);
    }
    set hass(hass) {
      this._hass = hass;
      if (this._config)
        updateSheetHass(this._config.id, hass);
    }
    connectedCallback() {
      if (this._config)
        registerSheet(this._config.id, this);
    }
    disconnectedCallback() {
      if (this._config)
        unregisterSheet(this._config.id, this);
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/section.js
  class FibbersSection extends HTMLElement {
    static getStubConfig() {
      return { type: "custom:fibbers-section", label: "Kamers" };
    }
    setConfig(config) {
      if (!config || !config.label) {
        throw new Error("fibbers-section: `label` is required");
      }
      this._config = config;
      this._render();
    }
    set hass(_hass) {}
    _render() {
      if (!this.shadowRoot)
        this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        .label {
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          font-size: 9.5px;
          font-weight: 500;
          letter-spacing: .11em;
          text-transform: uppercase;
          color: var(--fib-muted);
          padding: 2px 2px 0;
        }
      </style>
      <div class="label"></div>`;
      this.shadowRoot.querySelector(".label").textContent = this._config.label;
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/room.js
  var isLight = (id) => typeof id === "string" && id.startsWith("light.");

  class FibbersRoom extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:fibbers-room",
        name: "Woonkamer",
        icon: "solar:sofa-2-bold-duotone",
        entities: ["light.tv_led_strip"],
        sheet: "woonkamer"
      };
    }
    setConfig(config) {
      if (!config || !config.name) {
        throw new Error("fibbers-room: `name` is required");
      }
      if (config.entities != null && !Array.isArray(config.entities)) {
        throw new Error("fibbers-room: `entities` must be a list");
      }
      if (config.entities == null && !config.area) {
        throw new Error("fibbers-room: provide `entities` or an `area`");
      }
      this._config = config;
      this._render();
    }
    _entities() {
      const c = this._config;
      if (Array.isArray(c.entities))
        return c.entities;
      const hass = this._hass;
      if (!c.area || !hass || !hass.entities)
        return [];
      const devices = hass.devices || {};
      return Object.values(hass.entities).filter((e) => {
        const area = e.area_id || (devices[e.device_id] || {}).area_id;
        return area === c.area && isLight(e.entity_id);
      }).map((e) => e.entity_id);
    }
    _lights() {
      return this._entities().filter(isLight);
    }
    set hass(hass) {
      const prev = this._hass;
      this._hass = hass;
      if (!prev)
        return this._paint();
      const changed = this._lights().some((id) => (prev.states[id] || {}).state !== (hass.states[id] || {}).state);
      if (changed)
        this._paint();
    }
    _state() {
      const hass = this._hass;
      const lights = this._lights();
      if (!hass || !lights.length)
        return { label: "—", lit: false, offline: false };
      let on = 0, avail = 0;
      lights.forEach((id) => {
        const st = hass.states[id];
        if (!st || st.state === "unavailable" || st.state === "unknown")
          return;
        avail++;
        if (st.state === "on")
          on++;
      });
      if (avail === 0)
        return { label: "Offline", lit: false, offline: true };
      if (on === 0)
        return { label: "Uit", lit: false, offline: false };
      return {
        label: `${on} van ${lights.length} aan`,
        lit: true,
        offline: false
      };
    }
    _render() {
      if (!this.shadowRoot)
        this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .tile {
          display: block; width: 100%; text-align: left;
          background: var(--fib-card);
          border: 1px solid var(--fib-line);
          border-radius: 15px;
          padding: 13px 13px 12px;
          color: var(--fib-ink);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: background .15s ease, border-color .15s ease;
        }
        .tile[data-lit="true"] {
          background: linear-gradient(145deg, #1E3427, #132016);
          border-color: #2E5238;
        }
        .tile[data-offline="true"] { opacity: .66; }
        .tile:active { transform: translateY(.5px); }
        fib-icon { --mdc-icon-size: 19px; width: 19px; height: 19px; color: var(--fib-muted); display: block; }
        .tile[data-lit="true"] fib-icon { color: var(--fib-accent); }
        .name { font-size: 13px; font-weight: 600; letter-spacing: -.01em; margin-top: 8px; }
        .state { font-size: 11px; color: var(--fib-muted); margin-top: 2px; }
        .tile[data-offline="true"] .state { color: var(--fib-red); }
      </style>
      <div class="tile" role="button" tabindex="0">
        <fib-icon></fib-icon>
        <div class="name"></div>
        <div class="state"></div>
      </div>`;
      const tile = this.shadowRoot.querySelector(".tile");
      tile.querySelector("fib-icon").setAttribute("icon", this._config.icon || "solar:home-angle-bold-duotone");
      tile.querySelector(".name").textContent = this._config.name;
      let holdTimer = null, held = false;
      const down = () => {
        held = false;
        holdTimer = setTimeout(() => {
          held = true;
          this._moreInfo();
        }, 500);
      };
      const up = () => clearTimeout(holdTimer);
      tile.addEventListener("pointerdown", down);
      ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => tile.addEventListener(ev, up));
      tile.addEventListener("click", () => {
        if (held)
          return;
        if (this._config.sheet)
          window.location.hash = this._config.sheet;
      });
      tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (this._config.sheet)
            window.location.hash = this._config.sheet;
        }
      });
      this._paint();
    }
    _paint() {
      if (!this.shadowRoot)
        return;
      const tile = this.shadowRoot.querySelector(".tile");
      if (!tile)
        return;
      const s = this._state();
      tile.setAttribute("data-lit", String(s.lit));
      tile.setAttribute("data-offline", String(s.offline));
      tile.querySelector(".state").textContent = s.label;
    }
    _moreInfo() {
      const ent = this._lights()[0] || this._entities()[0];
      if (!ent)
        return;
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: ent },
        bubbles: true,
        composed: true
      }));
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: 6, grid_rows: 1 };
    }
  }

  // src/actions.js
  function runAction(action, hass, host, fallbackEntity) {
    const a = action || { action: "none" };
    switch (a.action) {
      case "navigate":
        if (a.navigation_path)
          navigate(a.navigation_path);
        break;
      case "url":
        if (a.url_path)
          window.open(a.url_path, a.url_path.startsWith("http") ? "_blank" : "_self");
        break;
      case "toggle": {
        const entity = a.entity || fallbackEntity;
        if (entity && hass)
          hass.callService("homeassistant", "toggle", { entity_id: entity });
        break;
      }
      case "more-info": {
        const entityId = a.entity || fallbackEntity;
        if (entityId)
          host.dispatchEvent(new CustomEvent("hass-more-info", {
            detail: { entityId },
            bubbles: true,
            composed: true
          }));
        break;
      }
      case "call-service":
      case "perform-action": {
        const svc = a.service || a.perform_action;
        if (svc && svc.includes(".") && hass) {
          const [domain, service] = svc.split(".");
          hass.callService(domain, service, a.data || a.service_data || {}, a.target);
        }
        break;
      }
      default:
        break;
    }
  }

  // src/cards/light-row.js
  var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  class FibbersLightRow extends HTMLElement {
    static getStubConfig() {
      return { type: "custom:fibbers-light-row", entity: "light.tv_led_strip" };
    }
    setConfig(config) {
      if (!config || !config.entity) {
        throw new Error("fibbers-light-row: `entity` is required");
      }
      if (config.icon_tap_action != null && (typeof config.icon_tap_action !== "object" || typeof config.icon_tap_action.action !== "string")) {
        throw new Error("fibbers-light-row: `icon_tap_action` must be a HA action object (with an `action`)");
      }
      this._config = config;
      this._render();
    }
    _iconAction() {
      return this._config.icon_tap_action || { action: "toggle" };
    }
    _iconEntity() {
      return this._config.icon_entity || this._config.entity;
    }
    set hass(hass) {
      const prev = this._hass;
      this._hass = hass;
      if (this._dragging)
        return;
      const id = this._config.entity;
      if (!prev || JSON.stringify((prev.states[id] || {}).attributes || {}) !== JSON.stringify((hass.states[id] || {}).attributes || {}) || (prev.states[id] || {}).state !== (hass.states[id] || {}).state) {
        this._paint();
      }
    }
    _st() {
      return this._hass && this._hass.states[this._config.entity];
    }
    _pct() {
      const st = this._st();
      if (!st || st.state !== "on")
        return 0;
      const b = st.attributes.brightness;
      return b != null ? Math.round(b / 255 * 100) : 100;
    }
    _warmth() {
      const st = this._st();
      if (!st)
        return "";
      const mode = st.attributes.color_mode;
      if (mode && ["hs", "rgb", "rgbw", "rgbww", "xy"].includes(mode))
        return "Kleur";
      const k = st.attributes.color_temp_kelvin || (st.attributes.color_temp ? Math.round(1e6 / st.attributes.color_temp) : null);
      if (k == null)
        return "";
      if (k < 3000)
        return "Warm";
      if (k < 4600)
        return "Neutraal";
      return "Koel";
    }
    _render() {
      if (!this.shadowRoot)
        this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .row {
          display: grid;
          grid-template-columns: 28px 1fr;
          grid-template-rows: auto auto;
          column-gap: 10px; row-gap: 8px;
          align-items: center;
          padding: 8px 2px;
        }
        .ic {
          grid-row: 1 / span 2;
          width: 28px; height: 28px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          background: var(--fib-card-2);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          transition: transform .08s ease, background .15s ease;
        }
        .ic[data-pressed="true"] { transform: scale(.92); }
        .ic fib-icon { --mdc-icon-size: 17px; width: 17px; height: 17px; color: var(--fib-muted); }
        .row[data-on="true"] .ic { background: var(--fib-accent-bg); }
        .row[data-on="true"] .ic fib-icon { color: var(--fib-accent); }
        .row[data-unavail="true"] .ic { pointer-events: none; }
        .head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
        .name { font-size: 12px; font-weight: 500; color: var(--fib-ink); }
        .val { font-size: 10.5px; color: var(--fib-muted); white-space: nowrap; }
        .track {
          position: relative;
          height: 6px; border-radius: 3px;
          background: #2C3639;
          touch-action: none;
          cursor: pointer;
        }
        .fill {
          position: absolute; left: 0; top: 0; bottom: 0;
          border-radius: 3px;
          background: var(--fib-accent);
          width: 0%;
        }
        .knob {
          position: absolute; top: 50%;
          width: 14px; height: 14px; border-radius: 50%;
          background: var(--fib-accent);
          transform: translate(-50%, -50%);
          left: 0%;
          box-shadow: 0 1px 3px rgba(0,0,0,.4);
        }
        .row[data-unavail="true"] { opacity: .5; }
        .row[data-unavail="true"] .track { pointer-events: none; }
        .row[data-unavail="true"] .fill, .row[data-unavail="true"] .knob { display: none; }
      </style>
      <div class="row">
        <div class="ic"><fib-icon></fib-icon></div>
        <div class="head"><span class="name"></span><span class="val"></span></div>
        <div class="track"><div class="fill"></div><div class="knob"></div></div>
      </div>`;
      const row = this.shadowRoot.querySelector(".row");
      const track = row.querySelector(".track");
      const setFrom = (clientX, commit) => {
        const r = track.getBoundingClientRect();
        const pct = Math.round(clamp((clientX - r.left) / r.width * 100, 0, 100));
        this._preview(pct);
        if (commit)
          this._commit(pct);
      };
      track.addEventListener("pointerdown", (e) => {
        if (this._isUnavail())
          return;
        this._dragging = true;
        track.setPointerCapture && track.setPointerCapture(e.pointerId);
        setFrom(e.clientX, false);
      });
      track.addEventListener("pointermove", (e) => {
        if (!this._dragging)
          return;
        setFrom(e.clientX, false);
      });
      const end = (e) => {
        if (!this._dragging)
          return;
        this._dragging = false;
        setFrom(e.clientX, true);
      };
      track.addEventListener("pointerup", end);
      track.addEventListener("pointercancel", () => this._dragging = false);
      row.querySelector(".head").addEventListener("click", () => this._moreInfo());
      const ic = row.querySelector(".ic");
      ic.setAttribute("role", "button");
      ic.addEventListener("pointerdown", () => ic.setAttribute("data-pressed", "true"));
      ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => ic.addEventListener(ev, () => ic.removeAttribute("data-pressed")));
      ic.addEventListener("click", () => runAction(this._iconAction(), this._hass, this, this._iconEntity()));
      this._paint();
    }
    _isUnavail() {
      const st = this._st();
      return !st || st.state === "unavailable" || st.state === "unknown";
    }
    _preview(pct) {
      const row = this.shadowRoot.querySelector(".row");
      row.querySelector(".fill").style.width = pct + "%";
      row.querySelector(".knob").style.left = pct + "%";
      row.querySelector(".val").textContent = pct + "%";
      row.setAttribute("data-on", String(pct > 0));
    }
    _commit(pct) {
      const hass = this._hass;
      if (!hass)
        return;
      const entity_id = this._config.entity;
      if (pct <= 0)
        hass.callService("light", "turn_off", { entity_id });
      else
        hass.callService("light", "turn_on", { entity_id, brightness_pct: pct });
    }
    _paint() {
      if (!this.shadowRoot)
        return;
      const row = this.shadowRoot.querySelector(".row");
      const st = this._st();
      const name = this._config.name || st && st.attributes.friendly_name || this._config.entity;
      row.querySelector(".name").textContent = name;
      row.querySelector(".ic fib-icon").setAttribute("icon", this._config.icon || st && st.attributes.icon || "solar:lightbulb-bold-duotone");
      if (this._isUnavail()) {
        row.setAttribute("data-unavail", "true");
        row.setAttribute("data-on", "false");
        row.querySelector(".val").textContent = "Onbereikbaar";
        return;
      }
      row.removeAttribute("data-unavail");
      const on = st.state === "on";
      row.setAttribute("data-on", String(on));
      const pct = this._pct();
      row.querySelector(".fill").style.width = pct + "%";
      row.querySelector(".knob").style.left = pct + "%";
      if (on) {
        const w = this._warmth();
        row.querySelector(".val").textContent = w ? `${w} · ${pct}%` : `${pct}%`;
      } else {
        row.querySelector(".val").textContent = "Uit";
      }
    }
    _moreInfo() {
      this.dispatchEvent(new CustomEvent("hass-more-info", {
        detail: { entityId: this._config.entity },
        bubbles: true,
        composed: true
      }));
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/alert.js
  var friendly = (s) => s.attributes && s.attributes.friendly_name || s.entity_id;
  var isUnavail = (st) => !st || st.state === "unavailable" || st.state === "unknown";
  function runCheck(check, hass) {
    const states = Object.values(hass.states);
    const out = [];
    switch (check.type) {
      case "unavailable_lights": {
        const exclude = check.exclude || [];
        const offline = states.filter((s) => s.entity_id.startsWith("light.") && !exclude.includes(s.entity_id) && isUnavail(s));
        if (offline.length)
          out.push({
            label: offline.length === 1 ? "Lamp offline" : "Lampen offline",
            detail: offline.map(friendly).join(", "),
            entity: offline[0].entity_id
          });
        break;
      }
      case "low_battery": {
        const below = check.below != null ? check.below : 20;
        const pat = check.exclude_pattern ? new RegExp(check.exclude_pattern) : null;
        states.filter((s) => (s.attributes || {}).device_class === "battery" && !isNaN(parseFloat(s.state)) && parseFloat(s.state) < below && !(pat && pat.test(s.entity_id))).forEach((s) => out.push({
          label: "Batterij laag",
          detail: `${friendly(s)} (${s.state}%)`,
          entity: s.entity_id
        }));
        break;
      }
      case "updates": {
        const ups = states.filter((s) => s.entity_id.startsWith("update.") && s.state === "on");
        if (ups.length)
          out.push({
            label: "Updates",
            detail: ups.length === 1 ? `1 update beschikbaar` : `${ups.length} updates beschikbaar`,
            entity: ups[0].entity_id
          });
        break;
      }
      case "backup_age": {
        const st = hass.states[check.entity];
        const max = check.max_hours != null ? check.max_hours : 26;
        if (st && !isUnavail(st)) {
          const t = Date.parse(st.state);
          if (!isNaN(t)) {
            const hours = (Date.now() - t) / 3600000;
            if (hours > max)
              out.push({
                label: "Back-up",
                detail: `${Math.round(hours)} uur geleden`,
                entity: check.entity
              });
          }
        }
        break;
      }
    }
    return out;
  }

  class FibbersAlert extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:fibbers-alert",
        checks: [{ type: "unavailable_lights" }, { type: "updates" }]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.checks)) {
        throw new Error("fibbers-alert: `checks` must be a list");
      }
      this._config = config;
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
      this._paint();
    }
    _findings() {
      if (!this._hass)
        return [];
      const out = [];
      this._config.checks.forEach((c) => {
        try {
          out.push(...runCheck(c, this._hass));
        } catch (_) {}
      });
      return out;
    }
    _render() {
      if (!this.shadowRoot)
        this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .card {
          border-radius: 12px;
          border: 1px solid var(--fib-line);
          background: var(--fib-card);
          padding: 12px 13px;
        }
        .card[data-alert="true"] {
          background: var(--fib-amber-bg);
          border-color: var(--fib-amber-line);
        }
        .head { display: flex; align-items: center; gap: 8px; }
        .head fib-icon { --mdc-icon-size: 16px; width: 16px; height: 16px; color: var(--fib-green); }
        .card[data-alert="true"] .head fib-icon { color: var(--fib-amber); }
        .heading { font-size: 12px; font-weight: 600; color: var(--fib-green); }
        .card[data-alert="true"] .heading { color: var(--fib-amber); }
        .list { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; }
        .finding {
          font-size: 11.5px; line-height: 1.42; color: var(--fib-amber-tx);
          cursor: pointer; -webkit-tap-highlight-color: transparent;
        }
        .finding b { color: var(--fib-amber); font-weight: 600; }
      </style>
      <div class="card">
        <div class="head">
          <fib-icon></fib-icon>
          <span class="heading"></span>
        </div>
        <div class="list"></div>
      </div>`;
      this._paint();
    }
    _paint() {
      if (!this.shadowRoot)
        return;
      const card = this.shadowRoot.querySelector(".card");
      if (!card)
        return;
      const findings = this._findings();
      const alert = findings.length > 0;
      card.setAttribute("data-alert", String(alert));
      this.shadowRoot.querySelector(".head fib-icon").setAttribute("icon", alert ? "solar:danger-triangle-bold-duotone" : "solar:check-circle-bold-duotone");
      this.shadowRoot.querySelector(".heading").textContent = alert ? "Aandacht nodig" : "Alles in orde";
      const list = this.shadowRoot.querySelector(".list");
      list.textContent = "";
      findings.forEach((f) => {
        const row = document.createElement("div");
        row.className = "finding";
        const b = document.createElement("b");
        b.textContent = f.label;
        row.append(b, document.createTextNode(` — ${f.detail}`));
        if (f.entity)
          row.addEventListener("click", () => this.dispatchEvent(new CustomEvent("hass-more-info", {
            detail: { entityId: f.entity },
            bubbles: true,
            composed: true
          })));
        list.appendChild(row);
      });
    }
    getCardSize() {
      return 2;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 2 };
    }
  }

  // src/cards/chips.js
  class FibbersChips extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:fibbers-chips",
        chips: [
          {
            name: "Alles uit",
            icon: "solar:power-bold-duotone",
            action: { action: "toggle" }
          }
        ]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.chips)) {
        throw new Error("fibbers-chips: `chips` must be a list");
      }
      this._config = config;
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
      this._paintActive();
    }
    _render() {
      if (!this.shadowRoot)
        this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .row { display: flex; flex-wrap: wrap; gap: 7px; }
        .chip {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10.5px; font-weight: 500;
          color: var(--fib-ink-2);
          background: var(--fib-card-2);
          border: 1px solid var(--fib-line);
          border-radius: 999px;
          padding: 5px 10px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .chip[data-active="true"] {
          color: var(--fib-blue-ink);
          background: var(--fib-blue-bg);
          border-color: var(--fib-blue-line);
        }
        .chip fib-icon { --mdc-icon-size: 13px; width: 13px; height: 13px; }
      </style>
      <div class="row"></div>`;
      const row = this.shadowRoot.querySelector(".row");
      this._config.chips.forEach((chip, i) => {
        const el = document.createElement("button");
        el.className = "chip";
        el.type = "button";
        el.dataset.i = String(i);
        if (chip.icon) {
          const ic = document.createElement("fib-icon");
          ic.setAttribute("icon", chip.icon);
          el.appendChild(ic);
        }
        const span = document.createElement("span");
        span.textContent = chip.name || "";
        el.appendChild(span);
        el.addEventListener("click", () => {
          if (this._hass)
            runAction(chip.action || chip.tap_action, this._hass, this, chip.entity);
        });
        row.appendChild(el);
      });
      this._paintActive();
    }
    _paintActive() {
      if (!this.shadowRoot || !this._hass)
        return;
      this.shadowRoot.querySelectorAll(".chip").forEach((el) => {
        const chip = this._config.chips[+el.dataset.i];
        const aw = chip.active_when;
        let active = false;
        if (aw && aw.entity) {
          const st = this._hass.states[aw.entity];
          active = st && (aw.state != null ? st.state === aw.state : st.state === "on");
        }
        el.setAttribute("data-active", String(!!active));
      });
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/cards/scene.js
  var activatedAt = (st) => {
    if (!st)
      return 0;
    const raw = st.attributes && st.attributes.last_activated || st.state || null;
    const t = raw ? Date.parse(raw) : NaN;
    return isNaN(t) ? 0 : t;
  };

  class FibbersScene extends HTMLElement {
    static getStubConfig() {
      return {
        type: "custom:fibbers-scene",
        scenes: [
          {
            name: "Avond",
            icon: "solar:moon-bold-duotone",
            scene: "scene.avond"
          }
        ]
      };
    }
    setConfig(config) {
      if (!config || !Array.isArray(config.scenes) || !config.scenes.length) {
        throw new Error("fibbers-scene: `scenes` must be a non-empty list");
      }
      config.scenes.forEach((s, i) => {
        if (!s || !s.scene)
          throw new Error(`fibbers-scene: scenes[${i}] is missing \`scene\``);
      });
      this._config = config;
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
      this._paint();
    }
    _render() {
      if (!this.shadowRoot)
        this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(72px, 1fr)); gap: 8px; }
        .tile {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 12px 8px;
          border-radius: 13px;
          background: var(--fib-card);
          border: 1px solid var(--fib-line);
          color: var(--fib-ink-2);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        .tile[data-active="true"] {
          background: linear-gradient(145deg, #1E3427, #132016);
          border-color: #2E5238;
          color: var(--fib-accent-tx);
        }
        .tile fib-icon { --mdc-icon-size: 17px; width: 17px; height: 17px; color: var(--fib-muted); }
        .tile[data-active="true"] fib-icon { color: var(--fib-accent); }
        .label { font-size: 10px; font-weight: 500; }
      </style>
      <div class="row"></div>`;
      const row = this.shadowRoot.querySelector(".row");
      this._config.scenes.forEach((s, i) => {
        const el = document.createElement("button");
        el.className = "tile";
        el.type = "button";
        el.dataset.i = String(i);
        const ic = document.createElement("fib-icon");
        ic.setAttribute("icon", s.icon || "solar:palette-bold-duotone");
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = s.name || s.scene;
        el.append(ic, label);
        el.addEventListener("click", () => {
          if (this._hass)
            this._hass.callService("scene", "turn_on", { entity_id: s.scene });
        });
        row.appendChild(el);
      });
      this._paint();
    }
    _paint() {
      if (!this.shadowRoot || !this._hass)
        return;
      let best = -1, bestT = 0;
      this._config.scenes.forEach((s, i) => {
        const t = activatedAt(this._hass.states[s.scene]);
        if (t > bestT) {
          bestT = t;
          best = i;
        }
      });
      this.shadowRoot.querySelectorAll(".tile").forEach((el) => {
        el.setAttribute("data-active", String(+el.dataset.i === best && bestT > 0));
      });
    }
    getCardSize() {
      return 1;
    }
    getLayoutOptions() {
      return { grid_columns: "full", grid_rows: 1 };
    }
  }

  // src/index.js
  /*!
   * Fibbers — custom cards + theming for the Thuis Home Assistant dashboard.
   *
   * Ships:
   *   custom:fibbers-nav    bottom navigation bar, genuinely pinned to the viewport
   *   custom:fibbers-back   back control driven by a real navigation stack
   *
   * WHY THE BAR RENDERS INTO document.body
   * Inside a Lovelace view, `position: fixed` resolves against the scrolling
   * content box rather than the window, so a bar "fixed to the bottom" lands at
   * the bottom of the page instead of the screen. Rendering into document.body is
   * the only reliable escape, and it is also what keeps the bar working
   * independent of Lovelace's own DOM. Everything else here follows from that.
   *
   * Source is modular under src/. `bun run build` bundles it into an IIFE at
   * dist/fibbers.js — edit src/, never the bundle.
   */
  var VERSION = "0.1.0";
  var CARDS = [
    [
      "fibbers-nav",
      FibbersNav,
      "Fibbers Nav",
      "Bottom navigation bar pinned to the viewport."
    ],
    [
      "fibbers-back",
      FibbersBack,
      "Fibbers Back",
      "Back control driven by a real navigation stack."
    ],
    [
      "fibbers-sheet",
      FibbersSheet,
      "Fibbers Sheet",
      "Hash-routed modal bottom sheet."
    ],
    [
      "fibbers-section",
      FibbersSection,
      "Fibbers Section",
      "Uppercase mono section label."
    ],
    [
      "fibbers-room",
      FibbersRoom,
      "Fibbers Room",
      "Room tile that computes its own light state."
    ],
    [
      "fibbers-light-row",
      FibbersLightRow,
      "Fibbers Light Row",
      "Light row with a brightness slider, for sheets."
    ],
    [
      "fibbers-alert",
      FibbersAlert,
      "Fibbers Alert",
      "Attention card driven by real checks."
    ],
    ["fibbers-chips", FibbersChips, "Fibbers Chips", "A row of action pills."],
    [
      "fibbers-scene",
      FibbersScene,
      "Fibbers Scene",
      "Scene tiles that highlight the active scene."
    ]
  ];
  CARDS.forEach(([tag, cls]) => {
    if (!customElements.get(tag))
      customElements.define(tag, cls);
  });
  window.customCards = window.customCards || [];
  CARDS.forEach(([tag, , name, description]) => {
    if (!window.customCards.some((c) => c.type === tag)) {
      window.customCards.push({ type: tag, name, description, preview: false });
    }
  });
  injectGlobalCss();
  window.FIBBERS = {
    VERSION,
    nav,
    goBack,
    previous,
    navigate,
    tokens: T,
    styleBlock,
    injectGlobalCss,
    bar
  };
  console.info(`%c FIBBERS %c v${VERSION} `, "color:#111516;background:#74B98A;font-weight:600;border-radius:3px 0 0 3px;padding:2px 4px", "color:#74B98A;background:#1D2426;border-radius:0 3px 3px 0;padding:2px 4px");
})();
