/* ================================================================== *
 * ICON — <fib-icon>
 *
 * Renders a Solar duotone icon inline (from the bundled registry) when the
 * name is `solar:…`, or delegates to HA's own `ha-icon` for anything else
 * (`mdi:…`, `hass:…`, custom sets) so user configs keep working. No network:
 * the Solar bodies are inlined at build time by scripts/gen-icons.mjs.
 *
 * Sizing/colour come from the host card's CSS on the `fib-icon` selector
 * (width/height + `--mdc-icon-size`, which the fallback `ha-icon` inherits);
 * the inline svg fills the box and paints with `currentColor`, so the duotone
 * secondary (a path at opacity .5) tints along with the primary.
 * ================================================================== */
import { ICONS } from "./icons.gen.js";

export function iconSvg(name) {
  const ic = name && ICONS[name];
  if (!ic) return null;
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
    if (this.isConnected) this._render();
  }
  _render() {
    const name = this.getAttribute("icon") || "";
    const svg = iconSvg(name);
    if (svg) {
      this.innerHTML = svg;
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
