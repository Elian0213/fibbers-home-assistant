/* ================================================================== *
 * fibbers-master — full-width master switch that turns off a whole scope at once
 * (lamps + media + switches). The subline lists the live blast radius, `hold`
 * guards the heavy instance with a progressive gesture, and every press snapshots
 * to a scene first so it can be undone for `undo` seconds.
 * ================================================================== */
import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t, langOf } from "@shared/i18n";
import { twSheet } from "@shared/tw";
import { ThemeController } from "@shared/theme-host";
import { isUnavail, pickEntity } from "@shared/util";
import { cx } from "@shared/variants";
import type {
  HomeAssistant,
  HassEntity,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
} from "@/types/home-assistant";
import "@shared/icon";

/** The four target lists a master switch resolves. */
export interface MasterTargets {
  /** `light.*` — off via light.turn_off. */
  lights?: string[];
  /** media_player entities that support turn_off. */
  media_off?: string[];
  /** media_player entities that don't (a Sonos) — stopped via media_stop. */
  media_stop?: string[];
  /** `switch.*` — off via switch.turn_off. */
  switches?: string[];
}

/** YAML/editor config accepted by `fibbers-master`. */
export interface MasterConfig extends LovelaceCardConfig {
  name?: string;
  /** `auto` builds a live inventory; a string pins it; `false` hides it. */
  subtitle?: "auto" | string | false;
  icon?: string;
  tone?: "accent" | "red";
  /** `hold` requires a deliberate press-and-hold before firing. */
  confirm?: "none" | "hold";
  hold_ms?: number;
  /** Seconds the undo affordance stays up; 0 disables the snapshot entirely. */
  undo?: number;
  targets: MasterTargets;
}

/** The undo receipt shown after a press, until it times out or is used. */
interface Receipt {
  time: string;
  sceneId: string;
}

const DEFAULT_ICON = "solar:power-bold-duotone";
const DEFAULT_HOLD_MS = 700;
const DEFAULT_UNDO_S = 12;
// A media_player is "on" for our purposes unless it is in one of these — standby
// counts as off (a Philips TV never reports plain "off"), and so does Sonos idle.
const MEDIA_OFF_STATES = ["off", "standby", "idle", "unavailable", "unknown"];
// media_stop targets only count as active while actually producing sound.
const MEDIA_PLAYING_STATES = ["playing", "buffering"];

const EDITOR_SCHEMA = [
  { name: "name", selector: { text: {} } },
  { name: "subtitle", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  {
    name: "tone",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "accent", label: "Accent" },
          { value: "red", label: "Red" },
        ],
      },
    },
  },
  {
    name: "confirm",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "none", label: "Tap" },
          { value: "hold", label: "Hold to confirm" },
        ],
      },
    },
  },
  { name: "hold_ms", selector: { number: { min: 100, mode: "box" } } },
  { name: "undo", selector: { number: { min: 0, mode: "box" } } },
  // Nested group: ha-form writes these under config.targets, matching the YAML.
  {
    name: "targets",
    type: "expandable",
    flatten: false,
    schema: [
      {
        name: "lights",
        selector: { entity: { domain: "light", multiple: true } },
      },
      {
        name: "media_off",
        selector: { entity: { domain: "media_player", multiple: true } },
      },
      {
        name: "media_stop",
        selector: { entity: { domain: "media_player", multiple: true } },
      },
      {
        name: "switches",
        selector: { entity: { domain: "switch", multiple: true } },
      },
    ],
  },
];

// A YAML/editor value → a clean string[] (drops non-strings, tolerates a scalar).
const list = (v: unknown): string[] => {
  if (Array.isArray(v))
    return v.filter((x): x is string => typeof x === "string");
  return typeof v === "string" ? [v] : [];
};

// A stable, filesystem-safe scene id per card instance so undo snapshots reuse one
// transient scene instead of accumulating one per press.
const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "master";

/**
 * fibbers-master — full-width master switch for a whole scope (lamps + media +
 * switches). Live blast-radius subline, optional hold-to-confirm, and a scene
 * snapshot so each press can be undone for a few seconds.
 */
@customElement("fibbers-master")
export class FibbersMaster extends LitElement implements LovelaceCard {
  @property({ attribute: false }) hass?: HomeAssistant;

  _theme = new ThemeController(this);

  @state() private config!: MasterConfig;

  // Live gesture/receipt state — drives the fill, the flash and the undo line.
  @state() private _arming = false;

  @state() private _flash = false;

