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

// The lazily-fetched full map: null until it loads. A failed fetch leaves it null
// (so a later miss retries) and sets `fullFailed` for an honest message; the fetch
// is paced so a genuinely-missing file isn't hammered on every re-render.
let FULL = null;
let fullPromise = null;
let fullFailed = false;
let fullFailAt = 0;
const RETRY_MS = 1500;

// HA loads a HACS plugin resource as a module (`import(url)`) — there is no
// document.currentScript and no <script> element to derive a base from, so the two
// dynamic branches this used to try were always dead. Use the conventional HACS
// path, overridable for a manual /local/ copy or a differently-named HACS dir.
function iconsUrl() {
  return (
    window.FIBBERS_ICONS_URL ||
    "/hacsfiles/fibbers-home-assistant/icons.full.json"
  );
}

// Fetch the full Solar set once and cache it. On failure (404, dropped connection,
// HA restarting mid-fetch) resolve to null and leave FULL null so the next miss can
// retry — never resolve to `{}`, which used to be indistinguishable from a real
// empty load and poisoned every non-core icon into a permanent question mark.
function loadFull() {
  if (FULL) return Promise.resolve(FULL);
  if (fullPromise) return fullPromise;
  if (Date.now() - fullFailAt < RETRY_MS) return Promise.resolve(null);
  fullPromise = fetch(iconsUrl())
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((map) => {
      FULL = map || {};
      fullFailed = false;
      fullPromise = null;
      return FULL;
    })
    .catch(() => {
      fullFailed = true;
      fullFailAt = Date.now();
      fullPromise = null;
      return null;
    });
  return fullPromise;
}

/**
 * Build the inline `<svg>` string for a Solar icon `name` from the core or
 * lazily-fetched full map, painting with currentColor so the duotone tint tracks.
 * Returns null when the name isn't in either map — the caller decides the fallback.
 * @param {string} name
 * @returns {string|null} svg markup, or null
 */
function iconSvg(name) {
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
      // Not in the core set — kick the (retry-paced) full-set load and re-render
      // this glyph if it actually arrives.
      if (FULL === null) {
        loadFull().then((map) => {
          if (map && this.isConnected) this._render();
        });
        // First attempt still pending, no prior failure → blank while loading; the
        // box keeps its reserved size, so nothing reflows.
        if (!fullFailed) {
          this.innerHTML = "";
          return;
        }
      }
      // Loaded-but-missing (a typo / non-duotone style), or the set failed to load.
      // Either way a `solar:` name can't render via <ha-icon> (HA ships only MDI),
      // so warn once — distinctly, so a valid name on a flaky network isn't blamed —
      // and show a visible placeholder instead of a silent blank.
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(
          fullFailed
            ? `[fibbers] couldn't load the Solar icon set from ${iconsUrl()}; "${name}" ` +
                "and other non-core icons show a placeholder. Set window.FIBBERS_ICONS_URL " +
                "if the file is elsewhere — mdi: names always work."
            : `[fibbers] icon "${name}" is not in the Solar set — use a ` +
                "`solar:<name>-bold-duotone` name, or an mdi: name.",
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
