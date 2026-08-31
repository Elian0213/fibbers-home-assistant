/* ================================================================== *
 * TAILWIND — one shared adopted stylesheet for every shadow root
 *
 * The compiled Tailwind CSS (src/tailwind.gen.js) is turned into ONE
 * constructable stylesheet that every card adopts (Lit dedupes the shared
 * object, so it costs one sheet regardless of how many cards mount).
 *
 * Tailwind v4 declares custom-property defaults with `@property`, which shadow
 * roots ignore — so utilities that lean on them (box-shadow, gradients, …)
 * would break inside a card. Fix: hoist every `@property` rule into a
 * document-level sheet, where registration is global and reaches shadow trees.
 * Theme tokens emitted on `:root` are rewritten to `:host` so they resolve
 * inside each shadow root.
 * ================================================================== */
import { unsafeCSS } from "lit";
import { TW_CSS } from "./tailwind.gen.js";

const supportsAdopt =
  "adoptedStyleSheets" in Document.prototype &&
  "replaceSync" in CSSStyleSheet.prototype;

/** The shared utility sheet, ready to drop into a Lit card's `static styles`. */
export let twSheet;

if (supportsAdopt) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(TW_CSS.replace(/:root/g, ":host"));

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
  twSheet = unsafeCSS(TW_CSS.replace(/:root/g, ":host"));
}
