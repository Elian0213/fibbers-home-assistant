/* ================================================================== *
 * BODY SHEET — the singleton modal sheet.
 * Rendered into document.body (position:fixed → viewport), one host shared by
 * every fibbers-sheet, reference-counted. The container CSS is load-bearing.
 * ================================================================== */
import { render, html } from "lit";

import { t } from "@shared/i18n";
import { T } from "@shared/tokens";
import { twSheet } from "@shared/tw";
import { capturePointer } from "@shared/util";

import { lockView } from "@core/view-reserve";
import type { HomeAssistant } from "@/types/home-assistant";
import "@shared/icon";

/** The config an open sheet/modal renders from. */
interface SheetConfig {
  title?: string;
  icon?: string;
  subtitle?: string;
  cards?: unknown[];
}

/** A card element the modal creates and pumps hass into. */
type ChildCard = HTMLElement & { hass?: HomeAssistant };

/**
 * A registered sheet card (fibbers-sheet) or the synthetic card an ad-hoc modal
 * builds. Both expose the config, current hass and their created child elements.
 */
export interface SheetCard {
  _config: SheetConfig;
  _hass?: HomeAssistant;
  _entityId?: string;
  _children: ChildCard[];
}

/** An in-flight drag of the sheet (touch drag-to-dismiss). */
interface Drag {
  startY: number;
  dy: number;
}

interface SheetLayer {
  host: HTMLElement | null;
  shadow: ShadowRoot | null;
  backdrop: HTMLElement | null;
  panel: HTMLElement | null;
  headEl: HTMLElement | null;
  bodyEl: HTMLElement | null;
  sheets: Map<string, SheetCard>;
  openId: string | null;
  modalCard: SheetCard | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
  drag: Drag | null;
  built: boolean;
  opener?: Element | null;
}

const layer: SheetLayer = {
  host: null,
  shadow: null,
  backdrop: null,
  panel: null,
  headEl: null,
  bodyEl: null,
  sheets: new Map<string, SheetCard>(),
  openId: null,
  modalCard: null, // the synthetic card for an ad-hoc openModal() (more-info)
  closeTimer: null,
  drag: null,
  built: false,
};

// Sentinel openId for an ad-hoc modal (more-info replacement) — never a real hash
// id, so the hash-clear on close and syncFromHash never mistake it for a sheet.
const MODAL_ID = " fib-modal";

const reduceMotion = (): boolean =>
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Deepest focused element across shadow roots, so focus can be returned to the
// exact control that opened the sheet — not just its outer shadow host.
function deepActiveElement(): Element | null {
  let el: Element | null = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement)
    el = el.shadowRoot.activeElement;
  return el;
}

// HA's own overlays (more-info on ha-dialog, newer ones on ha-md-dialog/md-dialog
// bottoming out in a native <dialog>, whose dialog role is implicit) render outside
// the sheet layer; the focus trap and Escape-to-close must not fight them.
function isDialogNode(n: EventTarget): boolean {
  const el = n as Element;
  const name = el.localName;
  return (
    name === "ha-dialog" ||
    name === "ha-md-dialog" ||
    name === "md-dialog" ||
    name === "dialog" ||
    (typeof el.getAttribute === "function" &&
      el.getAttribute("role") === "dialog")
  );
}

// The tail of a close, run after the exit transition (or synchronously on
// reduced-motion / last-unregister). Bails while a sheet is open, so a switch or a
// queued timer can't tear down the sheet that's now on screen.
function finishClose(): void {
  if (layer.openId != null) return;
  if (layer.host) {
    layer.host.removeAttribute("data-open");
    layer.host.removeAttribute("data-wide");
  }
  if (layer.bodyEl) layer.bodyEl.textContent = "";
  layer.modalCard = null;
  lockView(false);
  const { opener } = layer;
  layer.opener = null;
  if (opener && (opener as HTMLElement).focus) (opener as HTMLElement).focus();
}

