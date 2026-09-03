/* ================================================================== *
 * ICON — <fib-icon>. Inlines a bundled Solar duotone SVG for `solar:…`, else
 * delegates to HA's <ha-icon> (mdi:/hass:/custom). The bundle ships only the core
 * set (icons referenced in src/); any other `solar:` name is fetched once from the
 * sibling icons.full.json and cached, then the pending glyphs re-render. No eager
 * network; the svg paints with currentColor, so the duotone secondary tints along
 * with the primary.
 * ================================================================== */
import { ICONS } from "../generated/icons.core.gen.js";

// Shown in place of a `solar:` name that isn't in the full set either (a typo or a
// non-duotone style). Always in core, so it resolves without the fetch.
const MISSING = "solar:question-circle-bold-duotone";
const warned = new Set(); // one console.warn per unmapped name, not per render

// The lazily-fetched full map (null until loaded; {} if the fetch failed).
let FULL = null;
let fullPromise = null;

// The bundle's own URL, captured while the IIFE runs synchronously (classic
// script). Null when HA loaded the resource as a module — the fallbacks cover it.
const SCRIPT_SRC =
  (typeof document !== "undefined" &&
    document.currentScript &&
    document.currentScript.src) ||
  "";

// Resolve icons.full.json next to fibbers.js. Prefer the captured script URL; else
// find the loaded bundle in the DOM; else the conventional HACS path.
function iconsUrl() {
  if (SCRIPT_SRC) return new URL("icons.full.json", SCRIPT_SRC).href;
  try {
    const el = [...document.querySelectorAll("script[src],link[href]")]
      .map((e) => e.src || e.href)
      .find((u) => /fibbers\.js(\?|$)/.test(u || ""));
    if (el) return new URL("icons.full.json", el).href;
  } catch (_) {
    /* fall through to the conventional path */
  }
  return "/hacsfiles/fibbers-home-assistant/icons.full.json";
}

function loadFull() {
  if (!fullPromise) {
    fullPromise = fetch(iconsUrl())
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((map) => {
        FULL = map || {};
        return FULL;
      });
  }
  return fullPromise;
}

/**
 * Build the inline `<svg>` string for a Solar icon `name` from the core or
 * lazily-fetched full map, painting with currentColor so the duotone tint tracks.
 * Returns null when the name isn't in either map — the caller decides the fallback.
 * @param {string} name
 * @returns {string|null} svg markup, or null
 */
export function iconSvg(name) {
  const ic = name && (ICONS[name] || (FULL && FULL[name]));
  if (!ic) return null;
  return `<svg viewBox="${ic.vb}" fill="currentColor" style="width:100%;height:100%;display:block" aria-hidden="true">${ic.body}</svg>`;
}

/**
 * <fib-icon> — renders a bundled Solar duotone SVG for a `solar:` name, else
 * delegates to HA's <ha-icon>. A plain custom element (no shadow root) so it
 * inherits colour/size from the light DOM.
 */
class FibIcon extends HTMLElement {
  /** Re-render whenever the `icon` attribute changes. */
  static get observedAttributes() {
    return ["icon"];
  }
  /** Lock in the flex/decorative styling, then paint. */
  connectedCallback() {
    this.style.display = "inline-flex";
    this.style.alignItems = "center";
    this.style.justifyContent = "center";
    this.style.pointerEvents = "none"; // decorative glyph — never its own hit target
    this._render();
  }
  /** Re-paint when `icon` changes — but only once connected (attrs can be set pre-mount). */
  attributeChangedCallback() {
    if (this.isConnected) this._render();
  }
  _render() {
    const name = this.getAttribute("icon") || "";
    const svg = iconSvg(name);
    if (svg) {
      this.innerHTML = svg;
      return;
    }
    if (name.startsWith("solar:")) {
      // Not in the core set. If the full set hasn't loaded yet, fetch it once and
      // re-render this glyph when it arrives (blank meanwhile — the box keeps its
      // reserved size, so nothing reflows).
      if (FULL === null) {
        this.innerHTML = "";
        loadFull().then(() => {
          if (this.isConnected) this._render();
        });
        return;
      }
      // Full set is loaded and it's still missing — a genuine miss. A `solar:` name
      // can never render via <ha-icon> (HA ships only MDI), so warn once and show a
      // visible placeholder instead of a silent blank.
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(
          `[fibbers] icon "${name}" is not in the Solar set, so it renders blank in ` +
            "Home Assistant. Use a `solar:<name>-bold-duotone` name, or an mdi: name.",
        );
      }
      this.innerHTML = iconSvg(MISSING) || "";
      return;
    }
    // fallback: HA renders it (mdi/hass/custom). Inherits sizing/colour.
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

if (!customElements.get("fib-icon")) customElements.define("fib-icon", FibIcon);
