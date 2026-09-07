/* ================================================================== *
 * RADIO-LOGO — best-effort station logos from the radio-browser directory
 * (https://www.radio-browser.info), a free community API. Resolution is
 * asynchronous and cached; the caller shows a fallback icon until (and unless) a
 * logo resolves. Everything degrades to the icon on a blocked/failed request, so
 * it never breaks the sheet — HA frontends with a strict CSP simply see icons.
 * ================================================================== */

// station string → resolved https logo URL, or null once we know there is none.
const cache = new Map<string, string | null>();
const inflight = new Set<string>();
const STORE_PREFIX = "fibbers:radiologo:";
// all.api round-robins across the directory's mirrors.
const API = "https://all.api.radio-browser.info/json/stations/search";

/** One station search result — only the favicon is read. */
interface RbStation {
  favicon?: string;
}

// The dashboard labels stations like "NL · NPO Radio 1" / "IE · SPIN 1038":
// a country code, a middot, then the name. Split into { cc, name }; a string
// without the prefix searches by name alone.
function parseStation(station: string): { cc: string; name: string } {
  const parts = String(station || "").split("·");
  if (parts.length >= 2)
    return {
      cc: parts[0].trim().toUpperCase(),
      name: parts.slice(1).join("·").trim(),
    };
  return { cc: "", name: String(station || "").trim() };
}

function readStore(station: string): string | null | undefined {
  try {
    const raw = sessionStorage.getItem(STORE_PREFIX + station);
    if (raw == null) return undefined; // not resolved yet
    return raw === "" ? null : raw; // "" = resolved, no logo
  } catch (_) {
    return undefined;
  }
}

function writeStore(station: string, url: string | null): void {
  try {
    sessionStorage.setItem(STORE_PREFIX + station, url || "");
  } catch (_) {
    /* private mode / quota — in-memory cache still applies this session */
  }
}

function resolve(
  station: string,
  url: string | null,
  onResolved: () => void,
): void {
  cache.set(station, url);
  writeStore(station, url);
  inflight.delete(station);
  onResolved();
}

// A favicon we can put in an <img>: an absolute http(s) URL that isn't the
// directory's literal "null"/"undefined" placeholder.
const usableFavicon = (f: unknown): f is string =>
  typeof f === "string" &&
  /^https?:\/\//i.test(f) &&
  !/\/(null|undefined)$/i.test(f);

// Wikimedia/Wikipedia thumbnails commonly 403 on hotlink (and are huge), so a
// station's own apple-touch-icon/favicon is preferred over one.
const isFlakyHost = (u: string): boolean =>
  /(?:^|\/\/|\.)(?:wikimedia|wikipedia)\.org\//i.test(u);

// Pick a logo from a result list. The most-voted station's favicon is often empty
// or http, so we scan the whole list and rank: a native https favicon on a
// reliable host first, then an http one upgraded to https (the same host usually
// serves both), with flaky hosts kept as a last resort. The <img> falls back to
// the icon if the chosen URL still doesn't render.
function pickFavicon(list: RbStation[]): string | null {
  const usable = list
    .map((s) => s.favicon)
    .filter(usableFavicon)
    .map((f) => f.replace(/^http:\/\//i, "https://"));
  // Keep the directory's vote order (most-voted first), but sink flaky hosts to
  // the back — a stable sort leaves the rest in place.
  usable.sort((a, b) => (isFlakyHost(a) ? 1 : 0) - (isFlakyHost(b) ? 1 : 0));
  return usable[0] ?? null;
}

// A looser search term for a retry when the exact name found nothing — the
// directory often stores a frequency as "103.8", so an option labelled
// "SPIN 1038" needs its digits dropped to match "Spin 103.8".
function simplifyName(name: string): string {
  return name
    .replace(/\b\d+([.,]\d+)?\s*(fm|am)?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const searchUrl = (name: string, cc: string): string =>
  `${API}?limit=10&order=votes&reverse=true&hidebroken=true&name=${encodeURIComponent(name)}${cc ? `&countrycode=${encodeURIComponent(cc)}` : ""}`;

const fetchJson = (url: string): Promise<RbStation[]> =>
  fetch(url, { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? (r.json() as Promise<RbStation[]>) : []))
    .then((l) => (Array.isArray(l) ? l : []))
    .catch(() => []);

// Look a station up, then retry once with a simplified name if nothing usable
// came back. Returns a logo URL or null.
async function lookup(name: string, cc: string): Promise<string | null> {
  let pick = pickFavicon(await fetchJson(searchUrl(name, cc)));
  if (!pick) {
    const simple = simplifyName(name);
    if (simple.length >= 3 && simple !== name)
      pick = pickFavicon(await fetchJson(searchUrl(simple, cc)));
  }
  return pick;
}

/**
 * The logo URL for a radio-station option, or null while it resolves / when the
 * directory has no logo for it. Kicks off (and dedupes) one background lookup per
 * station; `onResolved` fires once the answer lands so the caller can re-render.
 * Favicons are normalised to https, so an https dashboard never hits a
 * mixed-content block.
 * @param station — the option string, e.g. "IE · SPIN 1038"
 * @param onResolved — called after the async lookup settles
 */
export function radioLogo(
  station: string,
  onResolved: () => void,
): string | null {
  if (!station) return null;
  if (cache.has(station)) return cache.get(station) as string | null;
  const stored = readStore(station);
  if (stored !== undefined) {
    cache.set(station, stored);
    return stored;
  }
  if (!inflight.has(station)) {
    inflight.add(station);
    const { cc, name } = parseStation(station);
    lookup(name, cc)
      .then((url) => resolve(station, url, onResolved))
      .catch(() => resolve(station, null, onResolved));
  }
  return null;
}