/**
 * Close the open sheet — plays the exit, clears the hash, then (after the
 * transition, unless reduced-motion) runs finishClose to unlock the view and return
 * focus to the opener. finishClose is guarded so a switch/unregister can't run it
 * against the wrong sheet.
 */
export function closeSheet(): void {
  if (layer.openId == null) return;
  const id = layer.openId;
  layer.openId = null;
  if (layer.closeTimer) clearTimeout(layer.closeTimer);
  if (layer.host) layer.host.removeAttribute("data-shown");
  if (window.location.hash === `#${id}`) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
  if (reduceMotion()) finishClose();
  else layer.closeTimer = setTimeout(finishClose, 300);
}

// Focus trap: while the sheet is open, if focus escapes it (Tab past the last
// control), pull it back onto the dialog. composedPath() lets this work across the
// nested shadow roots of the child cards — but yields to an HA overlay on top.
function onFocusIn(e: FocusEvent): void {
  if (layer.openId == null || !layer.host || !layer.panel) return;
  const path = e.composedPath();
  if (path.includes(layer.host)) return;
  if (path.some(isDialogNode)) return;
  layer.panel.focus();
}

// Escape closes the sheet — unless an HA dialog is open on top of it (that dialog
// owns the Escape) or another handler already consumed the event. Our own panel is
// a role="dialog" that reveal() focuses, so every Escape originates *inside* it;
// only dialog nodes ABOVE layer.host (a real HA overlay stacked on top) may veto.
const onKeydown = (e: KeyboardEvent): void => {
  if (e.key !== "Escape" || e.defaultPrevented) return;
  const path = e.composedPath();
  const i = layer.host ? path.indexOf(layer.host) : -1;
  const above = i >= 0 ? path.slice(i + 1) : path;
  if (above.some(isDialogNode)) return;
  closeSheet();
};

// Reveal the built host by setting `data-shown` — SYNCHRONOUSLY. A forced reflow
// read gives the CSS transition its start frame without depending on
// requestAnimationFrame, which the browser does NOT run while the page is hidden
// (and drops the queued callbacks): a nested rAF here left `data-shown` unset, so a
// modal opened on a backgrounded tab became an invisible, full-viewport,
// pointer-events:auto layer that swallowed every tap and locked the dashboard.
function reveal(): void {
  if (!layer.host) return;
  // eslint-disable-next-line no-void -- the read is the load-bearing reflow flush
  void layer.host.offsetHeight; // flush the pre-transition style
  layer.host.setAttribute("data-shown", "true");
  if (layer.panel) layer.panel.focus(); // move focus onto the dialog
}

// Belt-and-braces: if anything still opened a sheet without painting (e.g. the tab
// was hidden when it opened), reveal it the moment the page is visible again.
function onVisibility(): void {
  if (document.visibilityState !== "visible") return;
  if (
    layer.openId != null &&
    layer.host &&
    !layer.host.getAttribute("data-shown")
  )
    reveal();
}

/* container CSS — load-bearing (self-contained font; crisp margin-auto centring
   with no will-change so it never rasterises blurry on fractional DPR). */
