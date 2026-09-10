/* ================================================================== *
 * light-detail-wheel — the colour/warm wheel + colour-cluster engine as a Lit
 * ReactiveController (modelled on SliderHold in shared/ui.ts). Owns the live drag
 * state, per-lamp colour/kelvin display holds, and the debounced service
 * committers. Grouping is DERIVED, not stored: on lamps that read as the same
 * colour (ΔE in Lab) or same kelvin are drawn as one marker, computed live from HA
 * state — so it needs no persistence and is identical on every device/user. The
 * only grouping state is a transient "soloed" lamp peeled off to edit alone. The
 * element (its host) keeps only HA wiring; the controller drives re-renders via
 * `host.requestUpdate()` and tears its pending writes down on disconnect.
 * ================================================================== */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import { clamp, debounce, type Debounced } from "@shared/util";
import { pointerDrag, type PointerDragHandlers } from "@shared/ui";
import type { HomeAssistant } from "@/types/home-assistant";

import {
  STRIP_LO,
  STRIP_HI,
  SNAP_PX,
  GROUP_K,
  hueDiff,
  sameColour,
  colourXY,
  warmXY,
  colourAt,
  warmFracAt,
  hueToKelvin,
} from "./light-detail-math";
import {
  lampOn,
  lampAttr,
  lampHs,
  lampHasColor,
  lampHasTemp,
  lampKRange,
  lampKelvin,
} from "./light-detail-lamps";

// Live drag state for the colour/warm wheel.
/* How long a committed colour/kelvin is shown optimistically before falling back
 * to server state — long enough that a slow HA round-trip no longer flashes the
 * old colour back. It's cleared early the moment the entity lands within tolerance
 * (see dispHs/dispK), so a fast HA still feels instant. */
const HOLD_MS = 8000;

export interface WheelState {
  kind: "colour" | "warm" | null;
  warm?: boolean;
  members: string[];
  dragging: boolean;
  hue?: number;
  sat?: number;
  k?: number;
}

// One marker on the wheel — a solo lamp or a colour-cluster moving as one.
export interface WheelUnit {
  rep: string;
  members: string[];
  warm: boolean;
}

/**
 * The host contract the controller needs from the element — kept narrow so the
 * controller stays decoupled and testable with a mock. The element implements a
 * superset (see LightDetailHost in light-detail-views.ts).
 */
export interface WheelHost extends ReactiveControllerHost {
  hass?: HomeAssistant;
  /** The current lamp set (a room's siblings, else just the one light). */
  lamps(): string[];
  /** The focused lamp — brightness/temp sliders + swatches + keyboard drive it. */
  readonly active: string;
  /** Focus a lamp: clears slider holds, swaps the active entity, re-renders. */
  selectActive(id: string): void;
  /** `light.turn_on` with `data` on one or many entities. */
  call(data: Record<string, unknown>, id?: string | string[]): void;
}

/**
 * The colour/warm wheel + derived colour-cluster engine, as a Lit
 * ReactiveController. Holds the live drag state, per-lamp display holds, the
 * transient soloed lamp, and the debounced service committers; drives the host's
 * re-renders and cleans up on disconnect.
 */
export class WheelController implements ReactiveController {
  private host: WheelHost;

  private _wheel: WheelState = { kind: null, members: [], dragging: false };

  private _cHold = new Map<string, { h: number; s: number; exp: number }>();

  private _kHold = new Map<string, { k: number; exp: number }>();

  // A lamp peeled out of its colour cluster to edit alone (tap a tile). Transient
  // and session-only — a fresh modal starts with everything auto-clustered.
  private _soloId?: string;

  private _sig?: string;

  private _colourCommit: Debounced<[{ id?: string; h: number; s: number }]>;

  private _warmCommit: Debounced<[{ id?: string; k: number }]>;

  constructor(host: WheelHost) {
    this.host = host;
    host.addController(this);
    // A per-lamp display hold keeps each dragged marker on its committed spot
    // until the lamp reports; the debounce trims the mid-drag service calls.
    this._colourCommit = debounce(
      (a) => host.call({ hs_color: [Math.round(a.h), Math.round(a.s)] }, a.id),
      110,
    );
    this._warmCommit = debounce(
      (a) => host.call({ color_temp_kelvin: Math.round(a.k) }, a.id),
      110,
    );
  }

