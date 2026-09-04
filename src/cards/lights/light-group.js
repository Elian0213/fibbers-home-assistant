/* ================================================================== *
 * fibbers-light-group — a master light control, heavier than a row: card
 * surface, room icon, a taller master slider, and members that expand as nested
 * light rows. Drives `brightness_pct` on the group (or an `entities` list).
 * ================================================================== */
import { LitElement, html, css } from "lit";

import { t } from "../../shared/i18n.js";
import { twSheet } from "../../shared/tw.js";
import { stepFromKey, sliderDrag, SliderHold } from "../../shared/ui.js";
import {
  store,
  isUnavail,
  pctFromX,
  debounce,
  pickEntity,
} from "../../shared/util.js";
import "../../shared/icon.js";

const isLight = (id) => typeof id === "string" && id.startsWith("light.");

const EDITOR_SCHEMA = [
  { name: "entity", selector: { entity: { domain: "light" } } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
];

/**
 * fibbers-light-group — a master light control, heavier than a row: card surface,
 * room icon, a taller master slider, and members that expand as nested light rows.
 */
export class FibbersLightGroup extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _open: { state: true },
    _dragging: { state: true },
    _dragPct: { state: true },
  };

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** HA calls this to seed a fresh card — pick a real light so the default isn't empty. */
  static getStubConfig(hass, entities, entitiesFallback) {
    return {
      type: "custom:fibbers-light-group",
      entities: [
        pickEntity("light", entities, entitiesFallback, "light.example"),
      ],
      name: "Lights",
    };
  }

  /** The visual editor: hand HA a shared form-editor driven by this card's schema. */
  static getConfigElement() {
    const el = document.createElement("fibbers-form-editor");
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Validate + store the config; throws on a missing group/entities so the editor surfaces it. */
  setConfig(config) {
    if (!config || (!config.entity && !Array.isArray(config.entities))) {
      throw new Error(
        "fibbers-light-group: `entity` (a group) or `entities` is required",
      );
    }
    if (
      config.expanded != null &&
      config.expanded !== true &&
      config.expanded !== false &&
      config.expanded !== "remember"
    ) {
      throw new Error(
        'fibbers-light-group: `expanded` must be true, false, or "remember"',
      );
    }
    this._config = config;
    this._dragging = false;
    this._dragPct = 0;
    // Construct the hold once — addController has no counterpart, so a fresh one
    // per setConfig (per editor keystroke) would orphan controllers.
    if (!this._hold)
      this._hold = new SliderHold(this, { tolerance: 2, timeout: 5000 });
    else this._hold.clear();
    this._debouncedCommit = debounce((p) => this._commit(p), 150);
    // Shared drag gesture: live-track past the slop, final value wins on release.
    this._drag = sliderDrag({
      read: (e) => Math.round(pctFromX(e.clientX, e.currentTarget)),
      frame: (v, dragging) => {
        this._dragging = dragging;
        if (v != null) this._dragPct = v;
      },
      live: (v) => this._debouncedCommit(v),
      end: (v) => {
        if (v == null) return this._debouncedCommit.cancel();
        this._debouncedCommit(v);
        this._debouncedCommit.flush();
      },
    });
    this._rowCache = new Map();
    this._loggedGhosts = false;
    this._open =
      config.expanded === true
        ? true
        : config.expanded === "remember"
          ? !!store.get(this._key(), false)
          : false;
  }

  _key() {
    const c = this._config;
    return `fibbers:lightgroup:${c.entity || (c.entities || []).join(",")}`;
  }

  // Member ids: explicit `members`/`entities`, else the group's own members with
  // ghost ids (no state object — e.g. a stale Hue entry) skipped, not counted.
  _members() {
    const cfg = this._config;
    if (Array.isArray(cfg.members)) return cfg.members.filter(isLight);
    if (Array.isArray(cfg.entities)) return cfg.entities.filter(isLight);
    const st = cfg.entity && this.hass && this.hass.states[cfg.entity];
    const ids = (st && st.attributes && st.attributes.entity_id) || [];
    const live = ids.filter((id) => this.hass && this.hass.states[id]);
    if (!this._loggedGhosts && live.length !== ids.length) {
      this._loggedGhosts = true;
      console.debug(
        `fibbers-light-group: skipped ${ids.length - live.length} member(s) of ${cfg.entity} with no state object`,
      );
    }
    return live;
  }

  // Aggregate: how many on, average brightness, whether they differ (mixed).
  _state() {
    const hass = this.hass;
    const members = this._members();
    if (!hass || !members.length)
      return { on: 0, total: 0, off: 0, pct: 0, mixed: false, allOff: true };
    let on = 0;
    let avail = 0;
    let off = 0;
    let sum = 0;
    let withBrightness = 0;
    let bmin = Infinity;
    let bmax = -Infinity;
    members.forEach((id) => {
      const st = hass.states[id];
      if (isUnavail(st)) {
        off += 1;
        return;
      }
      avail += 1;
      if (st.state === "on") {
        on += 1;
        // Only members that actually report a brightness feed the average — an
        // on/off member with no `brightness` used to inject a phantom 100% and
        // drag the master slider up.
        const b = st.attributes.brightness;
        if (b != null) {
          const pct = Math.round((b / 255) * 100);
          sum += pct;
          withBrightness += 1;
          bmin = Math.min(bmin, pct);
          bmax = Math.max(bmax, pct);
        }
      }
    });
    return {
      on,
      total: members.length,
      off,
      pct: withBrightness ? Math.round(sum / withBrightness) : on ? 100 : 0,
      mixed: withBrightness > 1 && bmax - bmin > 2,
      allOff: avail === 0,
    };
  }

  _secondary(s) {
    const hl = this._config.language || this.hass;
    if (s.allOff) return t(hl, "light_group.offline");
    if (s.on === 0) return t(hl, "light_group.off");
    const base = t(hl, "light_group.state_count", {
      on: s.on,
      total: s.total,
      pct: s.pct,
    });
    return s.off
      ? `${base} · ${t(hl, "light_group.offline_count", { off: s.off })}`
      : base;
  }

  // Absolute set on every member (via the group entity when there is one).
  _commit(pct) {
    if (!this.hass) return;
    this._hold.hold(pct); // show the committed value until the group catches up
    // Optimistically hold each expanded member row at the same target so their
    // sliders move with the master immediately instead of lagging HA's per-member
    // state push and then jumping ("teleport").
    this._rowCache.forEach((row) => {
      if (row && typeof row.holdDisplay === "function") row.holdDisplay(pct);
    });
    const entity_id = this._config.entity || this._members();
    const p =
      pct <= 0
        ? this.hass.callService("light", "turn_off", { entity_id })
        : this.hass.callService("light", "turn_on", {
            entity_id,
            brightness_pct: pct,
          });
    Promise.resolve(p).catch(() => {
      this._hold.clear();
      this._rowCache.forEach((row) => {
        if (row && typeof row.clearDisplay === "function") row.clearDisplay();
      });
    });
  }

  /** Drop the trailing debounced commit on unmount so a stale value never fires. */
  disconnectedCallback() {
    super.disconnectedCallback();
    this._debouncedCommit.cancel();
  }

  // Keyboard control for the master slider (arrows/Home/End/PageUp-Down by 5%).
  // Steps from the on-screen value (the held/dragged one) — not the raw entity —
  // so repeated key presses during a hold don't jump back to the stale brightness.
  _onKey(e) {
    const s = this._state();
    if (s.allOff) return;
    const cur = this._hold.value(s.pct, {
      dragging: this._dragging,
      dragValue: this._dragPct,
      gone: s.allOff,
    });
    const next = stepFromKey(e.key, { value: cur, min: 0, max: 100, step: 5 });
    if (next == null) return;
    e.preventDefault();
    // Arm the hold now so held-key repeats keep climbing, but debounce the write —
    // the raw committer fired a light.turn_on per keydown (~30/s on auto-repeat).
    if (next !== cur) {
      this._hold.hold(next);
      this._debouncedCommit(next);
    }
  }

  _toggle() {
    this._open = !this._open;
    if (this._config.expanded === "remember")
      store.set(this._key(), this._open);
  }
  _scene(id) {
    if (this.hass) this.hass.callService("scene", "turn_on", { entity_id: id });
  }

  // Cache one real fibbers-light-row per member so drag state survives re-renders.
  _memberRow(id) {
    let el = this._rowCache.get(id);
    if (!el) {
      el = document.createElement("fibbers-light-row");
      el.setConfig({
        type: "custom:fibbers-light-row",
        entity: id,
        compact: true,
        // Carry the group so opening a member's detail can switch lamps in place.
        siblings: this._members(),
        groupName: this._config.name,
      });
      this._rowCache.set(id, el);
    }
    el.hass = this.hass;
    return el;
  }

  /** Draw the header, master slider, and (when open) the expanded member rows. */
  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const s = this._state();
    const lit = s.on > 0;
    const pct = this._hold.value(s.pct, {
      dragging: this._dragging,
      dragValue: this._dragPct,
      gone: s.allOff,
    });
    const name = cfg.name || t(hl, "light_group.default_name");
    const icon = cfg.icon || "solar:lightbulb-bold-duotone";
    const stripe = s.mixed
      ? ";background-image:repeating-linear-gradient(45deg,transparent 0,transparent 4px,rgba(0,0,0,.18) 4px,rgba(0,0,0,.18) 8px)"
      : "";

    return html`<div
      class="rounded-[15px] border p-[13px]
             ${
               lit
                 ? "border-[#2E5238] bg-[linear-gradient(145deg,#1E3427,#132016)]"
                 : "border-line bg-card"
             }
             ${s.allOff ? "opacity-[.66]" : ""}"
    >
      <div class="flex items-center gap-3">
        <div
          class="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]
                 ${lit ? "bg-accentbg" : "bg-card2"}"
        >
          <fib-icon
            class="h-[19px] w-[19px] [--mdc-icon-size:19px] ${
              lit ? "text-accent" : "text-muted"
            }"
            icon=${icon}
          ></fib-icon>
        </div>
        <button
          type="button"
          class="min-w-0 flex-1 text-left"
          @click=${this._toggle}
        >
          <div class="truncate text-[13px] font-semibold text-ink">${name}</div>
          <div
            class="truncate text-[11px] ${s.allOff ? "text-red" : "text-muted"}"
          >
            ${this._secondary(s)}
          </div>
        </button>
        <button
          type="button"
          class="fib-hit flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted
                 transition-transform active:scale-90"
          aria-label=${
            this._open
              ? t(hl, "light_group.collapse")
              : t(hl, "light_group.expand")
          }
          @click=${this._toggle}
        >
          <fib-icon
            class="h-5 w-5 [--mdc-icon-size:20px] transition-transform ${
              this._open ? "rotate-180" : ""
            }"
            icon="solar:alt-arrow-down-bold-duotone"
          ></fib-icon>
        </button>
      </div>

      <div
        class="group relative mt-2 flex h-[var(--fib-hit)] cursor-pointer touch-pan-y items-center
               ${s.allOff ? "pointer-events-none opacity-50" : ""}"
        role="slider"
        tabindex=${s.allOff ? -1 : 0}
        aria-label=${name}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow=${pct}
        aria-valuetext=${`${pct}%`}
        aria-disabled=${s.allOff ? "true" : "false"}
        @pointerdown=${this._drag.down}
        @pointermove=${this._drag.move}
        @pointerup=${this._drag.up}
        @pointercancel=${this._drag.cancel}
        @lostpointercapture=${this._drag.cancel}
        @keydown=${this._onKey}
      >
        <div
          class="pointer-events-none relative h-2.5 w-full rounded-full bg-[#2C3639]"
        >
          ${
            s.allOff
              ? ""
              : html`<div
                    class="absolute bottom-0 left-0 top-0 rounded-full bg-accent"
                    style="width:${pct}%${stripe}"
                  ></div>
                  <div
                    class="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2
                           whitespace-nowrap rounded-md border border-line bg-card2 px-2 py-1
                           text-[11px] font-semibold tabular-nums text-ink
                           shadow-[0_2px_10px_rgba(0,0,0,.5)] transition-[opacity,transform]
                           duration-100 group-focus-visible:scale-100
                           group-focus-visible:opacity-100
                           ${this._dragging ? "scale-100 opacity-100" : "scale-90 opacity-0"}"
                    style="left:${pct}%"
                  >
                    ${pct}%
                  </div>
                  <div
                    class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full
                         bg-accent shadow-[0_1px_4px_rgba(0,0,0,.5)]
                         transition-[width,height] duration-100
                         ${this._dragging ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]"}"
                    style="left:${pct}%"
                  ></div>`
          }
        </div>
      </div>

      ${this._open ? this._expanded() : ""}
    </div>`;
  }

  _expanded() {
    const cfg = this._config;
    const scenes = Array.isArray(cfg.show_scenes) ? cfg.show_scenes : [];
    return html`<div class="ml-[18px] mt-3 border-l border-card2 pl-3">
      ${
        scenes.length
          ? html`<div class="mb-1 flex flex-wrap gap-1.5">
              ${scenes.map((id) => {
                const st = this.hass && this.hass.states[id];
                const label = (st && st.attributes.friendly_name) || id;
                return html`<button
                  type="button"
                  class="rounded-full border border-line bg-card2 px-2.5 py-1 text-[10.5px]
                       font-medium text-ink2"
                  @click=${() => this._scene(id)}
                >
                  ${label}
                </button>`;
              })}
            </div>`
          : ""
      }
      ${this._members().map((id) => this._memberRow(id))}
    </div>`;
  }

  /** Masonry height hint (header + slider ≈ 2 rows). */
  getCardSize() {
    return 2;
  }
  /** Sections-view layout: full-width, two rows tall. */
  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 2 };
  }
  /** Grid-view sizing: full-width, auto height (grows when expanded). */
  getGridOptions() {
    return { columns: "full", rows: "auto" };
  }
}
