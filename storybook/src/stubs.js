/* HA-provided globals the cards assume, stubbed for Storybook (no Home Assistant),
 * then the real shipped bundle is loaded so every fibbers-* element registers and
 * the global CSS injector runs — the stories demo exactly what users install. */

(function () {
  class HaIconStub extends HTMLElement {
    static get observedAttributes() {
      return ["icon"];
    }
    connectedCallback() {
      this._render();
    }
    attributeChangedCallback() {
      this._render();
    }
    _render() {
      // fib-icon renders Solar SVGs inline; ha-icon is only the mdi:/hass: fallback.
      this.textContent = "●";
      this.style.cssText =
        "display:inline-flex;align-items:center;justify-content:center;line-height:1";
      requestAnimationFrame(() => {
        this.style.fontSize = Math.round((this.clientWidth || 16) * 0.9) + "px";
      });
    }
  }
  if (!customElements.get("ha-icon"))
    customElements.define("ha-icon", HaIconStub);
})();

window.loadCardHelpers =
  window.loadCardHelpers ||
  (async () => ({
    createCardElement: (cfg) => {
      const tag = ((cfg && cfg.type) || "").replace(/^custom:/, "");
      if (tag.startsWith("fibbers-") && customElements.get(tag)) {
        const el = document.createElement(tag);
        try {
          el.setConfig(cfg);
        } catch (e) {
          el.textContent = "config error: " + e.message;
        }
        return el;
      }
      const el = document.createElement("div");
      el.style.cssText =
        "color:#7d8b8e;font:12px ui-monospace,Menlo,monospace;padding:8px";
      el.textContent = "[stub card: " + ((cfg && cfg.type) || "") + "]";
      return el;
    },
  }));

// the real plugin — registers fibbers-* + fib-icon and injects the global theme
import "../../dist/fibbers.js";