  /** The host's live `hass` — read through so every accessor sees fresh state. */
  private get hass(): HomeAssistant | undefined {
    return this.host.hass;
  }

  /** ReactiveController teardown — cancel pending writes (host stays registered). */
  hostDisconnected(): void {
    this._colourCommit.cancel();
    this._warmCommit.cancel();
  }

  /** Drop the transient solo peel when the room's lamp set changes. */
  reset(sig: string): void {
    if (this._sig !== sig) {
      this._soloId = undefined;
      this._sig = sig;
    }
  }

  // --- lamp sets ----------------------------------------------------------------

  private _colourLamps(): string[] {
    // On, colour-capable, and actually reporting a colour — excludes a light that
    // advertises a colour mode but has no hs_color (it would sit at a bogus 0,0).
    return this.host
      .lamps()
      .filter(
        (id) =>
          lampOn(this.hass, id) &&
          lampHasColor(this.hass, id) &&
          Array.isArray(lampAttr(this.hass, id, "hs_color")),
      );
  }

  // Warm-only = on + colour-temperature-capable but not a colour lamp (no hs_color).
  private _warmOnlyLamps(): string[] {
    const colour = this._colourLamps();
    return this.host
      .lamps()
      .filter(
        (id) =>
          lampOn(this.hass, id) &&
          lampHasTemp(this.hass, id) &&
          !colour.includes(id),
      );
  }

  /** Every on lamp that gets a marker (colour lamps first, then warm-only). */
  wheelLamps(): string[] {
    return [...this._colourLamps(), ...this._warmOnlyLamps()];
  }

  /** True when the lamp rides the warm track rather than the colour wheel. */
  isWarm(id: string): boolean {
    return !this._colourLamps().includes(id);
  }

  // --- per-lamp colour / warm display holds -------------------------------------

  /**
   * Displayed hue/sat for a lamp: the live drag value while its dot is dragged,
   * else the committed hold until the entity catches up, else the entity value.
   */
  dispHs(id: string): [number, number] {
    if (
      this._wheel.dragging &&
      this._wheel.kind === "colour" &&
      this._wheel.members &&
      this._wheel.members.includes(id)
    )
      return [this._wheel.hue as number, this._wheel.sat as number];
    const held = this._cHold.get(id);
    const hs = lampHs(this.hass, id);
    if (held) {
      const landed =
        hueDiff(hs[0], held.h) <= 4 && Math.abs(hs[1] - held.s) <= 4;
      if (landed || Date.now() > held.exp) this._cHold.delete(id);
      else return [held.h, held.s];
    }
    return hs;
  }

  /** Displayed kelvin for a lamp on the warm strip (same hold logic as dispHs). */
  dispK(id: string): number {
    if (
      this._wheel.dragging &&
      this._wheel.kind === "warm" &&
      this._wheel.members &&
      this._wheel.members.includes(id)
    )
      return this._wheel.k as number;
    const held = this._kHold.get(id);
    const k = lampKelvin(this.hass, id);
    if (held) {
      if ((k != null && Math.abs(k - held.k) <= 60) || Date.now() > held.exp)
        this._kHold.delete(id);
      else return held.k;
    }
    const [lo, hi] = lampKRange(this.hass, id);
    return k != null ? k : Math.round((lo + hi) / 2);
  }

  // --- derived colour clusters (a "unit" is one lamp or same-colour lamps) -------

  // Do two on lamps read as the same colour? Same kind required — a warm lamp and a
  // colour lamp never merge (they live in different zones of the disc).
  private _match(a: string, b: string): boolean {
    const warm = this.isWarm(a);
    if (warm !== this.isWarm(b)) return false;
    return warm
      ? Math.abs(this.dispK(a) - this.dispK(b)) <= GROUP_K
      : sameColour(this.dispHs(a), this.dispHs(b));
  }

  // The on wheel-lamps grouped by colour (greedy: each lamp joins the first cluster
  // whose representative matches, else starts one). The soloed lamp is always kept
  // on its own so it can be edited apart from its colour-mates. Derived every read
  // from live state — nothing is stored.
  private _clusters(): string[][] {
    const clusters: string[][] = [];
    for (const id of this.wheelLamps()) {
      if (id === this._soloId) {
        clusters.push([id]);
        continue;
      }
      const g = clusters.find(
        (c) => c[0] !== this._soloId && this._match(c[0], id),
      );
      if (g) g.push(id);
      else clusters.push([id]);
    }
    return clusters;
  }

