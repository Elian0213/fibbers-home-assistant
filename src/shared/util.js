/* ================================================================== *
 * UTIL — dependency-free helpers every card can import: storage, number/state
 * formatting, DOM traversal, HA dialogs, routing. Kept import-free so no card
 * pulls in a dependency it doesn't want.
 * ================================================================== */

/** sessionStorage wrapper that swallows quota/JSON/private-mode errors — reads fall back, writes go no-op. */
export const store = {
  get(key, fallback) {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* private mode: in-memory only */
    }
  },
};

/** Strip trailing slashes from a path so route compares are exact. `""` → `"/"`. @returns {string} */
export const norm = (p) => String(p || "").replace(/\/+$/, "") || "/";
/** The current normalised pathname — the route the nav bar matches against. @returns {string} */
export const here = () => norm(window.location.pathname);

/**
 * First open-shadow descendant with this localName, searched breadth-across the
 * whole tree. HA reshuffles its ancestor chain between releases, so we never
 * hard-code the path.
 * @param {string} localName
 * @returns {Element|null}
 */
export function deepFind(localName) {
  const stack = [document.documentElement];
  while (stack.length) {
    const el = stack.pop();
    if (el.localName === localName) return el;
    if (el.shadowRoot) stack.push(...el.shadowRoot.children);
    if (el.children) stack.push(...el.children);
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Shared card helpers (kept dependency-free so any card can import).
 * ------------------------------------------------------------------ */

/**
 * Open HA's more-info dialog for an entity from a card/host element. The sheet and
 * nav layers render into document.body — a sibling of <home-assistant>, not an
 * ancestor — so a bubbling event from there stops at <body> and never reaches
 * HA's listener. Target <home-assistant> directly, falling back to the host for
 * the normal in-view case.
 * @param {Element} host
 * @param {string} entityId
 */
export function moreInfo(host, entityId) {
  if (!host || !entityId) return;
  const target = document.querySelector("home-assistant") || host;
  target.dispatchEvent(
    new CustomEvent("hass-more-info", {
      detail: { entityId },
      bubbles: true,
      composed: true,
    }),
  );
}

/**
 * Locale-aware number formatting: separators follow the user's HA language, not
 * the author's. `d` fixes the decimals; a non-finite value passes through as-is.
 * @param {object} hass
 * @param {number} n
 * @param {number} [d] — fixed decimal places
 * @returns {string}
 */
export const fmtNum = (hass, n, d) => {
  if (!Number.isFinite(n)) return String(n);
  const lang =
    (hass && ((hass.locale && hass.locale.language) || hass.language)) || "en";
  const opts =
    d != null ? { minimumFractionDigits: d, maximumFractionDigits: d } : {};
  try {
    return n.toLocaleString(lang, opts);
  } catch (_) {
    return n.toLocaleString("en", opts);
  }
};

/**
 * Pick a real entity id of `domain` for a card's getStubConfig — HA passes the
 * user's curated `entities` then a broader `entitiesFallback`. Ends on a neutral
 * placeholder so a stub is never hard-coded to one person's house.
 * @param {string} domain
 * @param {string[]} entities
 * @param {string[]} entitiesFallback
 * @param {string} fallback — neutral placeholder
 * @returns {string}
 */
export function pickEntity(domain, entities, entitiesFallback, fallback) {
  const inDomain = (list) =>
    (list || []).find(
      (id) => typeof id === "string" && id.startsWith(`${domain}.`),
    );
  return inDomain(entities) || inDomain(entitiesFallback) || fallback;
}

/** True when a state object is missing or reads unavailable/unknown — the "no data" guard. @param {object} st */
export const isUnavail = (st) =>
  !st || st.state === "unavailable" || st.state === "unknown";

/**
 * Clamp to [lo,hi]. NaN (a bad/absent state, `Number("")`) collapses to `lo`
 * rather than propagating NaN into a `width:NaN%` or `value=NaN`.
 * @param {number} n @param {number} lo @param {number} hi @returns {number}
 */
export const clamp = (n, lo, hi) =>
  Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;

/**
 * A CSS `url("…")` value safe to interpolate into an inline style. encodeURI
 * escapes the `"` (and control chars) that could otherwise break out of the
 * quotes, so a signed entity_picture URL with odd characters can't inject CSS.
 * @param {string} url @returns {string}
 */
export const cssUrl = (url) => `url("${encodeURI(String(url))}")`;

/**
 * HA's own localised state text (motion → "Vrij", timestamp → "2 dagen geleden",
 * enum → translated). Falls back to the raw state if the helper is missing/throws.
 * @param {object} hass
 * @param {object} st — a hass state object
 * @returns {string}
 */
export function fmtState(hass, st) {
  try {
    if (hass && typeof hass.formatEntityState === "function")
      return hass.formatEntityState(st);
  } catch (_) {
    /* fall through */
  }
  return st ? st.state : "";
}

/**
 * Trailing debounce — the last call within `ms` wins, so dragging a slider doesn't
 * fire a service call per pointermove. The returned fn carries a `.cancel()`.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function} debounced wrapper with `.cancel()`
 */
export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

/**
 * Pointer clientX → 0-100% along a track element. Shared by every drag slider so
 * callers map the % onto their own value range.
 * @param {number} clientX
 * @param {Element} track
 * @returns {number} 0-100
 */
export function pctFromX(clientX, track) {
  const r = track.getBoundingClientRect();
  return clamp(((clientX - r.left) / r.width) * 100, 0, 100);
}

/**
 * One entity's recent history as an array of finite numbers (newest last), over
 * HA's websocket. Returns [] when history is unavailable. Shared by the graph and
 * sysmon sparklines.
 * @param {object} hass
 * @param {string} entityId
 * @param {number} [hours=24]
 * @returns {Promise<number[]>}
 */
export async function fetchHistory(hass, entityId, hours = 24) {
  if (!hass || !hass.callWS) return [];
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600e3);
  const res = await hass.callWS({
    type: "history/history_during_period",
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    entity_ids: [entityId],
    minimal_response: true,
    no_attributes: true,
  });
  return ((res && res[entityId]) || [])
    .map((r) => Number(r.s != null ? r.s : r.state))
    .filter((n) => Number.isFinite(n));
}

/**
 * Client-side navigate, then fire `location-changed` so HA's router repaints
 * without a full reload. A `#`-path just sets the hash (drives the modal sheet).
 * @param {string} path
 * @param {object} [opts] — `{ replace }` swaps history state instead of pushing
 */
export function navigate(path, { replace = false } = {}) {
  if (!path) return;
  if (String(path).startsWith("#")) {
    window.location.hash = path;
    return;
  }
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.dispatchEvent(
    new CustomEvent("location-changed", { detail: { replace } }),
  );
}