const SHEET_CSS = `
  :host {
    position: fixed; inset: 0; z-index: 9; display: none;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: ${T.ink};
    -webkit-font-smoothing: antialiased;
  }
  :host([data-open="true"]) { display: block; }

  .backdrop {
    position: absolute; inset: 0;
    background: rgba(6, 9, 10, .72);
    -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
    opacity: 0; transition: opacity .24s ease;
  }
  :host([data-shown="true"]) .backdrop { opacity: 1; }

  .sheet {
    position: absolute; left: 0; right: 0; bottom: 0;
    max-height: 88vh; display: flex; flex-direction: column;
    background: ${T.sheet};
    border-top: 1px solid ${T.line};
    border-radius: 24px 24px 0 0;
    padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    transform: translateY(100%);
    transition: transform .28s cubic-bezier(.22, 1, .36, 1);
  }
  :host([data-shown="true"]) .sheet { transform: translateY(0); }
  @media (prefers-reduced-motion: reduce) { .backdrop, .sheet { transition: none; } }

  .grab {
    width: 34px; height: 4px; border-radius: 2px;
    background: ${T.grab};
    margin: 4px auto 10px; flex: 0 0 auto;
    touch-action: none; cursor: grab;
  }
  .head {
    display: flex; align-items: center; gap: 10px;
    padding: 0 2px 12px; flex: 0 0 auto; touch-action: none;
  }
  .body {
    flex: 1 1 auto; overflow-y: auto; -webkit-overflow-scrolling: touch;
    display: flex; flex-direction: column; gap: 10px; padding-bottom: 6px;
  }

  @media (min-width: 640px) {
    .sheet {
      inset: 0; margin: auto; height: fit-content; max-height: 88vh;
      width: min(460px, calc(100vw - 32px));
      border-radius: 24px; border: 1px solid ${T.line};
      opacity: 0; transform: translateY(8px);
      transition: opacity .2s ease, transform .2s ease;
    }
    /* A modal that opts into wide (the room light picker) gets more room on
       desktop so its content can lay out in two columns. */
    :host([data-wide]) .sheet { width: min(760px, calc(100vw - 32px)); }
    :host([data-shown="true"]) .sheet { transform: translateY(0); opacity: 1; }
  }
`;
const sheetSheet = new CSSStyleSheet();
sheetSheet.replaceSync(SHEET_CSS);