  /** The on lamps a drag/keyboard commit drives for `id` — its colour cluster. */
  membersOf(id: string): string[] {
    return this._clusters().find((c) => c.includes(id)) || [id];
  }

  /** One entry per marker to draw: each colour cluster + each solo lamp. */
  units(): WheelUnit[] {
    return this._clusters().map((members) => {
      const colourRep = members.find((m) => !this.isWarm(m));
      return { rep: colourRep || members[0], members, warm: !colourRep };
    });
  }

  /**
   * Tap a tile: focus that lamp and control its whole colour-group. Tapping the
   * already-focused lamp again toggles it solo (peel it out to edit alone).
   */
  focusOrSolo(id: string): void {
    if (id !== this.host.active) {
      this._soloId = undefined;
      this.host.selectActive(id);
    } else {
      this._soloId = this._soloId === id ? undefined : id;
      this.host.requestUpdate();
    }
  }

  /** The count of on lamps in a lamp's colour cluster (0/1 → no badge). */
  groupCount(id: string): number {
    const c = this._clusters().find((g) => g.includes(id));
    return c ? c.length : 0;
  }

  // --- marker positions ---------------------------------------------------------

  /** The marker centre (0–100% of the disc) for a unit — colour wheel or warm track. */
  unitXY(u: WheelUnit): { x: number; y: number } {
    return u.warm ? warmXY(this.dispK(u.rep)) : colourXY(...this.dispHs(u.rep));
  }

  // --- drag state (read-only, for the view's animations) ------------------------

  /** True when a live drag currently moves the unit containing `id`. */
  isDragging(id: string): boolean {
    return this._wheel.dragging && this._wheel.members.includes(id);
  }

  /** True while a warm-only unit is dragged — dims the colour ring (focus-restricted). */
  isWarmDrag(): boolean {
    return this._wheel.dragging && this._wheel.kind === "warm";
  }

  // --- commits ------------------------------------------------------------------

  private _setColour(id: string, h: number, s: number, flush?: boolean): void {
    this._cHold.set(id, { h, s, exp: Date.now() + HOLD_MS });
    this._colourCommit({ id, h, s });
    if (flush) this._colourCommit.flush();
  }

  private _setKelvin(id: string, k: number, flush?: boolean): void {
    const [lo, hi] = lampKRange(this.hass, id);
    const v = clamp(k, lo, hi);
    this._kHold.set(id, { k: v, exp: Date.now() + HOLD_MS });
    this._warmCommit({ id, k: v });
    if (flush) this._warmCommit.flush();
  }

  // Apply a colour target to a set of lamps: colour lamps take the hs, warm lamps
  // take the nearest colour temperature (so a mixed group tracks the drag).
  private _commitColour(
    members: string[],
    hue: number,
    sat: number,
    flush?: boolean,
  ): void {
    const k = hueToKelvin(hue, sat);
    members.forEach((id) => {
      if (this.isWarm(id)) this._setKelvin(id, k, flush);
      else this._setColour(id, hue, sat, flush);
    });
  }

  // --- the wheel gesture --------------------------------------------------------

  // The pointer bookkeeping (capture on the stable disc, single-pointer tracking
  // by pointerId, cancel-vs-release, no spurious abort from the post-release
  // lostpointercapture) lives in the shared pointerDrag primitive — a second
  // finger or a mid-drag re-render can no longer kill the drag.
  readonly drag: PointerDragHandlers = pointerDrag({
    start: (e) => this._start(e),
    // Wrap: _move's second param is the `final` flush flag, NOT drag state.
    move: (e) => this._move(e),
    end: (e) => this._end(e),
  });

  // Arrows nudge the active lamp's whole unit — wired to the disc's @keydown.
  readonly onKey = (e: KeyboardEvent): void => this._key(e);

