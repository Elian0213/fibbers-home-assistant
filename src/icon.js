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

// Shown in place of a `solar:` name we didn't bundle (see _render). Kept as a
// baked name so it always resolves.
const MISSING = "solar:question-circle-bold-duotone";
const warned = new Set(); // one console.warn per unmapped name, not per render

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
    // A `solar:` name we didn't bundle can never render via <ha-icon> — HA ships
    // only MDI natively, so it would be a silent blank. Warn once and show a
    // visible placeholder instead of handing it off. The full Solar bold-duotone
    // style is bundled, so a miss here means a non-duotone style or a typo.
    if (name.startsWith("solar:")) {
      if (!warned.has(name)) {
        warned.add(name);
        console.warn(
          `[fibbers] icon "${name}" is not bundled, so it renders blank in Home ` +
            "Assistant. Only the Solar bold-duotone style ships — use a " +
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
