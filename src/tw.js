/* ================================================================== *
 * TAILWIND — one shared adopted stylesheet for every shadow root.
 * Compiled src/tailwind.gen.js → one constructable sheet all cards adopt.
 * Tailwind v4's `@property` defaults don't reach shadow roots, so they're hoisted
 * to a document-level sheet; `:root` tokens are rewritten to `:host`.
 * ================================================================== */
import { unsafeCSS } from "lit";

import { TW_CSS } from "./tailwind.gen.js";

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
const BASE_CSS = `:host{--fib-hit:44px}
:focus-visible{outline:2px solid var(--color-accent,#74B98A);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*,::before,::after{transition-duration:.01ms !important;animation-duration:.01ms !important}}
.fib-hit{position:relative}
.fib-hit::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);min-width:var(--fib-hit);min-height:var(--fib-hit);width:100%;height:100%}`;

/** The shared utility sheet, ready to drop into a Lit card's `static styles`. */
export let twSheet;

if (supportsAdopt) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`${TW_CSS.replace(/:root/g, ":host")}\n${BASE_CSS}`);

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

  twSheet = sheet;
} else {
  // very old engine: fall back to an inline <style> string wrapped as a Lit result
  twSheet = unsafeCSS(`${TW_CSS.replace(/:root/g, ":host")}\n${BASE_CSS}`);
}
