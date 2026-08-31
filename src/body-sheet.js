/* ================================================================== *
 * BODY SHEET — the singleton modal layer
 *
 * A bottom sheet rendered into document.body (so `position: fixed` pins to the
 * viewport, same reason as the nav bar). One host is shared by every
 * fibbers-sheet card on the page and reference-counted: created when the first
 * sheet card mounts, removed when the last unmounts. Only one sheet is open at a
 * time, keyed off the URL hash (`#<id>`).
 * ================================================================== */
import { styleBlock } from "./tokens.js";

const layer = {
  host: null,
  shadow: null,
  backdrop: null,
  panel: null,
  headEl: null,
  bodyEl: null,
  sheets: new Map(), // id -> card element (owns config + hass)
  openId: null,
  savedScrollY: 0,
  drag: null,
  built: false,
};

const reduceMotion = () =>
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const SHEET_CSS = `
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
  if (layer.built) return;
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

/* drag-down-to-dismiss on a given handle, moving the sheet panel */
function bindDrag(handle, sheet) {
  handle.addEventListener("pointerdown", (e) => {
    if (window.innerWidth >= 640) return; // dialog mode: no drag
    layer.drag = { startY: e.clientY, dy: 0 };
    sheet.style.transition = "none";
    handle.setPointerCapture && handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!layer.drag) return;
    const dy = Math.max(0, e.clientY - layer.drag.startY);
    layer.drag.dy = dy;
    sheet.style.transform = `translateY(${dy}px)`;
    if (layer.backdrop)
      layer.backdrop.style.opacity = String(Math.max(0, 1 - dy / 400));
  });
  const end = () => {
    if (!layer.drag) return;
    const dy = layer.drag.dy;
    layer.drag = null;
    sheet.style.transition = "";
    sheet.style.transform = "";
    if (layer.backdrop) layer.backdrop.style.opacity = "";
    if (dy > 80) closeSheet();
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
  if (!configs.length) return;
  try {
    const helpers = await window.loadCardHelpers();
    for (const c of configs) {
      const el = helpers.createCardElement(c);
      if (card._hass) el.hass = card._hass;
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

export function openSheet(id) {
  const card = layer.sheets.get(id);
  if (!card || layer.openId === id) return;
  build();
  layer.openId = id;
  layer.host.setAttribute("data-open", "true");
  lockScroll();
  renderContent(card);
  // next frame so the transition runs from the hidden state
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      layer.host.setAttribute("data-shown", reduceMotion() ? "true" : "true"),
    ),
  );
}

export function closeSheet() {
  if (layer.openId == null) return;
  const id = layer.openId;
  layer.openId = null;
  if (layer.host) layer.host.removeAttribute("data-shown");
  // strip the hash so it does not immediately reopen, without a history entry
  if (window.location.hash === "#" + id) {
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
  const finish = () => {
    if (layer.openId != null) return; // reopened meanwhile
    if (layer.host) layer.host.removeAttribute("data-open");
    if (layer.bodyEl) layer.bodyEl.textContent = "";
    unlockScroll();
  };
  if (reduceMotion()) finish();
  else setTimeout(finish, 300);
}

function syncFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  if (hash && layer.sheets.has(hash)) openSheet(hash);
  else if (layer.openId != null) closeSheet();
}

export function registerSheet(id, card) {
  build();
  layer.sheets.set(id, card);
  if (window.location.hash === "#" + id) openSheet(id);
}

export function unregisterSheet(id, card) {
  if (layer.sheets.get(id) === card) layer.sheets.delete(id);
  if (layer.openId === id) closeSheet();
  if (layer.sheets.size === 0 && layer.host) {
    layer.host.remove();
    layer.built = false;
    layer.host = null;
  }
}

/** Push fresh hass into the open sheet's child cards. */
export function updateSheetHass(id, hass) {
  if (layer.openId !== id) return;
  const card = layer.sheets.get(id);
  if (card && card._children)
    card._children.forEach((el) => {
      el.hass = hass;
    });
}

window.addEventListener("hashchange", syncFromHash);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSheet();
});
