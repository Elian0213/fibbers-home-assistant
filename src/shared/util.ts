/* ================================================================== *
 * UTIL — dependency-free helpers every card can import: storage, number/state
 * formatting, DOM traversal, HA dialogs, routing. Kept import-free so no card
 * pulls in a dependency it doesn't want.
 * ================================================================== */
import type { HomeAssistant, HassEntity } from "@/types/home-assistant";

/**
 * HA formats state text through `formatEntityState`, which the published
 * `HomeAssistant` type omits — accept it (and the locale/language fields we read)
 * as optional extras so callers can pass a real hass object straight in.
 */
type HassLike = HomeAssistant & {
  formatEntityState?: (st: HassEntity) => string;
};

/** sessionStorage wrapper that swallows quota/JSON/private-mode errors — reads fall back, writes go no-op. */
export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch (_) {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      /* private mode: in-memory only */
    }
  },
};

/** Strip trailing slashes from a path so route compares are exact. `""` → `"/"`. */
export const norm = (p: string): string =>
  String(p || "").replace(/\/+$/, "") || "/";
/** The current normalised pathname — the route the nav bar matches against. */
export const here = (): string => norm(window.location.pathname);

/**
 * First open-shadow descendant with this localName, searched breadth-across the
 * whole tree. HA reshuffles its ancestor chain between releases, so we never
 * hard-code the path.
 * @param localName
 */