function bindDrag(handle: HTMLElement, sheet: HTMLElement): void {
  const el = sheet;
  handle.addEventListener("pointerdown", (e) => {
    if (window.innerWidth >= 640) return;
    capturePointer(handle, e.pointerId);
    layer.drag = { startY: e.clientY, dy: 0 };
    el.style.transition = "none";
  });
  handle.addEventListener("pointermove", (e) => {
    if (!layer.drag) return;
    const dy = Math.max(0, e.clientY - layer.drag.startY);
    layer.drag.dy = dy;
    el.style.transform = `translateY(${dy}px)`;
    if (layer.backdrop)
      layer.backdrop.style.opacity = String(Math.max(0, 1 - dy / 400));
  });
  const end = (): void => {
    if (!layer.drag) return;
    const { dy } = layer.drag;
    layer.drag = null;
    el.style.transition = "";
    el.style.transform = "";
    if (layer.backdrop) layer.backdrop.style.opacity = "";
    if (dy > 80) closeSheet();
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

function build(): void {
  if (layer.built) return;
  const host = document.createElement("div");
  host.id = "fibbers-sheet";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.adoptedStyleSheets = [twSheet as CSSStyleSheet, sheetSheet];

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("tabindex", "-1"); // focusable so focus can move onto the dialog
  const grab = document.createElement("div");
  grab.className = "grab";
  const head = document.createElement("div");
  head.className = "head";
  const body = document.createElement("div");
  body.className = "body";

  sheet.append(grab, head, body);
  shadow.append(backdrop, sheet);
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

async function renderContent(card: SheetCard): Promise<void> {
  const c0 = card;
  const cfg = c0._config;
  if (layer.panel)
    layer.panel.setAttribute("aria-label", cfg.title || "Dialog");
  render(
    html`
      ${
        cfg.icon
          ? html`<fib-icon
              class="h-5 w-5 flex-none [--mdc-icon-size:20px] text-accent"
              icon=${cfg.icon}
            ></fib-icon>`
          : ""
      }
      <div class="min-w-0 flex-1">
        <div class="text-[16px] font-semibold tracking-[-0.015em] text-ink">
          ${cfg.title || ""}
        </div>
        ${
          cfg.subtitle
            ? html`<div class="mt-0.5 text-[11px] text-muted">
                ${cfg.subtitle}
              </div>`
            : ""
        }
      </div>
      <button
        type="button"
        aria-label=${t(c0._hass, "sheet.close")}
        class="fib-hit flex h-[30px] w-[30px] flex-none cursor-pointer items-center justify-center
               rounded-full border-0 bg-card2 text-[15px] leading-none text-ink2"
        @click=${() => closeSheet()}
      >
        ✕
      </button>
    `,
    layer.headEl!,
  );

  const body = layer.bodyEl!;
  body.textContent = "";
  c0._children = [];
  const configs = Array.isArray(cfg.cards) ? cfg.cards : [];
  if (!configs.length) return;
  try {
    // The hash can change to another sheet while loadCardHelpers() is in flight;
    // `layer.bodyEl` is shared, so bail if this open was superseded rather than
    // appending #a's cards into #b's body (and leaking detached #a children).
    const gen = layer.openId;
    const helpers = await (
      window as unknown as {
        loadCardHelpers: () => Promise<{
          createCardElement: (c: unknown) => ChildCard;
        }>;
      }
    ).loadCardHelpers();
    if (layer.openId !== gen) return;
    for (const c of configs) {
      const el = helpers.createCardElement(c);
      if (c0._hass) el.hass = c0._hass;
      c0._children.push(el);
      body.appendChild(el);
    }
  } catch (_) {
    const msg = document.createElement("div");
    msg.className = "px-2 py-2 text-[12px] text-muted";
    msg.textContent = t(c0._hass, "sheet.load_error");
    body.appendChild(msg);
  }
}

/**
 * Open the registered sheet `id` — builds the host on first use, locks the view,
 * renders the child cards, then reveals it synchronously. No-op if the id is
 * unknown or already open.
 * @param id — the sheet's hash id
 */
export function openSheet(id: string): void {
  const card = layer.sheets.get(id);
  if (!card || layer.openId === id) return;
  // Switching from another sheet: close it first rather than stacking #b over #a.
  if (layer.openId != null) closeSheet();
  // Capture the trigger so focus can return on close — but not the sheet's own
  // panel when switching (focus is already inside the layer then), which would
  // leave a later close focusing a display:none element.
  const active = deepActiveElement();
  if (!layer.shadow || !layer.shadow.contains(active)) layer.opener = active;
  build();
  layer.openId = id;
  layer.host!.setAttribute("data-open", "true");
  lockView(true);
  renderContent(card);
  reveal();
}

function syncFromHash(): void {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash && layer.sheets.has(hash)) openSheet(hash);
  else if (layer.openId != null) closeSheet();
}

// Registered from the first registerSheet and removed after the last, so they
// don't run on every HA page (Settings, Developer Tools) when no sheet exists.
let listenersOn = false;
function ensureListeners(): void {
  if (listenersOn) return;
  listenersOn = true;
  window.addEventListener("hashchange", syncFromHash);
  window.addEventListener("focusin", onFocusIn);
  window.addEventListener("keydown", onKeydown);
  document.addEventListener("visibilitychange", onVisibility);
}
function removeSheetListeners(): void {
  if (!listenersOn) return;
  listenersOn = false;
  window.removeEventListener("hashchange", syncFromHash);
  window.removeEventListener("focusin", onFocusIn);
  window.removeEventListener("keydown", onKeydown);
  document.removeEventListener("visibilitychange", onVisibility);
}

/** The spec an ad-hoc modal (more-info replacement) opens with. */
export interface ModalSpec {
  title?: string | false;
  icon?: string;
  subtitle?: string;
  cards: unknown[];
  hass?: HomeAssistant;
  entityId?: string;
  wide?: boolean | null;
}

/**
 * Open an ad-hoc modal with content built on the fly (not a registered sheet) —
 * the Fibbers replacement for HA's more-info dialog. Reuses the sheet chrome,
 * animation, focus-trap and drag-to-dismiss.
 * @param spec — `{ title, icon?, subtitle?, cards, hass, entityId?, wide? }`
 */
export function openModal({
  title,
  icon,
  subtitle,
  cards,
  hass,
  entityId,
  wide,
}: ModalSpec): void {
  ensureListeners();
  build();
  if (layer.openId != null) closeSheet();
  const active = deepActiveElement();
  if (!layer.shadow || !layer.shadow.contains(active)) layer.opener = active;
  const card: SheetCard = {
    _config: { title: title || undefined, icon, subtitle, cards },
    _hass: hass,
    _entityId: entityId,
    _children: [],
  };
  layer.modalCard = card;
  layer.openId = MODAL_ID;
  layer.host!.setAttribute("data-open", "true");
  // Opt into the wider desktop dialog (two-column content); cleared on close.
  if (wide) layer.host!.setAttribute("data-wide", "true");
  else layer.host!.removeAttribute("data-wide");
  lockView(true);
  renderContent(card);
  reveal();
}

/** The entity id an ad-hoc modal is currently showing, or null. */
export function openModalEntity(): string | null {
  return layer.openId === MODAL_ID && layer.modalCard
    ? (layer.modalCard._entityId ?? null)
    : null;
}

/**
 * Push a fresh hass onto an open ad-hoc modal's child cards so they stay live.
 * @param hass — the current Home Assistant state object
 */
export function updateOpenModalHass(hass: HomeAssistant): void {
  if (layer.openId !== MODAL_ID || !layer.modalCard) return;
  layer.modalCard._hass = hass;
  (layer.modalCard._children || []).forEach((el) => {
    const node = el;
    node.hass = hass;
  });
}

/** Close the ad-hoc modal if one is open (no-op otherwise). */
export function closeModal(): void {
  if (layer.openId === MODAL_ID) closeSheet();
}

/**
 * Tear the shared host + listeners down if nothing needs them (no registered
 * sheets, nothing open) — called when the more-info feature disables and no
 * fibbers-sheet is keeping the host alive.
 */
export function teardownIfIdle(): void {
  if (layer.sheets.size !== 0 || layer.openId != null || !layer.host) return;
  if (layer.closeTimer) clearTimeout(layer.closeTimer);
  finishClose();
  layer.host.remove();
  layer.built = false;
  layer.host = null;
  layer.shadow = null;
  layer.backdrop = null;
  layer.panel = null;
  layer.headEl = null;
  layer.bodyEl = null;
  removeSheetListeners();
}

/**
 * Register a fibbers-sheet card under `id` (reference-counts the shared host) and
 * open it immediately if the URL already points at it (deep-link / reload).
 * @param id — the sheet's hash id
 * @param card — the sheet card supplying config + hass
 */
export function registerSheet(id: string, card: SheetCard): void {
  ensureListeners();
  build();
  layer.sheets.set(id, card);
  if (window.location.hash === `#${id}`) openSheet(id);
}

/**
 * Unregister a sheet card. Closes it if open; on the last unregister, cancels any
 * queued close and tears the shared host + listeners down so nothing leaks onto
 * the next page. Guarded by identity so a stale card can't drop a live one.
 * @param id — the sheet's hash id
 * @param card — the card being unregistered
 */
export function unregisterSheet(id: string, card: SheetCard): void {
  if (layer.sheets.get(id) === card) layer.sheets.delete(id);
  if (layer.openId === id) closeSheet();
  if (layer.sheets.size === 0 && layer.host) {
    // The queued close (if any) is cancelled — run its tail now so focus still
    // returns to the opener before the host goes away — then null every ref.
    if (layer.closeTimer) clearTimeout(layer.closeTimer);
    finishClose();
    layer.host.remove();
    layer.built = false;
    layer.host = null;
    layer.shadow = null;
    layer.backdrop = null;
    layer.panel = null;
    layer.headEl = null;
    layer.bodyEl = null;
    removeSheetListeners();
  }
}

/**
 * Push a fresh hass onto the open sheet's live child cards so they stay reactive
 * while open. No-op unless `id` is the currently open sheet.
 * @param id — the sheet's hash id
 * @param hass — Home Assistant state object
 */
export function updateSheetHass(id: string, hass: HomeAssistant): void {
  if (layer.openId !== id) return;
  const card = layer.sheets.get(id);
  if (card && card._children)
    card._children.forEach((el) => {
      const node = el;
      node.hass = hass;
    });
}
