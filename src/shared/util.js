/* ================================================================== *
 * UTIL
 * ================================================================== */
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

export const norm = (p) => String(p || "").replace(/\/+$/, "") || "/";
export const here = () => norm(window.location.pathname);

// First open-shadow descendant with this localName. HA reshuffles its ancestor
// chain between releases, so we never hard-code the path.
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

// Open HA's more-info dialog for an entity from a card/host element. The sheet and
// nav layers render into document.body — a sibling of <home-assistant>, not an
// ancestor — so a bubbling event from there reaches <body> and stops, never
// reaching HA's listener. Target <home-assistant> directly (falling back to the
// host for the normal in-view case).
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

// Locale-aware number formatting: separators follow the user's HA language, not
// the author's. `d` fixes the decimals; a non-finite value is passed through.
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

// Pick a real entity id of `domain` for a card's getStubConfig — HA passes the
// user's curated `entities` then a broader `entitiesFallback`. Falls back to a
// neutral placeholder so a stub is never hard-coded to one person's house.
export function pickEntity(domain, entities, entitiesFallback, fallback) {
  const inDomain = (list) =>
    (list || []).find(
      (id) => typeof id === "string" && id.startsWith(`${domain}.`),
    );
  return inDomain(entities) || inDomain(entitiesFallback) || fallback;
}

export const isUnavail = (st) =>
  !st || st.state === "unavailable" || st.state === "unknown";

// NaN (a bad/absent state, `Number("")`) clamps to the low bound rather than
// propagating NaN into a `width:NaN%` or `value=NaN`.
export const clamp = (n, lo, hi) =>
  Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;

// A CSS `url("…")` value safe to interpolate into an inline style. encodeURI
// escapes the `"` (and control chars) that could otherwise break out of the
// quotes, so a signed entity_picture URL with odd characters can't inject CSS.
export const cssUrl = (url) => `url("${encodeURI(String(url))}")`;

// HA's own localised state text (motion → "Vrij", timestamp → "2 dagen geleden",
// enum → translated). Falls back to the raw state if the helper is missing/throws.
export function fmtState(hass, st) {
  try {
    if (hass && typeof hass.formatEntityState === "function")
      return hass.formatEntityState(st);
  } catch (_) {
    /* fall through */
  }
  return st ? st.state : "";
}

// Trailing debounce — the last call within `ms` wins. Used so dragging a slider
// doesn't fire a service call per pointermove.
export function debounce(fn, ms) {
  let t;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

// Pointer x → 0-100% along a track element. Shared by every drag slider; callers
// round or map onto their own value range.
export function pctFromX(clientX, track) {
  const r = track.getBoundingClientRect();
  return clamp(((clientX - r.left) / r.width) * 100, 0, 100);
}

// One entity's recent history as an array of finite numbers (newest last), via
// HA's websocket. Returns [] when history is unavailable. Shared by the graph
// and sysmon sparklines.
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