  @state() private _receipt?: Receipt;

  private _holdTimer?: ReturnType<typeof setTimeout>;

  private _flashTimer?: ReturnType<typeof setTimeout>;

  private _undoTimer?: ReturnType<typeof setTimeout>;

  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
      /* The physical switch — bespoke sizing/shadow Tailwind can't express cleanly.
         --fib-tone is set per instance (accent | red) so on-state follows the tone. */
      .track {
        position: relative;
        width: 68px;
        height: 38px;
        flex: none;
        border-radius: 19px;
        background: var(--fib-line);
        overflow: hidden;
        transition: background-color 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .track.on {
        background: var(--fib-tone);
      }
      /* Hold fill — sweeps left→right over hold_ms; drains back on early release. */
      .fill {
        position: absolute;
        inset: 0;
        width: 0;
        background: var(--fib-tone);
        opacity: 0.55;
      }
      .knob {
        position: absolute;
        top: 4px;
        left: 4px;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--fib-card-2);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.35),
          0 1px 3px rgba(0, 0, 0, 0.35);
        transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
      }
      .track.on .knob {
        transform: translateX(30px);
        background: #fff;
      }
      /* Tone flash on completion. */
      .flash {
        position: absolute;
        inset: 0;
        background: var(--fib-tone);
        opacity: 0;
        pointer-events: none;
        border-radius: inherit;
      }
      .flash.show {
        opacity: 0.08;
        transition: opacity 200ms ease;
      }
      /* Reduced motion: the fill becomes a plain colour change, timing kept in JS. */
      @media (prefers-reduced-motion: reduce) {
        .track,
        .knob,
        .flash.show {
          transition: none;
        }
      }
    `,
  ];

  /** Seed config for the picker — the everyday lights-only, one-tap shape. */
  static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
    entitiesFallback: string[],
  ): MasterConfig {
    return {
      type: "custom:fibbers-master",
      name: "All lights off",
      icon: "solar:lightbulb-bolt-bold-duotone",
      tone: "accent",
      confirm: "none",
      targets: {
        lights: [
          pickEntity("light", entities, entitiesFallback, "light.example"),
        ],
      },
    };
  }

  /** Build the shared form editor bound to this card's schema. */
  static getConfigElement(): LovelaceCardEditor {
    const el = document.createElement(
      "fibbers-form-editor",
    ) as LovelaceCardEditor & { schema?: unknown };
    el.schema = EDITOR_SCHEMA;
    return el;
  }

  /** Validate + store; throws when `targets` has no resolvable list. */
  setConfig(config: MasterConfig): void {
    const targets = config && config.targets;
    const total = targets
      ? list(targets.lights).length +
        list(targets.media_off).length +
        list(targets.media_stop).length +
        list(targets.switches).length
      : 0;
    if (!total) {
      throw new Error("fibbers-master: `targets` needs at least one entity");
    }
    this.config = config;
  }

  /** Clear any pending timers so a gesture/receipt can't fire after unmount. */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this._holdTimer);
    clearTimeout(this._flashTimer);
    clearTimeout(this._undoTimer);
  }

  private _stateOf(id: string): HassEntity | undefined {
    return this.hass && this.hass.states[id];
  }

  private _tone(): "accent" | "red" {
    return this.config.tone === "red" ? "red" : "accent";
  }

  // Resolve each list to the entities that are currently active — the set a press
  // would actually change, and the set the subline/snapshot are built from.
  private _active(): {
    lights: string[];
    media: string[];
    switches: string[];
  } {
    const on = (id: string) => this._stateOf(id)?.state === "on";
    const media = (ids: string[], active: (s: string) => boolean) =>
      ids.filter((id) => {
        const st = this._stateOf(id);
        return st && !isUnavail(st) && active(st.state);
      });
    const { targets } = this.config;
    return {
      lights: list(targets.lights).filter(on),
      media: [
        ...media(list(targets.media_off), (s) => !MEDIA_OFF_STATES.includes(s)),
        ...media(list(targets.media_stop), (s) =>
          MEDIA_PLAYING_STATES.includes(s),
        ),
      ],
      switches: list(targets.switches).filter(on),
    };
  }

  private _isOn(): boolean {
    const a = this._active();
    return !!(a.lights.length || a.media.length || a.switches.length);
  }

  // The auto subline: lamps counted, everything else named. Empty → all-off text.
  private _autoSubtitle(): string {
    const hl = this.hass;
    const a = this._active();
    const parts: string[] = [];
    if (a.lights.length)
      parts.push(t(hl, "master.n_lamps", { count: a.lights.length }));
    const name = (id: string) =>
      this._stateOf(id)?.attributes.friendly_name || id;
    [...a.media, ...a.switches].forEach((id) => parts.push(String(name(id))));
    return parts.length ? parts.join(" · ") : t(hl, "master.all_off");
  }

  // --- firing --------------------------------------------------------

  private _reducedMotion(): boolean {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /**
   * Snapshot the active targets (for undo), then turn everything off at once —
   * lights fade while media/switches cut, no awaiting between them.
   */
  private async _fire(): Promise<void> {
    const { hass, config } = this;
    if (!hass) return;

    // A press inside the undo window cancels the receipt; the scope is already off
    // so there is nothing new to snapshot — never stack a second scene.
    if (this._receipt) this._clearReceipt();

    const a = this._active();
    const snapshot = [...a.lights, ...a.media, ...a.switches];
    if (!snapshot.length) return; // nothing on → a true no-op, no scene, no receipt

    const undoSecs = config.undo != null ? config.undo : DEFAULT_UNDO_S;
    let sceneId = "";
    if (undoSecs > 0) {
      sceneId = `fibbers_undo_${slug(config.name || "master")}`;
      // Await the snapshot before anything turns off, or undo restores nothing.
      await hass.callService("scene", "create", {
        scene_id: sceneId,
        snapshot_entities: snapshot,
      });
    }

    const { targets } = config;
    const lights = list(targets.lights).filter(
      (id) => this._stateOf(id)?.state === "on",
    );
    if (lights.length)
      hass.callService("light", "turn_off", {
        entity_id: lights,
        transition: 2,
      });
    const mediaOff = list(targets.media_off).filter((id) => {
      const st = this._stateOf(id);
      return st && !isUnavail(st) && !MEDIA_OFF_STATES.includes(st.state);
    });
    if (mediaOff.length)
      hass.callService("media_player", "turn_off", { entity_id: mediaOff });
    const mediaStop = list(targets.media_stop).filter((id) =>
      MEDIA_PLAYING_STATES.includes(this._stateOf(id)?.state ?? ""),
    );
    if (mediaStop.length)
      hass.callService("media_player", "media_stop", { entity_id: mediaStop });
    const switches = list(targets.switches).filter(
      (id) => this._stateOf(id)?.state === "on",
    );
    if (switches.length)
      hass.callService("switch", "turn_off", { entity_id: switches });

    this._confirmFeedback();
    if (undoSecs > 0) this._setReceipt(sceneId, undoSecs);
  }

  private _confirmFeedback(): void {
    navigator.vibrate?.(40); // no-op on iOS Safari, guarded elsewhere
    this._flash = true;
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this._flash = false;
    }, 200);
  }

  private _setReceipt(sceneId: string, secs: number): void {
    const time = new Date().toLocaleTimeString(langOf(this.hass), {
      hour: "2-digit",
      minute: "2-digit",
    });
    this._receipt = { time, sceneId };
    clearTimeout(this._undoTimer);
    this._undoTimer = setTimeout(() => this._clearReceipt(), secs * 1000);
  }

  private _clearReceipt(): void {
    clearTimeout(this._undoTimer);
    this._receipt = undefined;
  }

  private _undo(ev: Event): void {
    ev.stopPropagation();
    const r = this._receipt;
    if (!r || !this.hass) return;
    this.hass.callService("scene", "turn_on", {
      entity_id: `scene.${r.sceneId}`,
    });
    this._clearReceipt();
  }

  // --- gesture -------------------------------------------------------

  // Hold mode: start the fill and arm a timer; a full hold fires, an early release
  // drains and aborts. Tap mode: the press is handled on click instead.
  private _down(ev: PointerEvent): void {
    if (
      this.config.confirm !== "hold" ||
      (ev.button != null && ev.button !== 0)
    )
      return;
    this._startHold();
  }

  private _startHold(): void {
    if (this._arming) return;
    this._arming = true;
    const ms =
      this.config.hold_ms != null ? this.config.hold_ms : DEFAULT_HOLD_MS;
    clearTimeout(this._holdTimer);
    this._holdTimer = setTimeout(() => {
      this._arming = false;
      this._fire();
    }, ms);
  }

  private _abortHold(): void {
    if (!this._arming) return;
    clearTimeout(this._holdTimer);
    this._arming = false;
  }

  private _click(): void {
    // Tap mode fires on click; hold mode confirms via the timer, so ignore taps.
    if (this.config.confirm === "hold") return;
    this._fire();
  }

  private _keydown(ev: KeyboardEvent): void {
    if (ev.key !== " " && ev.key !== "Enter") return;
    ev.preventDefault();
    if (ev.repeat) return;
    if (this.config.confirm === "hold") this._startHold();
    else this._fire();
  }

  private _keyup(ev: KeyboardEvent): void {
    if (ev.key === " " || ev.key === "Enter") this._abortHold();
  }

  // --- render --------------------------------------------------------

  // The hold fill: sweep over hold_ms while arming, drain back otherwise. Under
  // reduced motion it snaps full (a plain colour change) — timing stays in JS.
  private _fillStyle(): string {
    if (!this._arming) return "width:0;transition:width 150ms ease";
    if (this._reducedMotion()) return "width:100%";
    const ms =
      this.config.hold_ms != null ? this.config.hold_ms : DEFAULT_HOLD_MS;
    return `width:100%;transition:width ${ms}ms linear`;
  }

  private _subtitle(): TemplateResult | string {
    const hl = this.hass;
    const r = this._receipt;
    if (r) {
      return html`${t(hl, "master.turned_off_at", { time: r.time })} ·
        <button
          type="button"
          class="font-medium text-ink underline decoration-dotted underline-offset-2"
          @click=${(e: Event) => this._undo(e)}
        >
          ${t(hl, "master.undo")}
        </button>`;
    }
    const sub = this.config.subtitle;
    if (sub === false) return "";
    if (typeof sub === "string" && sub !== "auto") return sub;
    return this._autoSubtitle();
  }

  /** The row — icon tile, name + live subline, and the physical switch. */
  render(): TemplateResult {
    const cfg = this.config;
    if (!cfg) return html``;
    const on = this._isOn();
    const tone = this._tone();
    const name = cfg.name || "";
    const icon = cfg.icon || DEFAULT_ICON;
    // Literal class strings per tone so Tailwind's scanner emits both palettes.
    let tile = "bg-card2 text-muted";
    if (tone === "red") tile = "bg-redbg text-red";
    else if (on) tile = "bg-accentbg text-accent";
    const cardTone =
      tone === "red" && on
        ? "border-redline bg-card shadow-[inset_0_0_0_1px_rgba(236,131,119,0.06)]"
        : "border-line bg-card";

    return html`<div
      class="${cx(
        "flex items-center gap-3 rounded-[14px] border px-[15px] py-[14px]",
        cardTone,
      )}"
      style="--fib-tone: var(--fib-${tone})"
      role="switch"
      tabindex="0"
      aria-checked=${on ? "true" : "false"}
      aria-label=${name || nothing}
      aria-describedby="sub"
      @pointerdown=${(e: PointerEvent) => this._down(e)}
      @pointerup=${() => this._abortHold()}
      @pointercancel=${() => this._abortHold()}
      @pointerleave=${() => this._abortHold()}
      @click=${() => this._click()}
      @keydown=${(e: KeyboardEvent) => this._keydown(e)}
      @keyup=${(e: KeyboardEvent) => this._keyup(e)}
    >
      <div
        class="${cx(
          "flex h-11 w-11 flex-none items-center justify-center rounded-[14px]",
          tile,
        )}"
      >
        <fib-icon
          class="h-[22px] w-[22px] [--mdc-icon-size:22px]"
          icon=${icon}
        ></fib-icon>
      </div>
      <div class="min-w-0 flex-1 select-none">
        <div class="truncate text-[17px] font-semibold text-ink">${name}</div>
        <div id="sub" class="truncate text-[13px] text-muted">
          ${this._subtitle()}
        </div>
      </div>
      <div class="track ${on ? "on" : ""}" aria-hidden="true">
        <div class="fill" style=${this._fillStyle()}></div>
        <div class="knob"></div>
        <div class="flash ${this._flash ? "show" : ""}"></div>
      </div>
    </div>`;
  }

  /** Roughly two chip rows tall — it shouldn't hide among the pills. */
  getCardSize(): number {
    return 2;
  }

  /** Sections view: full width, two rows. */
  getLayoutOptions(): { grid_columns: string; grid_rows: number } {
    return { grid_columns: "full", grid_rows: 2 };
  }

  /** Grid layout: full width, auto height. */
  getGridOptions(): { columns: string; rows: string } {
    return { columns: "full", rows: "auto" };
  }
}
