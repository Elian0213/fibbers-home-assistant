/* ================================================================== *
 * fibbers-room — room tile that computes its own light state (off / N of M on /
 * offline; green glow when lit). Tap → sheet, hold → more-info.
 * ================================================================== */
import { LitElement, html, css, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { moreInfo, isUnavail, pickEntity } from "@shared/util";
import { cx } from "@shared/variants";
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

// True for `light.*` entity ids — string guard so a stray non-string can't throw.
const isLight = (id: unknown): id is string =>
  typeof id === "string" && id.startsWith("light.");

// HA's entity/device registries aren't on custom-card-helpers' HomeAssistant type;
// read them through a widened view (mirrors body-layer's dockedSidebar cast).
interface RegistryEntry {
  entity_id: string;
  area_id?: string | null;
  device_id?: string | null;
}
interface DeviceEntry {
  area_id?: string | null;
}
interface HassRegistries {
  entities?: Record<string, RegistryEntry>;
  devices?: Record<string, DeviceEntry>;
}

const EDITOR_SCHEMA = [
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  {
    name: "entities",
    selector: { entity: { domain: "light", multiple: true } },
  },
  { name: "area", selector: { area: {} } },
  { name: "sheet", selector: { text: {} } },
];

/** The computed light-state summary shown on the tile. */
interface RoomState {
  label: string;
  lit: boolean;
  offline: boolean;
}

/** YAML/editor config accepted by `fibbers-room`. */
export interface RoomConfig extends LovelaceCardConfig {
  name: string;
  icon?: string;
  entities?: string[];
  area?: string;
  sheet?: string;
  language?: string;
}

/**
 * fibbers-room — room tile that computes its own light state (off / N of M on /
 * offline, green glow when lit). Tap → sheet, hold → more-info.
 */
@customElement("fibbers-room")
export class FibbersRoom extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  @state() private config!: RoomConfig;

  private _timer?: ReturnType<typeof setTimeout>;

  private _held = false;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Starter config for the picker; seeds one light from the dashboard's entities. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): RoomConfig {
    return {
      type: "custom:fibbers-room",
      name: "Room",
      icon: "solar:sofa-2-bold-duotone",
      entities: [
        pickEntity("light", entities, entitiesFallback, "light.example"),
      ],
    };
  }

  /** Return the shared form editor, wired to this card's schema. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & {
      schema?: unknown;
    };
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Require a `name` and either explicit `entities` or an `area`; store the config. */
  setConfig(config: RoomConfig): void {
    if (!config || !config.name) {
      throw new Error("fibbers-room: `name` is required");
    }
    if (config.entities != null && !Array.isArray(config.entities)) {
      throw new Error("fibbers-room: `entities` must be a list");
    }
    if (config.entities == null && !config.area) {
      throw new Error("fibbers-room: provide `entities` or an `area`");
    }
    this.config = config;
  }

  private _entities(): string[] {
    const c = this.config;
    if (Array.isArray(c.entities)) return c.entities;
    // HA's entity/device registries aren't on custom-card-helpers' HomeAssistant
    // type; read them through a widened view (mirrors body-layer's cast).
    const hass = this.hass as unknown as HassRegistries | undefined;
    if (!c.area || !hass || !hass.entities) return [];
    const devices = hass.devices || {};
    return Object.values(hass.entities)
      .filter((e) => {
        const area = e.area_id || (devices[e.device_id ?? ""] || {}).area_id;
        return area === c.area && isLight(e.entity_id);
      })
      .map((e) => e.entity_id);
  }

  private _lights(): string[] {
    return this._entities().filter(isLight);
  }

  /** Cancel any pending long-press so it can't fire more-info after unmount. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._timer); // don't let a pending long-press fire after unmount
  }

  private _state(): RoomState {
    const { hass } = this;
    const hl = this.config.language || hass;
    const lights = this._lights();
    if (!hass || !lights.length)
      return { label: "—", lit: false, offline: false };
    let on = 0;
    let avail = 0;
    lights.forEach((id) => {
      const st = hass.states[id];
      if (isUnavail(st)) return;
      avail++;
      if (st.state === "on") on++;
    });
    if (avail === 0)
      return { label: t(hl, "room.offline"), lit: false, offline: true };
    if (on === 0)
      return { label: t(hl, "room.off"), lit: false, offline: false };
    return {
      label: t(hl, "room.state_count", { on, total: lights.length }),
      lit: true,
      offline: false,
    };
  }

  private _down(): void {
    this._held = false;
    // 500ms hold = long-press → more-info (vs a tap, which opens the sheet)
    this._timer = setTimeout(() => {
      this._held = true;
      this._moreInfo();
    }, 500);
  }

  private _up(): void {
    clearTimeout(this._timer);
  }

  private _click(): void {
    if (this._held) return;
    if (this.config.sheet) window.location.hash = this.config.sheet;
  }

  private _moreInfo(): void {
    const lights = this._lights();
    // Open focused on a lamp that is actually on ("N of M on" leads the user to
    // expect a live lamp), falling back to the first configured light.
    const id =
      lights.find((l) => this.hass?.states?.[l]?.state === "on") ||
      lights[0] ||
      this._entities()[0];
    if (!id) return;
    // Hand the modal the whole room so the light-detail card can switch between
    // this room's lamps in place instead of close/reopen per light.
    moreInfo(this, id, { siblings: lights, groupName: this.config.name });
  }

  /** The tile — icon, name, and computed light-state subline; glows when lit. */
  render(): TemplateResult {
    if (!this.config) return html``;
    const s = this._state();
    return html`<button
      type="button"
      class="${cx(
        "block w-full cursor-pointer rounded-[15px] border px-[13px] pb-3 pt-[13px] text-left transition-colors active:translate-y-[0.5px]",
        s.lit
          ? "border-[#2E5238] bg-[linear-gradient(145deg,#1E3427,#132016)]"
          : "border-line bg-card",
        s.offline && "opacity-[.66]",
      )}"
      @pointerdown=${this._down}
      @pointerup=${this._up}
      @pointercancel=${this._up}
      @pointerleave=${this._up}
      @click=${this._click}
    >
      <fib-icon
        class="${cx(
          "block h-[19px] w-[19px] [--mdc-icon-size:19px]",
          s.lit ? "text-accent" : "text-muted",
        )}"
        icon=${this.config.icon || "solar:home-angle-bold-duotone"}
      ></fib-icon>
      <div class="mt-2 text-[13px] font-semibold tracking-tight text-ink">
        ${this.config.name}
      </div>
      <div
        class="${cx("mt-0.5 text-[11px]", s.offline ? "text-red" : "text-muted")}"
      >
        ${s.label}
      </div>
    </button>`;
  }

  /** One masonry row. */
  getCardSize(): number {
    return 1;
  }

  /** Half-width (6-of-12) single-row footprint — two rooms per row. */
  getLayoutOptions(): { grid_columns: number; grid_rows: number } {
    return { grid_columns: 6, grid_rows: 1 };
  }

  /** Half-width by default, down to a quarter (min 3) when the grid is tight. */
  getGridOptions(): { columns: number; rows: string; min_columns: number } {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
