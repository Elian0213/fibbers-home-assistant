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
