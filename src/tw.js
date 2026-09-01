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

// One keyboard-focus ring for every card (accent-coloured, so it reads on the
// dark and light palettes). Applied here rather than per-control so nothing that
// gains focus is left without a visible ring.
const FOCUS_RING =
  ":focus-visible{outline:2px solid var(--color-accent,#74B98A);outline-offset:2px}";

/** The shared utility sheet, ready to drop into a Lit card's `static styles`. */
export let twSheet;

if (supportsAdopt) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`${TW_CSS.replace(/:root/g, ":host")}\n${FOCUS_RING}`);

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
  twSheet = unsafeCSS(`${TW_CSS.replace(/:root/g, ":host")}\n${FOCUS_RING}`);
}
