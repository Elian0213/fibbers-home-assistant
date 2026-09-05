/* ================================================================== *
 * TAILWIND — one shared adopted stylesheet for every shadow root.
 * Compiled src/tailwind.gen.js → one constructable sheet all cards adopt.
 * Tailwind v4's `@property` defaults don't reach shadow roots, so they're hoisted
 * to a document-level sheet; `:root` tokens are rewritten to `:host`.
 * ================================================================== */
import { unsafeCSS, type CSSResult } from "lit";

import { TW_CSS } from "../generated/tailwind.gen.js";

const supportsAdopt =
  "adoptedStyleSheets" in Document.prototype &&
  "replaceSync" in CSSStyleSheet.prototype;

// Baseline a11y CSS shared by every card: one accent focus ring (reads on the
// dark and light palettes) so nothing that gains focus is left without one, plus
// a prefers-reduced-motion reset so no card animates for a user who asked not to
// see motion (the nav bar and sheet honour it in their own stylesheets already).
// --fib-hit is the WCAG touch minimum in absolute px (rem would shrink it — HA's
// root font-size is 14px on some setups, making h-11/`2.75rem` only 38.5px). One
// knob: the .fib-hit expander and every slider/button min-size read from it.
//
// Touch polish for every control (previously nav-bar-only, in core/body-layer.js):
// kill the browser's tap-highlight overlay (inherited onto the SVG wheel, where it
// was drawing a rectangle around each sector's bounding box), suppress text
// selection / the iOS long-press callout on press-and-hold repeat controls, and
// opt buttons out of double-tap-zoom. `manipulation` deliberately EXCLUDES
// [role="slider"]: the slider wrappers set `touch-action:pan-y` (a class utility of
// equal specificity, and BASE_CSS is concatenated after the utilities — so listing
// slider here would win and re-break vertical page scrolling on the sliders).
const BASE_CSS = `:host{--fib-hit:44px;-webkit-tap-highlight-color:transparent}
:focus-visible{outline:2px solid var(--color-accent,#74B98A);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*,::before,::after{transition-duration:.01ms !important;animation-duration:.01ms !important}}
button,[role="button"],[role="tab"],[role="switch"],[role="slider"]{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
button,[role="button"],[role="tab"],[role="switch"]{touch-action:manipulation}
.fib-hit{position:relative}
.fib-hit::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:var(--fib-hit);min-height:var(--fib-hit);width:100%;height:100%}`;

// Build the shared sheet once at module load: a constructable CSSStyleSheet where
// supported (also hoisting @property rules to the document), else a Lit unsafeCSS
// result for very old engines.
function buildSheet(): CSSStyleSheet | CSSResult {
  const css = `${(TW_CSS as string).replace(/:root/g, ":host")}\n${BASE_CSS}`;
  if (!supportsAdopt) {
    // very old engine: fall back to an inline <style> string wrapped as a Lit result
    return unsafeCSS(css);
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);

  // hoist @property rules to the document so custom props register globally
  try {
    const doc = new CSSStyleSheet();
    let hoisted = 0;
    for (const rule of sheet.cssRules) {
      if (rule.constructor && rule.constructor.name === "CSSPropertyRule") {
        doc.insertRule(rule.cssText);
        hoisted++;
      }
    }
    if (hoisted)
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, doc];
  } catch (_e) {
    /* @property hoist is best-effort; utilities still mostly work without it */
  }

  return sheet;
}

/**
 * The shared utility + baseline-a11y stylesheet, ready to drop into a Lit card's
 * `static styles`. A constructable CSSStyleSheet where supported, else a Lit
 * `unsafeCSS` result for very old engines.
 */
export const twSheet: CSSStyleSheet | CSSResult = buildSheet();