  // Grab the nearest unit marker, then drag the whole unit (a lamp or a group).
  private _start(e: PointerEvent): boolean {
    const units = this.units();
    if (!units.length) return false;
    const r = (e.currentTarget as Element).getBoundingClientRect();
    const distTo = (u: WheelUnit): number => {
      const p = this.unitXY(u);
      return Math.hypot(
        e.clientX - (r.left + (p.x / 100) * r.width),
        e.clientY - (r.top + (p.y / 100) * r.height),
      );
    };
    let best: WheelUnit | null = null;
    let bestD = Infinity;
    for (const u of units) {
      const d = distTo(u);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    // Prefer the focused lamp's unit when the pointer lands on it.
    const au = units.find((u) => u.members.includes(this.host.active));
    if (au && distTo(au) <= 22) best = au;
    if (!best) return false;
    this._wheel = {
      kind: best.warm ? "warm" : "colour",
      warm: best.warm,
      members: best.members,
      dragging: true,
      hue: 0,
      sat: 0,
      k: this.dispK(best.rep),
    };
    this.host.selectActive(best.rep);
    this._move(e);
    return true;
  }

  private _move(e: PointerEvent, final?: boolean): void {
    if (!this._wheel.dragging) return;
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const R = rect.width / 2;
    if (R <= 0) return;
    if (this._wheel.kind === "warm") {
      const frac = warmFracAt(e.clientX, rect);
      const k = Math.round(STRIP_LO + frac * (STRIP_HI - STRIP_LO));
      this._wheel.k = k;
      this.host.requestUpdate();
      this._wheel.members.forEach((id) => this._setKelvin(id, k, final));
    } else {
      const [hue, sat] = colourAt(e, R);
      this._wheel.hue = hue;
      this._wheel.sat = sat;
      this.host.requestUpdate();
      this._commitColour(this._wheel.members, hue, sat, final);
    }
  }

  // Release (e) → final commit + snap-to-colour; cancel (null) → stop tracking, no
  // snap (the debounced live commits already landed where the drag last was).
  private _end(e: PointerEvent | null): void {
    if (!this._wheel.dragging) return;
    if (!e) {
      this._wheel.dragging = false;
      this.host.requestUpdate();
      return;
    }
    this._move(e, true);
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    // The dragged unit's marker centre (from the live drag state).
    const dp =
      this._wheel.kind === "warm"
        ? warmXY(this._wheel.k as number)
        : colourXY(this._wheel.hue as number, this._wheel.sat as number);
    const dcx = rect.left + (dp.x / 100) * rect.width;
    const dcy = rect.top + (dp.y / 100) * rect.height;
    const dragged = new Set(this._wheel.members);
    let target: WheelUnit | null = null;
    for (const u of this.units()) {
      if (u.members.some((m) => dragged.has(m))) continue;
      const p = this.unitXY(u);
      const d = Math.hypot(
        dcx - (rect.left + (p.x / 100) * rect.width),
        dcy - (rect.top + (p.y / 100) * rect.height),
      );
      if (d <= SNAP_PX + 12) {
        target = u;
        break;
      }
    }
    this._wheel.dragging = false;
    if (target) {
      // Snap the dragged unit's colour EXACTLY to the target's — ΔE 0, so they
      // auto-cluster (no stored group). Clear any solo peel so it rejoins.
      const { members } = this._wheel;
      if (this._wheel.kind === "warm")
        members.forEach((id) =>
          this._setKelvin(id, this.dispK(target.rep), true),
        );
      else {
        const [h, s] = this.dispHs(target.rep);
        this._commitColour(members, h, s, true);
      }
      if (this._soloId && members.includes(this._soloId))
        this._soloId = undefined;
    }
    this.host.requestUpdate();
  }

  private _key(e: KeyboardEvent): void {
    const id = this.host.active;
    if (!lampOn(this.hass, id) || !this.wheelLamps().includes(id)) return;
    const members = this.membersOf(id);
    if (this.isWarm(id)) {
      const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[
        e.key
      ];
      if (!dir) return;
      e.preventDefault();
      const k = clamp(
        (this.dispK(id) || STRIP_LO) + (e.shiftKey ? 500 : 100) * dir,
        STRIP_LO,
        STRIP_HI,
      );
      members.forEach((m) => this.isWarm(m) && this._setKelvin(m, k, true));
    } else {
      const d = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      }[e.key];
      if (!d) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 2;
      const [ch, cs] = this.dispHs(id);
      const hue = (((ch + d[0] * step) % 360) + 360) % 360;
      const sat = clamp(cs + d[1] * step, 0, 100);
      this._commitColour(members, hue, sat, true);
    }
    this.host.requestUpdate();
  }
}
