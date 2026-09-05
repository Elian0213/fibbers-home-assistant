/* ================================================================== *
 * i18n — the tiny string layer. English is the default; everything else
 * (currently Dutch) is a translation. `t(hl, key, vars)` resolves the language
 * from a hass object (or a bare language string, so a per-card `language:`
 * override can be passed straight through), interpolates `{vars}`, and picks a
 * `<key>_one` sibling when `vars.count === 1`. It never returns the raw key —
 * a missing translation falls back to English.
 * ================================================================== */
import en from "../translations/en.json";
import nl from "../translations/nl.json";

/** A translation catalog: an arbitrarily nested map of dotted keys to strings. */
interface Catalog {
  [key: string]: string | Catalog;
}

/** Interpolation values; `count` drives pluralisation. */
type Vars = Record<string, unknown>;

const CATALOGS: Record<string, Catalog> = { en, nl };

// hass | "de-CH" | undefined → a catalog. Tries the exact tag, then the base
// language (`de-CH` → `de`), then English.
function catalog(lang: string): Catalog {
  const l = String(lang || "en").toLowerCase();
  return CATALOGS[l] || CATALOGS[l.split("-")[0]] || en;
}

/**
 * Resolve a language tag from a hass object, a bare language string, or a per-card
 * override string — so callers can pass `hass` or a raw `language:` straight in.
 * @param hl
 * @returns language tag, or "en"
 */
export function langOf(hl: unknown): string {
  if (!hl) return "en";
  if (typeof hl === "string") return hl;
  const o = hl as { locale?: { language?: string }; language?: string };
  return (o.locale && o.locale.language) || o.language || "en";
}

// Walk a dotted key ("weather.conditions.sunny") into a catalog.
function pick(cat: Catalog, key: string): string | Catalog | undefined {
  return key
    .split(".")
    .reduce<string | Catalog | undefined>(
      (o, k) => (o == null || typeof o === "string" ? undefined : o[k]),
      cat,
    );
}

function interpolate(str: string, vars?: Vars): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k: string) =>
    vars[k] != null ? String(vars[k]) : m,
  );
}

/**
 * Resolve a dotted `key` against the caller's language, interpolate `{vars}`, and
 * pick a `<key>_one` sibling when `vars.count === 1`. Never returns the raw key on
 * a real path — a missing translation falls back to English.
 * @param hl — hass, a language string, or a per-card override
 * @param key — dotted catalog key
 * @param vars — interpolation values; `count` drives pluralisation
 */
export function t(hl: unknown, key: string, vars?: Vars): string {
  const cat = catalog(langOf(hl));
  const plural = vars && Number(vars.count) === 1 ? `${key}_one` : null;
  let str = (plural && pick(cat, plural)) ?? pick(cat, key);
  if (str == null) str = (plural && pick(en, plural)) ?? pick(en, key);
  if (str == null) str = key; // only a mistyped key reaches here — a debugging aid, never a normal path
  return interpolate(str as string, vars);
}
