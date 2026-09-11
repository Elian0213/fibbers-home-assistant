/* ================================================================== *
 * BODY LAYER — the singleton bottom nav bar (reference-counted across cards).
 * Rendered into document.body so position:fixed pins to the viewport, not
 * Lovelace's transformed container. The iOS-tuned container CSS is load-bearing.
 * ================================================================== */
import { render, html, nothing, type LitElement } from "lit";

import { reflectTheme } from "@shared/theme-host";
import { T } from "@shared/tokens";
import { twSheet } from "@shared/tw";
import { norm, here, navigate, deepFind, capturePointer } from "@shared/util";

import {
  setTabHiding,
  removeTabHiding,
  type TabHideMode,
} from "@core/hide-tabs";
import { enableMoreInfo, disableMoreInfo } from "@core/more-info";
import { nav, registerTabs, startNav, stopNav } from "@core/nav-stack";
import { applyTheme, removeTheme, type ThemeMode } from "@core/theme";
import { setViewReserve, removeViewReserve } from "@core/view-reserve";
import "@shared/icon";

/** A badge dot config for a tab — lit when the entity is active (or equals `when`). */
export interface NavBadge {
  entity: string;
  when?: string;
}

/** A single tab in the bottom nav bar. */
export interface NavTab {
  path: string;
  name?: string;
  icon?: string;
  match?: "prefix" | "exact";
  badge?: NavBadge;
}

/** The fibbers-nav card config the bar renders from. */
export interface NavConfig {
  tabs?: NavTab[];
  offset_bottom?: number;
  extra_bottom?: number;
  reserve?: number | null;
  respect_sidebar?: boolean;
  auto_hide?: boolean;
  hide_ha_tabs?: TabHideMode;
  theme?: ThemeMode | string;
  more_info?: boolean;
}

/** The one nav bar's shared, mutable runtime state. */
export interface Bar {
  host: HTMLElement | null;
  owners: Set<LitElement>;
  config: NavConfig | null;
  height: number;
  hidden: boolean;
  lastScroll: number;
}

/**
 * Shared mutable state for the one nav bar — the body-portal host, the set of
 * card owners keeping it alive, current config, and auto-hide scroll bookkeeping.
 */
