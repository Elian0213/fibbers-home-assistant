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
