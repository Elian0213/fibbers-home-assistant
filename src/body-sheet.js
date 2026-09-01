/* ================================================================== *
 * BODY SHEET — the singleton modal sheet.
 * Rendered into document.body (position:fixed → viewport), one host shared by
 * every fibbers-sheet, reference-counted. The container CSS is load-bearing.
 * ================================================================== */
import { render, html } from "lit";

import { T } from "./tokens.js";
import { twSheet } from "./tw.js";
import "./icon.js";

const layer = {
  host: null,
  shadow: null,
  backdrop: null,
  panel: null,
  headEl: null,
  bodyEl: null,
  sheets: new Map(),
  openId: null,
  savedScrollY: 0,
  drag: null,
  built: false,
};

const reduceMotion = () =>
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    :host([data-shown="true"]) .sheet { transform: translateY(0); opacity: 1; }
  }
`;
const sheetSheet = new CSSStyleSheet();
sheetSheet.replaceSync(SHEET_CSS);

function build() {
  if (layer.built) return;
  const host = document.createElement("div");
  host.id = "fibbers-sheet";
  const shadow = host.attachShadow({ mode: "open" });
  shadow.adoptedStyleSheets = [twSheet, sheetSheet];

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

function bindDrag(handle, sheet) {
  handle.addEventListener("pointerdown", (e) => {
    if (window.innerWidth >= 640) return;
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
        aria-label="Sluiten"
        class="flex h-[30px] w-[30px] flex-none cursor-pointer items-center justify-center
               rounded-full border-0 bg-card2 text-[15px] leading-none text-ink2"
        @click=${() => closeSheet()}
      >
        ✕
      </button>
    `,
    layer.headEl,
  );

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
    msg.className = "px-2 py-2 text-[12px] text-muted";
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
  requestAnimationFrame(() =>
    requestAnimationFrame(() => layer.host.setAttribute("data-shown", "true")),
  );
}

export function closeSheet() {
  if (layer.openId == null) return;
  const id = layer.openId;
  layer.openId = null;
  if (layer.host) layer.host.removeAttribute("data-shown");
  if (window.location.hash === `#${id}`) {
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  }
  const finish = () => {
    if (layer.openId != null) return;
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
  if (window.location.hash === `#${id}`) openSheet(id);
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
