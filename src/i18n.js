/* ================================================================== *
 * i18n — the tiny string layer. English is the default; everything else
 * (currently Dutch) is a translation. `t(hl, key, vars)` resolves the language
 * from a hass object (or a bare language string, so a per-card `language:`
 * override can be passed straight through), interpolates `{vars}`, and picks a
 * `<key>_one` sibling when `vars.count === 1`. It never returns the raw key —
 * a missing translation falls back to English.
 * ================================================================== */
import en from "./translations/en.json";
import nl from "./translations/nl.json";

const CATALOGS = { en, nl };

// hass | "de-CH" | undefined → a catalog. Tries the exact tag, then the base
// language (`de-CH` → `de`), then English.
function catalog(lang) {
  const l = String(lang || "en").toLowerCase();
  return CATALOGS[l] || CATALOGS[l.split("-")[0]] || en;
}

// Accepts a hass object, a language string, or a per-card override string.
export function langOf(hl) {
  if (!hl) return "en";
  if (typeof hl === "string") return hl;
  return (hl.locale && hl.locale.language) || hl.language || "en";
}

// Walk a dotted key ("weather.conditions.sunny") into a catalog.
function pick(cat, key) {
  return key.split(".").reduce((o, k) => (o == null ? o : o[k]), cat);
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) =>
    vars[k] != null ? String(vars[k]) : m,
  );
}

export function t(hl, key, vars) {
  const cat = catalog(langOf(hl));
  const plural = vars && Number(vars.count) === 1 ? `${key}_one` : null;
  let str = (plural && pick(cat, plural)) ?? pick(cat, key);
  if (str == null) str = (plural && pick(en, plural)) ?? pick(en, key);
  if (str == null) str = key; // only a mistyped key reaches here — a debugging aid, never a normal path
  return interpolate(str, vars);
}
