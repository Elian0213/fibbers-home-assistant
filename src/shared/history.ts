/* ================================================================== *
 * HISTORY — the recorder-backed sparkline series shared by fibbers-graph and
 * fibbers-sysmon: a cached, backed-off history fetch (HistoryController) and the
 * SVG path maths (sparklinePaths).
 * ================================================================== */
import type { ReactiveControllerHost } from "lit";

import { fetchHistory } from "@shared/util";
import type { HomeAssistant } from "@/types/home-assistant";

const MAX_BACKOFF_MS = 8000;

/**
 * One entity's numeric history over the last `hours`. Call `fetch` on every hass
 * push; it refetches only when the window is ~a 20th stale (min 60s), so a wall
 * tablet's "last 24h" curve isn't frozen at page-load. A cold miss (recorder lag)
 * retries fast (0.5s doubling); once a series exists the backoff is a flat 8s.
 * The host only needs `requestUpdate` — it re-renders when a fetch settles.
 */
export class HistoryController {
  /** The fetched (or literal) series; null until the first successful load. */
  series: number[] | null = null;

  /** True once a fetch has finished (hit or miss) — skeleton vs "no history". */
  settled = false;

  private host: ReactiveControllerHost;

  private fetchedFor: string | null = null;

  private fetchedAt = 0;

  private lastTry = 0;

  private misses = 0;

  private gen = 0;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
  }

  /**
   * Drop all bookkeeping for a new config and discard any in-flight fetch. A literal
   * series (graph's `data:`) counts as already loaded.
   * @param series — a literal series, or null to fetch
   */
  reset(series: number[] | null = null): void {
    this.series = series;
    this.settled = series != null;
    this.fetchedFor = null;
    this.fetchedAt = 0;
    this.lastTry = 0;
    this.misses = 0;
    this.gen += 1;
  }

  /**
   * Fetch `entityId`'s history when the cache is stale and the backoff allows.
   * @param hass — the current hass
   * @param entityId — the entity to chart
   * @param hours — the window length
   */
  async fetch(
    hass: HomeAssistant | undefined,
    entityId: string,
    hours: number,
  ): Promise<void> {
    if (!hass || !hass.callWS) return;
    const now = Date.now();
    const maxAge = Math.max(60e3, (hours * 3600e3) / 20);
    if (this.fetchedFor === entityId && now - this.fetchedAt < maxAge) return;
    const backoff = this.series
      ? MAX_BACKOFF_MS
      : Math.min(500 * 2 ** this.misses, MAX_BACKOFF_MS);
    if (this.lastTry && now - this.lastTry < backoff) return;
    this.lastTry = now;
    this.gen += 1;
    const { gen } = this;
    try {
      const nums = await fetchHistory(hass, entityId, hours);
      if (gen !== this.gen) return; // a newer config/fetch superseded this one
      if (nums.length) {
        this.series = nums;
        this.fetchedFor = entityId;
        this.fetchedAt = Date.now();
        this.misses = 0;
      } else {
        this.misses += 1;
      }
    } catch (_e) {
      if (gen === this.gen) this.misses += 1;
    } finally {
      if (gen === this.gen) {
        this.settled = true;
        this.host.requestUpdate();
      }
    }
  }
}

/**
 * The stroke and filled-area SVG paths for a series in a `width`×`height` box,
 * padded 12% top and bottom so the line never kisses the edge. Needs ≥ 2 points.
 * @param series — the values, oldest first
 * @param width — the viewBox width
 * @param height — the viewBox height
 */
export function sparklinePaths(
  series: number[],
  width: number,
  height: number,
): { line: string; area: string } {
  let min = Math.min(...series);
  let max = Math.max(...series);
  const pad = (max - min || 1) * 0.12;
  min -= pad;
  max += pad;
  const n = series.length;
  const pts = series.map(
    (v, i) =>
      `${((i / (n - 1)) * width).toFixed(1)},${(height - ((v - min) / (max - min || 1)) * height).toFixed(1)}`,
  );
  return {
    line: `M${pts.join(" L")}`,
    area: `M0,${height} L${pts.join(" L")} L${width},${height} Z`,
  };
}