export const bar: Bar = {
  host: null,
  owners: new Set<LitElement>(),
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
    position: relative;
    background: var(--color-nav, ${T.nav});
    border-top: 1px solid var(--color-line, ${T.line});
    padding: 7px 6px calc(9px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 60px 0 60px var(--color-nav, ${T.nav});
    transform: translateZ(0);
    /* the bar owns its touch gestures: a horizontal drag scrubs between tabs.
       none, NOT pan-y — on iOS pan-y lets the browser directional-lock a
       slightly-off-axis drag and pointercancel it ~10px in, killing the swipe
       under the finger. Matches every other Fibbers drag surface (shared/ui.ts). */
    touch-action: none;
  }
  /* desktop sidebar inset: drop the 60px horizontal spread so the overscroll
     floor never bleeds a nav-coloured slab over the sidebar */
  :host([data-inset="true"]) .bar { box-shadow: 0 60px 0 0 var(--color-nav, ${T.nav}); }
  .tabs { display: flex; align-items: stretch; gap: 2px; }
  /* the tab buttons pick up the shadow's global button{touch-action:manipulation}
     — override so a touch landing on a button doesn't re-enable panning and
     re-trigger the iOS pointercancel (none keeps taps instant, no 300ms delay). */
  .tabs button { touch-action: none; }
  /* the single soft-green focus pill that glides to the active tab (Instagram-
     style). z-index:-1 tucks it behind the icons/labels but above the bar fill. */
  .ind {
    position: absolute; left: 0; top: 0; z-index: -1;
    border-radius: 9px;
    /* the pill tints from the live theme accent, so it tracks light/dark like
       every card instead of a hard-coded green wash */
    background: color-mix(in srgb, var(--color-accent, ${T.accent}) 12%, transparent);
    opacity: 0;
    pointer-events: none;
    transform-origin: center;
    will-change: transform, width;
    transition:
      transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
      width 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @media (prefers-reduced-motion: reduce) {
    .ind { transition: none; }
  }
`;
const hostSheet = new CSSStyleSheet();
hostSheet.replaceSync(HOST_CSS);

// Reserve bottom space on the view so the bar never covers the last card.
// `reserve` is an absolute override (as before); otherwise it's the measured bar
// height plus optional `extra_bottom` breathing room. `offset_bottom` (which
// lifts the bar off the viewport floor) is added on top either way.
function syncViewReserve(): void {
  const cfg: NavConfig = bar.config || {};
  const offset = Number(cfg.offset_bottom) || 0;
  const extra = Number(cfg.extra_bottom) || 0;
  const base =
    cfg.reserve != null ? Number(cfg.reserve) : (bar.height || 74) + extra;
  setViewReserve(base + offset);
}

/**
 * Re-measure the bar's rendered height and re-reserve view space when it changes.
 * The 0.5px threshold avoids thrashing the reserve on sub-pixel layout jitter.
 */
export function measureBar(): void {
  if (!bar.host) return;
  const div = bar.host.shadowRoot!.querySelector(".bar");
  const h = div ? div.getBoundingClientRect().height : 0;
  if (h && Math.abs(h - bar.height) > 0.5) {
    bar.height = h;
    syncViewReserve();
  }
}

/* ------------------------------------------------------------------ *
 * Sidebar inset — on desktop the docked ha-sidebar overlaps the pinned bar,
 * so inset the bar's start edge by the sidebar's measured width. 0 when the
 * drawer is modal (narrow), the sidebar is hidden, or respect_sidebar: false.
 * ------------------------------------------------------------------ */
let sidebarRO: ResizeObserver | null = null;
let drawerMO: MutationObserver | null = null;
let barRO: ResizeObserver | null = null;
let insetScheduled = false;

function computeInset(): number {
  if (!bar.config || bar.config.respect_sidebar === false) return 0;
  const drawer = deepFind("ha-drawer");
  if (drawer && drawer.getAttribute("type") === "modal") return 0; // narrow → overlay
  // HA's dockedSidebar is really a string ("docked" | "always_hidden" | "auto") —
  // custom-card-helpers just types it boolean.
  if (
    nav.hassRef &&
    (nav.hassRef as unknown as { dockedSidebar?: string }).dockedSidebar ===
      "always_hidden"
  )
    return 0;
  const sidebar = deepFind("ha-sidebar");
  const w = sidebar ? sidebar.getBoundingClientRect().width : 0;
  return w > 0 ? Math.round(w) : 0;
}

// Attach the observers once HA's shell exists; idempotent, safe to re-call.
function observeSidebar(): void {
  if (!sidebarRO && window.ResizeObserver) {
    const sidebar = deepFind("ha-sidebar");
    if (sidebar) {
      // scheduleInset ↔ syncSidebarInset ↔ observeSidebar form a cycle (rAF-broken).
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      sidebarRO = new ResizeObserver(scheduleInset); // expand/collapse + rail
      sidebarRO.observe(sidebar);
    }
  }
  if (!drawerMO && window.MutationObserver) {
    const drawer = deepFind("ha-drawer");
    if (drawer) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define -- same rAF-broken cycle
      drawerMO = new MutationObserver(scheduleInset); // narrow ↔ wide flip
      drawerMO.observe(drawer, { attributes: true, attributeFilter: ["type"] });
    }
  }
}

function syncSidebarInset(): void {
  if (!bar.host) return;
  observeSidebar();
  const inset = computeInset();
  bar.host.style.insetInlineStart = inset ? `${inset}px` : ""; // RTL-correct; right:0 stays
  if (inset) bar.host.setAttribute("data-inset", "true");
  else bar.host.removeAttribute("data-inset");
}

// One write per frame — the sidebar animates and fires a lot.
function scheduleInset(): void {
  if (insetScheduled) return;
  insetScheduled = true;
  requestAnimationFrame(() => {
    insetScheduled = false;
    syncSidebarInset();
  });
}

// Named module-level handlers so re-adding on a rebuild is a no-op (the browser
// dedupes identical type+listener+options) — an anonymous closure would leak one
// listener per attach/detach cycle.
const onOrientationChange = (): void => {
  setTimeout(measureBar, 250);
  scheduleInset();
};
const onResizeInset = (): void => scheduleInset();

function tabMatches(tab: NavTab, path: string): boolean {
  const target = norm(tab.path);
  if (tab.match === "prefix")
    return path === target || path.startsWith(`${target}/`);
  return path === target;
}

function activeIndex(tabs: NavTab[], path: string): number {
  const exact = tabs.findIndex((t) => norm(t.path) === path);
  if (exact !== -1) return exact;
  const pre = tabs.findIndex((t) => tabMatches(t, path));
  if (pre !== -1) return pre;
  const root = nav.stack.length ? norm(nav.stack[0]) : null;
  return root ? tabs.findIndex((t) => norm(t.path) === root) : -1;
}

function badgeActive(badge: NavBadge, hass: typeof nav.hassRef): boolean {
  const st = hass && hass.states[badge.entity];
  if (!st) return false;
  if (badge.when) return st.state === badge.when;
  return !["off", "unavailable", "unknown"].includes(st.state);
}

const press = (e: Event, on: boolean): void => {
  const target = e.currentTarget as HTMLElement;
  if (on) target.setAttribute("data-pressed", "true");
  else target.removeAttribute("data-pressed");
};

/* ------------------------------------------------------------------ *
 * Sliding focus pill + swipe-to-switch (Instagram-style). One pill (.ind)
 * glides between tabs; a horizontal drag on the bar scrubs the pill with the
 * finger, snaps to the nearest tab on release (or flicks one tab on a fast
 * throw), and navigates. Touch + mouse via the shared pointerDrag gesture.
 * ------------------------------------------------------------------ */
let dragging = false; // a horizontal tab-swipe is live — syncIndicator stands off
let indReady = false; // first placement snaps; later route changes animate
const FLICK_V = 0.4; // px/ms — a throw faster than this advances one tab
const FLICK_STALE_MS = 120; // ignore the throw if the finger paused before lifting
const RUBBER = 0.25; // drag ratio past the first / last tab (lower = firmer edge)
const SQUISH_MAX = 0.08; // max horizontal stretch (scaleX − 1) toward a fast drag

/** Geometry of a tab's content pill (relative to the .bar padding box). */
interface Geo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The persistent tab row + pill, or null before the bar is built. */
function barParts(): { tabs: HTMLElement; ind: HTMLElement } | null {
  const root = bar.host?.shadowRoot;
  const tabs = root?.querySelector<HTMLElement>(".tabs");
  const ind = root?.querySelector<HTMLElement>(".ind");
  return tabs && ind ? { tabs, ind } : null;
}

const buttonList = (tabs: HTMLElement): HTMLElement[] =>
  Array.from(tabs.children) as HTMLElement[];

/**
 * Where tab `i`'s content pill sits, relative to the .bar padding box. The
 * button carries `relative` (for its badge), so its span's offsetLeft is
 * button-relative — sum button + span to land back in .bar coordinates, which
 * is the same origin the absolute .ind is positioned from.
 */
function tabGeoAt(btns: HTMLElement[], i: number): Geo | null {
  const btn = btns[i];
  const sp = btn?.querySelector<HTMLElement>(".tabc");
  if (!btn || !sp) return null;
  return {
    x: btn.offsetLeft + sp.offsetLeft,
    y: btn.offsetTop + sp.offsetTop,
    w: sp.offsetWidth,
    h: sp.offsetHeight,
  };
}

/** Move/resize the pill to `g`. `animate:false` sets `transition:none` so the
 *  jump is instant (first paint, resize, per-frame drag); `true` falls back to
 *  the stylesheet transition (which reduced-motion users still get as none). */
function placeInd(ind: HTMLElement, g: Geo, animate: boolean): void {
  const el = ind; // alias so mutations aren't flagged as param reassignment
  el.style.transition = animate ? "" : "none";
  el.style.width = `${g.w}px`;
  el.style.height = `${g.h}px`;
  el.style.transform = `translate(${g.x}px, ${g.y}px)`;
  el.style.opacity = "1";
}

/**
 * Reposition the pill under the routed-active tab. Called after every renderBar
 * (animate) and on reflow (snap). No-ops mid-drag — the gesture owns the pill.
 */
function syncIndicator(animate: boolean): void {
  if (dragging) return;
  const p = barParts();
  if (!p) return;
  const btns = buttonList(p.tabs);
  const active = activeIndex(bar.config?.tabs || [], here());
  if (active < 0 || !btns.length) {
    p.ind.style.opacity = "0"; // no tab matches the route — hide the pill
    return;
  }
  const g = tabGeoAt(btns, active);
  if (!g) return;
  placeInd(p.ind, g, animate && indReady);
  indReady = true;
}

/**
 * Wire the horizontal swipe gesture, the drag-swallows-the-click guard, and
 * arrow-key tab nav onto the (persistent) bar. Called once from buildBar — the
 * bar/tabs elements survive Lit re-renders, so the listeners never re-bind.
 */
function wireSwipe(barDiv: HTMLElement, tabsDiv: HTMLElement): void {
  let geo: Geo[] = []; // each tab's pill geometry, captured at drag start
  let pid = -1; // active pointerId (−1 = idle); one pointer owns the gesture
  let startIdx = 0; // active tab when the drag began
  let baseX = 0; // pill left-x at drag start
  let downX = 0; // pointer x at pointerdown (for slop + delta)
  let downY = 0; // pointer y at pointerdown (for the directional lock)
  let curIdx = 0; // tab the pill currently reads as (drives live recolour)
  let moved = false; // cleared slop AND locked horizontal (capture taken)
  let vx = 0; // last-sampled horizontal velocity (px/ms)
  let lastX = 0;
  let lastT = 0;
  let swallow = false; // swallow the click that follows a real drag
  let indEl: HTMLElement | null = null; // cached for the hot pointermove path

  // Live-recolour: the tab the pill is over reads accent, the rest muted. Lit
  // overwrites this on the next renderBar, so it only needs to hold mid-drag.
  const paintActive = (i: number): void => {
    buttonList(tabsDiv).forEach((btn, k) => {
      const sp = btn.querySelector<HTMLElement>(".tabc");
      if (!sp) return;
      sp.classList.toggle("text-accent", k === i);
      sp.classList.toggle("text-muted", k !== i);
    });
  };

  // Fractional tab index for a pill left-x, so the pill can morph between tabs.
  const fracIndex = (x: number): number => {
    if (x <= geo[0].x) return 0;
    for (let i = 1; i < geo.length; i++) {
      if (x <= geo[i].x) {
        const span = geo[i].x - geo[i - 1].x || 1;
        return i - 1 + (x - geo[i - 1].x) / span;
      }
    }
    return geo.length - 1;
  };
  const nearest = (x: number): number =>
    Math.max(0, Math.min(geo.length - 1, Math.round(fracIndex(x))));
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
  // Pill geometry at a given left-x — interpolated between the two straddled
  // tabs, or the end tab's size (translated) while rubber-banding past an edge.
  const interp = (x: number): Geo => {
    const first = geo[0];
    const last = geo[geo.length - 1];
    if (x <= first.x) return { ...first, x };
    if (x >= last.x) return { ...last, x };
    const f = fracIndex(x);
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, geo.length - 1);
    const t = f - i0;
    return {
      x,
      y: lerp(geo[i0].y, geo[i1].y, t),
      w: lerp(geo[i0].w, geo[i1].w, t),
      h: lerp(geo[i0].h, geo[i1].h, t),
    };
  };

  // Capture the pointer ONLY once a horizontal drag locks in — never on a plain
  // tap. Capturing on pointerdown (as a slider does) would retarget the trailing
  // click to the bar, so the tapped button's @click would never fire. A tap thus
  // takes no capture and keeps its native click (and keyboard Enter/Space); a
  // real drag captures on lock so the finger can leave the bar and still release.
  const onDown = (e: PointerEvent): void => {
    if (pid !== -1) return; // one pointer owns the gesture; ignore extra fingers
    const cfg = bar.config?.tabs || [];
    if (cfg.length < 2) return; // nothing to swipe — taps still work natively
    const btns = buttonList(tabsDiv);
    const g = btns.map((_, i) => tabGeoAt(btns, i));
    if (g.some((x) => !x)) return;
    geo = g as Geo[];
    startIdx = Math.max(0, Math.min(geo.length - 1, activeIndex(cfg, here())));
    curIdx = startIdx;
    baseX = geo[startIdx].x;
    pid = e.pointerId;
    downX = e.clientX;
    downY = e.clientY;
    moved = false;
    swallow = false; // clear any stale swallow from a drag that fired no click
    vx = 0;
    lastX = e.clientX;
    lastT = e.timeStamp;
    indEl = barParts()?.ind || null;
  };

  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (!moved) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return; // sub-slop: not a drag yet
      // Directional lock: a mostly-vertical first move isn't a tab swipe — drop
      // the gesture so it stays a tap (or does nothing). The bar owns its
      // touch-action, so there's no native scroll to hand back; no capture yet.
      if (Math.abs(dy) > Math.abs(dx)) {
        pid = -1;
        return;
      }
      moved = true;
      dragging = true;
      // Capture only for MOUSE. Touch/pen give the pointerdown target (the tab
      // button) IMPLICIT pointer capture (W3C spec), so every later event
      // retargets to the button and still bubbles through this bar — the drag
      // keeps flowing even off the bar, no capture needed. Stealing that capture
      // here fired a bubbling lostpointercapture from the button into our own
      // cancel handler (killing the swipe ~10px in on every touchscreen), and
      // WebKit is buggy about mid-gesture child→ancestor transfers anyway.
      if (e.pointerType === "mouse") capturePointer(barDiv, e.pointerId);
      if (indEl) {
        indEl.style.transition = "none"; // follow the finger 1:1
        indEl.style.opacity = "1"; // reveal the pill even if no tab was active
      }
      buttonList(tabsDiv).forEach((b) => b.removeAttribute("data-pressed"));
    }
    const dt = e.timeStamp - lastT;
    if (dt > 0) {
      vx = (e.clientX - lastX) / dt;
      lastX = e.clientX;
      lastT = e.timeStamp;
    }
    let x = baseX + dx;
    const minX = geo[0].x;
    const maxX = geo[geo.length - 1].x;
    if (x < minX) x = minX - (minX - x) * RUBBER;
    else if (x > maxX) x = maxX + (x - maxX) * RUBBER;
    if (indEl) {
      const g = interp(x);
      // squish: stretch a touch in the direction of a fast drag; on release
      // placeInd drops the scale and the settle transition springs it back
      const squish = 1 + Math.min(SQUISH_MAX, Math.abs(vx) * 0.04);
      indEl.style.width = `${g.w}px`;
      indEl.style.height = `${g.h}px`;
      indEl.style.transform = `translate(${g.x}px, ${g.y}px) scaleX(${squish})`;
    }
    const ni = nearest(x);
    if (ni !== curIdx) {
      curIdx = ni;
      paintActive(ni);
    }
  };

  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== pid) return;
    const wasMoved = moved;
    pid = -1;
    moved = false;
    dragging = false;
    buttonList(tabsDiv).forEach((b) => b.removeAttribute("data-pressed"));
    if (!wasMoved) return; // a stationary tap — let the button's @click navigate
    swallow = true; // a real drag: eat the trailing synthetic click
    let target = nearest(baseX + (e.clientX - downX));
    // A decisive flick advances at least one tab in the throw direction, even if
    // the finger never crossed the next tab's midpoint — but only if the finger
    // was still moving at release (a pause leaves vx stale).
    if (e.timeStamp - lastT < FLICK_STALE_MS && Math.abs(vx) > FLICK_V) {
      target =
        vx > 0
          ? Math.min(geo.length - 1, Math.max(target, startIdx + 1))
          : Math.max(0, Math.min(target, startIdx - 1));
    }
    const g = tabGeoAt(buttonList(tabsDiv), target);
    if (indEl && g) placeInd(indEl, g, true); // settle with the CSS transition
    // no paintActive here: a real move re-navigates (renderBar repaints), and a
    // snap-back target is the tab the last pointermove already painted.
    const path = (bar.config?.tabs || [])[target]?.path;
    if (path && norm(path) !== here()) navigate(path);
  };

  // pointercancel (browser stole the gesture) and the post-release
  // lostpointercapture both land here; the latter no-ops because pid is already
  // −1 after onUp.
  const onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== pid) return;
    pid = -1;
    moved = false;
    dragging = false;
    buttonList(tabsDiv).forEach((b) => b.removeAttribute("data-pressed"));
  };

  barDiv.addEventListener("pointerdown", onDown);
  barDiv.addEventListener("pointermove", onMove);
  barDiv.addEventListener("pointerup", onUp);
  barDiv.addEventListener("pointercancel", onCancel);
  // lostpointercapture BUBBLES — a tab button releasing its implicit touch
  // capture (tap release, or a handoff) reaches this listener too. That's not
  // our loss: only the bar itself losing capture (a genuine mid-drag mouse
  // capture loss) cancels the gesture.
  barDiv.addEventListener("lostpointercapture", (e: PointerEvent) => {
    if (e.target !== barDiv) return;
    onCancel(e);
  });
  // A drag past the slop swallows the click it would otherwise fire on whatever
  // button ends up under the pointer (mirrors dragScroll in shared/ui).
  barDiv.addEventListener(
    "click",
    (e) => {
      if (!swallow) return;
      e.stopPropagation();
      e.preventDefault();
      swallow = false;
    },
    true, // capture: run before the button's own @click
  );
  // Keyboard parity with the swipe: Arrow Left/Right steps to the adjacent tab.
  tabsDiv.addEventListener("keydown", (e: KeyboardEvent) => {
    let dir = 0;
    if (e.key === "ArrowRight") dir = 1;
    else if (e.key === "ArrowLeft") dir = -1;
    if (!dir) return;
    const cfg = bar.config?.tabs || [];
    const btns = buttonList(tabsDiv);
    const cur = activeIndex(cfg, here());
    const from = cur < 0 ? 0 : cur;
    const next = Math.max(0, Math.min(btns.length - 1, from + dir));
    if (next === cur) return;
    e.preventDefault();
    btns[next]?.focus();
    const path = cfg[next]?.path;
    if (path && norm(path) !== here()) navigate(path);
  });
}

/**
 * Render (or re-render) the tab buttons into the host from the current config —
 * the render target for nav-stack listeners and hashchange, so the active tab and
 * badges track the route.
 */
export function renderBar(): void {
  if (!bar.host || !bar.config) return;
  const div = bar.host.shadowRoot!.querySelector<HTMLElement>(".tabs");
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
        @pointerdown=${(e: Event) => press(e, true)}
        @pointerup=${(e: Event) => press(e, false)}
        @pointercancel=${(e: Event) => press(e, false)}
        @pointerleave=${(e: Event) => press(e, false)}
        @click=${() => {
          if (norm(tab.path) === here()) return;
          navigate(tab.path);
        }}
      >
        <!-- content pill (the tabc span), capped to content width and centred;
             the active green wash now lives on the shared sliding .ind behind it,
             so this only carries text colour (crossfaded as the pill arrives) -->
        <span
          class="tabc pointer-events-none mx-auto flex w-full max-w-[96px] flex-col items-center
                 gap-[3px] rounded-[9px] px-3 py-1 text-[9.5px] font-medium leading-[1.1]
                 tracking-[0.01em] transition-colors duration-200
                 group-data-[pressed=true]:bg-[rgba(255,255,255,0.06)]
                 ${i === active ? "text-accent" : "text-muted"}"
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
    div!,
  );
  measureBar();
  syncIndicator(true); // glide the pill to the (possibly new) active tab
}

/**
 * Reflect HA's light/dark mode onto the bar host, so the nav bar follows the
 * theme like every card does. Called from the nav card's `set hass`.
 * @param hass — the Home Assistant object (carries `themes.darkMode`)
 */
export function reflectBarTheme(hass: unknown): void {
  if (bar.host) reflectTheme(bar.host, hass);
}

function buildBar(): HTMLElement {
  const host = document.createElement("div");
  host.id = "fibbers-nav";
  host.setAttribute("role", "navigation");
  host.setAttribute("aria-label", "Dashboard sections");
  const shadow = host.attachShadow({ mode: "open" });
  shadow.adoptedStyleSheets = [twSheet as CSSStyleSheet, hostSheet];
  const div = document.createElement("div");
  div.className = "bar";
  const ind = document.createElement("div");
  ind.className = "ind";
  const tabs = document.createElement("div");
  tabs.className = "tabs";
  div.append(ind, tabs); // pill first (behind), tab row second
  shadow.append(div);
  document.body.appendChild(host);
  reflectTheme(host, nav.hassRef); // paint the theme before HA's first hass push

  wireSwipe(div, tabs); // Instagram-style swipe-to-switch + click-swallow + arrows

  // Stored so detach() can disconnect it — an anonymous observer leaked one per
  // attach/detach cycle.
  if (window.ResizeObserver) {
    barRO = new ResizeObserver(() => {
      measureBar();
      if (!dragging) syncIndicator(false); // keep the pill aligned on reflow
    });
    barRO.observe(div);
  }
  window.addEventListener("orientationchange", onOrientationChange);
  window.addEventListener("resize", measureBar);
  window.addEventListener("resize", onResizeInset);
  // Re-render on nav-stack changes and hash routing — bound with the host, torn
  // down in detach, so nothing fires against a removed bar.
  nav.listeners.add(renderBar);
  window.addEventListener("hashchange", renderBar);
  startNav();

  return host;
}

// Named so it can be removed on detach (an inline closure couldn't be), and the
// options object is shared so add/remove match.
const AUTO_HIDE_OPTS: AddEventListenerOptions = {
  capture: true,
  passive: true,
};
function onScrollHide(e: Event): void {
  const y = (e.target as Element | null)?.scrollTop || 0;
  const dy = y - bar.lastScroll;
  if (Math.abs(dy) < 6) return;
  bar.lastScroll = y;
  const hide = dy > 0 && y > 40;
  if (hide !== bar.hidden && bar.host) {
    bar.hidden = hide;
    bar.host.setAttribute("data-hidden", String(hide));
  }
}
let autoHideBound = false;
function enableAutoHide(): void {
  if (autoHideBound) return;
  autoHideBound = true;
  document.addEventListener("scroll", onScrollHide, AUTO_HIDE_OPTS);
}
function disableAutoHide(): void {
  if (!autoHideBound) return;
  autoHideBound = false;
  document.removeEventListener("scroll", onScrollHide, AUTO_HIDE_OPTS);
}

/**
 * Attach the singleton bar for one nav card (reference-counted — many card
 * instances, one bar). Builds the body-portal host on first attach, then applies
 * this card's config: offset, reserve, sidebar inset, auto-hide, tab-hiding, theme.
 * @param owner — the card instance keeping the bar alive
 * @param config — the nav card's config (tabs, offsets, theme, …)
 */
export function attach(owner: LitElement, config: NavConfig): void {
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
  setTabHiding(config.hide_ha_tabs as TabHideMode);
  applyTheme(config.theme);
  if (config.more_info) enableMoreInfo();
  else disableMoreInfo();
}

/**
 * Release one owner. On the last detach, tear the whole bar down — host, window
 * listeners, observers, and every injected side effect (tabs, theme, reserve) —
 * so a dashboard with no nav card is left untouched.
 * @param owner — the card instance releasing its hold on the bar
 */
export function detach(owner: LitElement): void {
  bar.owners.delete(owner);
  if (bar.owners.size === 0 && bar.host) {
    // Window listeners were added in buildBar; tear them down with the host so
    // nothing keeps firing against a removed bar.
    window.removeEventListener("orientationchange", onOrientationChange);
    window.removeEventListener("resize", measureBar);
    window.removeEventListener("resize", onResizeInset);
    window.removeEventListener("hashchange", renderBar);
    nav.listeners.delete(renderBar);
    stopNav();
    disableAutoHide();
    bar.host.remove();
    bar.host = null;
    bar.height = 0;
    // Reset the scroll bookkeeping and config too, so a re-attach doesn't inherit
    // a stale hidden/scroll state (the first hide-on-scroll would be swallowed).
    bar.hidden = false;
    bar.lastScroll = 0;
    bar.config = null;
    dragging = false;
    indReady = false; // the next buildBar re-snaps the pill to the active tab
    if (sidebarRO) {
      sidebarRO.disconnect();
      sidebarRO = null;
    }
    if (drawerMO) {
      drawerMO.disconnect();
      drawerMO = null;
    }
    if (barRO) {
      barRO.disconnect();
      barRO = null;
    }
    removeTabHiding();
    removeTheme();
    removeViewReserve();
    disableMoreInfo();
  }
}