export function deepFind(localName: string): Element | null {
  const stack: Element[] = [document.documentElement];
  while (stack.length) {
    const el = stack.pop() as Element;
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
 * @param host
 * @param entityId
 * @param extra — merged into the event detail (e.g. `{ siblings,
 *   groupName }` so a room/group modal can switch between its lamps in place)
 */
export function moreInfo(
  host: Element | null | undefined,
  entityId: string,
  extra?: Record<string, unknown>,
): void {
  if (!host || !entityId) return;
  const target = document.querySelector("home-assistant") || host;
  target.dispatchEvent(
    new CustomEvent("hass-more-info", {
      detail: { entityId, ...(extra || {}) },
      bubbles: true,
      composed: true,
    }),
  );
}

/**
 * Locale-aware number formatting: separators follow the user's HA language, not
 * the author's. `d` fixes the decimals; a non-finite value passes through as-is.
 * @param hass
 * @param n
 * @param d — fixed decimal places
 */
export const fmtNum = (
  hass: HomeAssistant | null | undefined,
  n: number,
  d?: number,
): string => {
  if (!Number.isFinite(n)) return String(n);
  const lang =
    (hass && ((hass.locale && hass.locale.language) || hass.language)) || "en";
  const opts: Intl.NumberFormatOptions =
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
 * @param domain
 * @param entities
 * @param entitiesFallback
 * @param fallback — neutral placeholder
 */
export function pickEntity(
  domain: string,
  entities: string[],
  entitiesFallback: string[],
  fallback: string,
): string {
  const inDomain = (list: string[] | undefined): string | undefined =>
    (list || []).find(
      (id) => typeof id === "string" && id.startsWith(`${domain}.`),
    );
  return inDomain(entities) || inDomain(entitiesFallback) || fallback;
}

/** True when a state object is missing or reads unavailable/unknown — the "no data" guard. */
export const isUnavail = (st: HassEntity | null | undefined): boolean =>
  !st || st.state === "unavailable" || st.state === "unknown";

/**
 * Clamp to [lo,hi]. NaN (a bad/absent state, `Number("")`) collapses to `lo`
 * rather than propagating NaN into a `width:NaN%` or `value=NaN`.
 * @param n @param lo @param hi
 */
export const clamp = (n: number, lo: number, hi: number): number =>
  Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;

/**
 * A CSS `url("…")` value safe to interpolate into an inline style. encodeURI
 * escapes the `"` (and control chars) that could otherwise break out of the
 * quotes, so a signed entity_picture URL with odd characters can't inject CSS.
 * @param url
 */
export const cssUrl = (url: string): string =>
  `url("${encodeURI(String(url))}")`;

/**
 * HA's own localised state text (motion → "Vrij", timestamp → "2 dagen geleden",
 * enum → translated). Falls back to the raw state if the helper is missing/throws.
 * @param hass
 * @param st — a hass state object
 */
export function fmtState(
  hass: HassLike | null | undefined,
  st: HassEntity | null | undefined,
): string {
  try {
    if (hass && typeof hass.formatEntityState === "function")
      return hass.formatEntityState(st as HassEntity);
  } catch (_) {
    /* fall through */
  }
  return st ? st.state : "";
}

/** A trailing-debounced wrapper carrying `.cancel()` and `.flush()`. */
export interface Debounced<A extends unknown[]> {
  (...args: A): void;
  cancel(): void;
  flush(): void;
}

/**
 * Trailing debounce — the last call within `ms` wins, so dragging a slider doesn't
 * fire a service call per pointermove. The returned fn carries a `.cancel()`.
 * @param fn
 * @param ms
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): Debounced<A> {
  let t: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;
  let firedKey: unknown;
  let firedAt = 0;
  // Fire, but on the high-frequency LIVE path skip a call whose first arg equals one
  // fired in the last ~0.8s — the slider committers all take a single value, so this
  // trims duplicate mid-drag commits. `force` (a flush on release) bypasses the skip:
  // the release must always commit, because the committer also arms the SliderHold,
  // and a dedup-skipped release left the hold un-re-armed → it expired mid-flight and
  // the slider snapped back to the stale entity value.
  const fire = (args: A, force?: boolean): void => {
    const key = args[0];
    const now = Date.now();
    if (!force && key === firedKey && now - firedAt < 800) return;
    firedKey = key;
    firedAt = now;
    fn(...args);
  };
  const wrapped = ((...args: A): void => {
    lastArgs = args;
    if (t != null) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      if (lastArgs) fire(lastArgs);
    }, ms);
  }) as Debounced<A>;
  wrapped.cancel = (): void => {
    if (t != null) clearTimeout(t);
    t = null;
  };
  // Fire the pending call immediately (once), if any — used on drag release so the
  // final value lands now instead of after the debounce window. Always fires (force),
  // so the release re-arms the hold even when it repeats a recent mid-drag value.
  wrapped.flush = (): void => {
    if (t == null) return;
    clearTimeout(t);
    t = null;
    if (lastArgs) fire(lastArgs, true);
  };
  return wrapped;
}

/**
 * Pointer clientX → 0-100% along a track element. Shared by every drag slider so
 * callers map the % onto their own value range.
 * @param clientX
 * @param track
 */
export function pctFromX(clientX: number, track: Element): number {
  const r = track.getBoundingClientRect();
  return clamp(((clientX - r.left) / r.width) * 100, 0, 100);
}

/**
 * Capture the pointer on `el` if possible. `el.setPointerCapture(id)` throws an
 * (uncaught) `NotFoundError` when the pointer is already gone — a tap released
 * between dispatch and handler — so every drag guards the call here rather than
 * letting the throw reach HA's global error handler and half-init the gesture.
 * @param el
 * @param pointerId
 */
export function capturePointer(
  el: Element | null | undefined,
  pointerId: number,
): void {
  try {
    if (el && el.setPointerCapture) el.setPointerCapture(pointerId);
  } catch (_) {
    /* pointer already released — nothing to capture */
  }
}

/**
 * One entity's recent history as an array of finite numbers (newest last), over
 * HA's websocket. Returns [] when history is unavailable. Shared by the graph and
 * sysmon sparklines.
 * @param hass
 * @param entityId
 * @param hours
 */
export async function fetchHistory(
  hass: HomeAssistant | null | undefined,
  entityId: string,
  hours = 24,
): Promise<number[]> {
  if (!hass || !hass.callWS) return [];
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600e3);
  const res = await hass.callWS<
    Record<string, { s?: unknown; state?: unknown }[]>
  >({
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
 * @param path
 * @param opts — `{ replace }` swaps history state instead of pushing
 */
export function navigate(
  path: string,
  { replace = false }: { replace?: boolean } = {},
): void {
  if (!path) return;
  if (String(path).startsWith("#")) {
    window.location.hash = path;
    return;
  }
  if (replace) window.history.replaceState(null, "", path);
  else window.history.pushState(null, "", path);
  window.dispatchEvent(
    new CustomEvent("location-changed", { detail: { replace } }),
  );
}
