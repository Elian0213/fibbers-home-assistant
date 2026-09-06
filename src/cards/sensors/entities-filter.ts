/* ================================================================== *
 * entities-filter — the pure filter logic behind fibbers-entities, kept
 * DOM-free (no Lit import) so it can be unit-tested and reused as data.
 * ================================================================== */
import type { HassEntity } from "@/types/home-assistant";

/** A single entity filter (`filters`/`exclude` entry); `_re` is the compiled `entity_id` regex. */
export interface EntityFilter {
  domain?: string;
  entity_id?: string;
  state?: unknown;
  state_not?: unknown;
  attributes?: Record<string, unknown>;
  below?: number;
  above?: number;
  stale_hours?: number;
  _re?: RegExp;
}

/** Parse a locale-decimal state string (comma or dot) to a float. */
const num = (s: unknown): number => parseFloat(String(s).replace(",", "."));

/**
 * Precompile each filter's `entity_id` regex once (in setConfig), validating it
 * there so a bad pattern is a clear config error instead of a per-render throw.
 * @param filters
 * @param label — used in the error message so the editor names the offending list.
 */
export function compileFilters(
  filters: EntityFilter[] | undefined,
  label: string,
): EntityFilter[] {
  return (filters || []).map((f) => {
    if (!f.entity_id) return f;
    try {
      return { ...f, _re: new RegExp(f.entity_id) };
    } catch (e) {
      throw new Error(
        `fibbers-entities: invalid ${label} entity_id regex "${f.entity_id}" — ${(e as Error).message}`,
      );
    }
  });
}

/** True when a state passes a single compiled filter (domain/regex/state/attr/threshold/staleness — all AND-ed). */
export function matches(st: HassEntity, f: EntityFilter): boolean {
  if (f.domain && !st.entity_id.startsWith(`${f.domain}.`)) return false;
  if (f._re && !f._re.test(st.entity_id)) return false;
  if (f.state != null) {
    const want = Array.isArray(f.state) ? f.state : [f.state];
    if (!want.map(String).includes(String(st.state))) return false;
  }
  if (f.state_not != null) {
    const no = Array.isArray(f.state_not) ? f.state_not : [f.state_not];
    if (no.map(String).includes(String(st.state))) return false;
  }
  if (f.attributes) {
    for (const [k, v] of Object.entries(f.attributes)) {
      if (String((st.attributes || {})[k]) !== String(v)) return false;
    }
  }
  if (f.below != null && !(num(st.state) < f.below)) return false;
  if (f.above != null && !(num(st.state) > f.above)) return false;
  if (f.stale_hours != null) {
    const ts = Date.parse(st.last_changed);
    if (Number.isNaN(ts) || (Date.now() - ts) / 3.6e6 < f.stale_hours)
      return false;
  }
  return true;
}
