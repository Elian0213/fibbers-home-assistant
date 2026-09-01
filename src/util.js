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

// Open HA's more-info dialog for an entity from a card/host element.
export function moreInfo(host, entityId) {
  if (!host || !entityId) return;
  host.dispatchEvent(
    new CustomEvent("hass-more-info", {
      detail: { entityId },
      bubbles: true,
      composed: true,
    }),
  );
}

// nl-NL number formatting; `d` fixes the decimals, else locale default.
export const nl = (n, d) =>
  Number.isFinite(n)
    ? n.toLocaleString(
        "nl-NL",
        d != null ? { minimumFractionDigits: d, maximumFractionDigits: d } : {},
      )
    : String(n);

export const isUnavail = (st) =>
  !st || st.state === "unavailable" || st.state === "unknown";

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

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
