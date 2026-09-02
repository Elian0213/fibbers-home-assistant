/* ================================================================== *
 * fibbers-remote — a real TV remote over `remote.send_command`, with the correct
 * command names per platform. The command family is derived from the entity's
 * integration (apple_tv → pyatv lowercase, philips_js → Cursor…/Standby, Android
 * TV → DPAD_…); `device:` overrides the guess and `commands:` overrides per key.
 * Point `media_player:` at the player for now-playing, a select_source grid and a
 * volume slider. Buttons a platform doesn't support aren't rendered.
 * ================================================================== */
import { LitElement, html, css, nothing } from "lit";

import { t } from "../i18n.js";
import { twSheet } from "../tw.js";
import { sliderTrack, overflowChips, SliderHold } from "../ui.js";
import { pickEntity, pctFromX, isUnavail } from "../util.js";
import "../icon.js";

// Per-platform command names. A key absent here (and from `commands:`) means the
// device can't do it, so that button doesn't render.
const COMMANDS = {
  appletv: {
    up: "up",
    down: "down",
    left: "left",
    right: "right",
    ok: "select",
    menu: "menu",
    home: "home",
    back: "menu",
    play: "play_pause",
    next: "next",
    previous: "previous",
    volume_up: "volume_up",
    volume_down: "volume_down",
  },
  philips: {
    up: "CursorUp",
    down: "CursorDown",
    left: "CursorLeft",
    right: "CursorRight",
    ok: "Confirm",
    back: "Back",
    home: "Home",
    play: "Play",
    volume_up: "VolumeUp",
    volume_down: "VolumeDown",
    volume_mute: "Mute",
    channel_up: "ChannelStepUp",
    channel_down: "ChannelStepDown",
    power: "Standby",
  },
  androidtv: {
    power: "POWER",
    up: "DPAD_UP",
    down: "DPAD_DOWN",
    left: "DPAD_LEFT",
    right: "DPAD_RIGHT",
    ok: "DPAD_CENTER",
    back: "BACK",
    home: "HOME",
    menu: "MENU",
    volume_up: "VOLUME_UP",
    volume_down: "VOLUME_DOWN",
    volume_mute: "MUTE",
    channel_up: "CHANNEL_UP",
    channel_down: "CHANNEL_DOWN",
    previous: "MEDIA_PREVIOUS",
    next: "MEDIA_NEXT",
    play: "MEDIA_PLAY_PAUSE",
  },
  generic: {},
};

const PLATFORM_DEVICE = {
  apple_tv: "appletv",
  philips_js: "philips",
  androidtv: "androidtv", // the media_player platform
  androidtv_remote: "androidtv", // the remote.* platform that uses these keycodes
};

const DEVICE_ICON = {
  appletv: "solar:tv-bold-duotone",
  philips: "solar:tv-bold-duotone",
  androidtv: "solar:tv-bold-duotone",
  generic: "solar:gamepad-bold-duotone",
};

// A remote/player is "off" in any of these — so `unknown` isn't treated as on
// (used for the header dot and the Apple TV power direction).
const OFF_STATES = ["off", "standby", "unavailable", "unknown"];

export class FibbersRemote extends LitElement {
  static properties = {
    hass: { attribute: false },
    _config: { state: true },
    _dragging: { state: true },
    _dragVol: { state: true },
    _srcOpen: { state: true },
    _platform: { state: true },
    _flash: { state: true },
  };
  static styles = [
    twSheet,
    css`
      :host {
        display: block;
      }
    `,
  ];

  static getStubConfig(hass, entities, entitiesFallback) {
    return {
      type: "custom:fibbers-remote",
      entity: pickEntity(
        "remote",
        entities,
        entitiesFallback,
        "remote.example",
      ),
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("fibbers-remote: `entity` (a remote.*) is required");
    }
    if (
      config.sources != null &&
      config.sources !== "auto" &&
      !Array.isArray(config.sources)
    ) {
      throw new Error('fibbers-remote: `sources` must be "auto" or a list');
    }
    if (config.device != null && !COMMANDS[config.device]) {
      throw new Error(
        'fibbers-remote: `device` must be "appletv", "philips", "androidtv" or "generic"',
      );
    }
    if (config.device === "generic" && !config.commands) {
      throw new Error(
        "fibbers-remote: `device: generic` makes no command assumptions — provide a `commands:` map",
      );
    }
    if (
      config.dpad != null &&
      !["swipe", "buttons", "both"].includes(config.dpad)
    ) {
      throw new Error(
        'fibbers-remote: `dpad` must be "swipe", "buttons" or "both"',
      );
    }
    if ((config.sources || config.favourites) && !config.media_player) {
      throw new Error(
        "fibbers-remote: `sources`/`favourites` need a `media_player:` — they call media_player.select_source",
      );
    }
    this._config = config;
    this._dragging = false;
    this._dragVol = 0;
    this._srcOpen = false;
    // HA reuses card elements and calls setConfig per keystroke in the editor:
    // re-resolve the platform and reset the warn/flash state for the new entity,
    // else an apple_tv → philips_js swap keeps sending pyatv names to a Philips TV.
    this._platform = undefined;
    this._platformTried = false;
    this._warned = null;
    // Construct the hold once — SliderHold.addController has no removeController,
    // so a new one per setConfig would orphan controllers in the editor.
    if (!this._volHold) this._volHold = new SliderHold(this, { tolerance: 2 });
  }

  connectedCallback() {
    super.connectedCallback();
    this._onHidden = () => {
      if (document.hidden) this._release();
    };
    document.addEventListener("visibilitychange", this._onHidden);
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    this._release(); // a held button must not keep firing after unmount
    clearTimeout(this._flashTimer);
    document.removeEventListener("visibilitychange", this._onHidden);
  }

  // Resolve the entity's integration once, so the default command family is right
  // without the user picking. Unknown platform → generic (needs `commands:`).
  updated(changed) {
    if (changed.has("hass")) this._resolvePlatform();
  }
  async _resolvePlatform() {
    if (this._platformTried || !this.hass || !this.hass.callWS) return;
    this._platformTried = true;
    try {
      const reg = await this.hass.callWS({
        type: "config/entity_registry/get",
        entity_id: this._config.entity,
      });
      if (reg && reg.platform) this._platform = reg.platform;
    } catch (_) {
      /* left undefined → generic */
    }
  }

  _device() {
    return this._config.device || PLATFORM_DEVICE[this._platform] || "generic";
  }
  // The command string for a logical key: `commands:` override, else the device
  // map. undefined → the platform can't do it (button won't render).
  _cmd(key) {
    const override = (this._config.commands || {})[key];
    if (override != null) return override;
    return (COMMANDS[this._device()] || {})[key];
  }

  _mp() {
    const id = this._config.media_player;
    return id && this.hass ? this.hass.states[id] : null;
  }
  _st() {
    return this.hass && this.hass.states[this._config.entity];
  }
  _unavail() {
    return isUnavail(this._st());
  }

  // A rejected send_command dies silently in a fire-and-forget call; catch it,
  // warn once per key with the command + platform, and flash the button — a dead
  // remote shouldn't look identical to a working one.
  async _send(key) {
    const cmd = this._cmd(key);
    if (!cmd || !this.hass || this._unavail()) return;
    try {
      await this.hass.callService("remote", "send_command", {
        entity_id: this._config.entity,
        command: cmd,
      });
    } catch (e) {
      this._flashFail(key, e, cmd);
    }
  }

  _flashFail(key, e, cmd) {
    this._warned = this._warned || new Set();
    if (!this._warned.has(key)) {
      this._warned.add(key);
      console.warn(
        `[fibbers-remote] command "${cmd || key}" was rejected by ${this._config.entity} ` +
          `(platform: ${this._platform || "unknown"}). ${e && e.message ? e.message : e}`,
      );
    }
    this._flash = key;
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      this._flash = null;
    }, 500);
  }

  // Apple TV power lives on the remote's own turn_on/turn_off/toggle services, not
  // in the command map; direction follows the remote entity's own state.
  _power() {
    if (this._device() !== "appletv") return this._send("power");
    if (!this.hass || this._unavail()) return;
    const st = this._st();
    const on = st ? !OFF_STATES.includes(st.state) : null;
    const svc = on === null ? "toggle" : on ? "turn_off" : "turn_on";
    this.hass
      .callService("remote", svc, { entity_id: this._config.entity })
      .catch((e) => this._flashFail("power", e, `remote.${svc}`));
  }

  _mpService(service, data) {
    const mp = this._mp();
    if (mp && this.hass)
      this.hass.callService("media_player", service, {
        entity_id: mp.entity_id,
        ...data,
      });
  }

  // Long-press repeat, bounded: ~3/s (not 7/s), capped, and stopped on release /
  // cancel / lost capture / the tab hiding (handled in connectedCallback).
  _hold(key) {
    if (this._unavail()) return;
    this._release();
    this._send(key);
    let count = 0;
    this._repeat = setInterval(() => {
      if ((count += 1) > 40) return this._release(); // hard cap ~12s
      return this._send(key);
    }, 300);
  }
  _release() {
    clearInterval(this._repeat);
    this._repeat = null;
  }

  _allSources() {
    const cfg = this._config;
    if (!cfg.sources) return [];
    const mp = this._mp();
    return cfg.sources === "auto"
      ? ((mp && mp.attributes.source_list) || []).map((s) => ({
          name: s,
          source: s,
        }))
      : cfg.sources.map((s) =>
          typeof s === "string" ? { name: s, source: s } : s,
        );
  }
  _favSources(all) {
    const favs = this._config.favourites;
    if (!Array.isArray(favs) || !favs.length) return null;
    const byValue = new Map(all.map((s) => [s.source || s.name, s]));
    return favs.map((f) => byValue.get(f) || { name: f, source: f });
  }

  _setVol(pct) {
    this._volHold.hold(pct);
    this._mpService("volume_set", { volume_level: pct / 100 });
  }
  _volDown(e) {
    this._dragging = true;
    e.currentTarget.setPointerCapture &&
      e.currentTarget.setPointerCapture(e.pointerId);
    this._dragVol = Math.round(pctFromX(e.clientX, e.currentTarget));
  }
  _volMove(e) {
    if (this._dragging)
      this._dragVol = Math.round(pctFromX(e.clientX, e.currentTarget));
  }
  _volUp(e) {
    if (!this._dragging) return;
    const v = Math.round(pctFromX(e.clientX, e.currentTarget));
    this._dragging = false;
    this._setVol(v);
  }

  // --- render helpers ------------------------------------------------

  _flashCls(key) {
    return this._flash === key ? "opacity-40" : "";
  }

  // A round button; ≥44px. `key` (optional) drives the rejected-command flash.
  _round(
    label,
    icon,
    onClick,
    size = "h-[var(--fib-hit)] w-[var(--fib-hit)]",
    key,
  ) {
    return html`<button
      type="button"
      aria-label=${label}
      class="flex ${size} flex-none items-center justify-center rounded-full bg-card2
             text-ink transition-transform active:scale-90 ${this._flashCls(key)}"
      @click=${onClick}
    >
      <fib-icon
        class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  _holdBtn(label, icon, key) {
    if (!this._cmd(key)) return "";
    return html`<button
      type="button"
      aria-label=${label}
      class="flex h-[var(--fib-hit)] w-[var(--fib-hit)] flex-none items-center justify-center rounded-full bg-card2
             text-ink transition-transform active:scale-90 ${this._flashCls(key)}"
      @pointerdown=${() => this._hold(key)}
      @pointerup=${() => this._release()}
      @pointercancel=${() => this._release()}
      @pointerleave=${() => this._release()}
      @lostpointercapture=${() => this._release()}
      @click=${(e) => {
        if (e.detail === 0) this._send(key); // keyboard activation (no repeat)
      }}
    >
      <fib-icon
        class="h-[20px] w-[20px] [--mdc-icon-size:20px]"
        icon=${icon}
      ></fib-icon>
    </button>`;
  }

  // Keyboard for the swipe d-pad (which has no arrow buttons to Tab to).
  _dpadKey(e) {
    const map = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      Enter: "ok",
      " ": "ok",
    };
    const key = map[e.key];
    if (!key) return;
    e.preventDefault();
    this._send(key);
  }

  _swipeStart(e) {
    this._sw = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture &&
      e.currentTarget.setPointerCapture(e.pointerId);
  }
  _swipeEnd(e) {
    const s = this._sw;
    this._sw = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 24) return this._send("ok"); // tap
    return this._send(
      Math.abs(dx) > Math.abs(dy)
        ? dx > 0
          ? "right"
          : "left"
        : dy > 0
          ? "down"
          : "up",
    );
  }

  _dpad() {
    const has = (k) => !!this._cmd(k);
    // No directional commands (e.g. generic with none) → no d-pad of dead buttons.
    if (!["up", "down", "left", "right", "ok"].some(has)) return "";
    const mode =
      this._config.dpad || (this._device() === "appletv" ? "both" : "buttons");
    const swipe = mode !== "buttons";
    const buttons = mode !== "swipe";
    // Buttons win over the swipe surface: stop the container from also seeing it.
    const stop = swipe ? (e) => e.stopPropagation() : undefined;
    const arrow = (key, icon, label, pos) =>
      has(key)
        ? html`<button
            type="button"
            aria-label=${label}
            class="absolute ${pos} flex h-14 w-14 items-center justify-center rounded-full
                 text-ink transition-transform hover:bg-card active:scale-90 ${this._flashCls(
                   key,
                 )}"
            @pointerdown=${stop}
            @click=${() => this._send(key)}
          >
            <fib-icon
              class="h-[24px] w-[24px] [--mdc-icon-size:24px]"
              icon=${icon}
            ></fib-icon>
          </button>`
        : "";
    const label = !swipe
      ? "D-pad"
      : buttons
        ? "D-pad — swipe, tap an arrow, or use the arrow keys"
        : "D-pad — swipe or use the arrow keys";
    return html`<div
      class="relative mx-auto aspect-square w-full max-w-[260px] touch-none rounded-full
             bg-card2 ${swipe ? "cursor-pointer" : ""}"
      role="group"
      aria-label=${label}
      tabindex=${swipe ? 0 : nothing}
      @keydown=${swipe ? this._dpadKey : undefined}
      @pointerdown=${swipe ? this._swipeStart : undefined}
      @pointerup=${swipe ? this._swipeEnd : undefined}
      @pointercancel=${swipe ? () => (this._sw = null) : undefined}
    >
      ${
        buttons
          ? html`${arrow(
              "up",
              "solar:alt-arrow-up-bold-duotone",
              "Up",
              "left-1/2 top-2 -translate-x-1/2",
            )}
            ${arrow(
              "down",
              "solar:alt-arrow-down-bold-duotone",
              "Down",
              "bottom-2 left-1/2 -translate-x-1/2",
            )}
            ${arrow(
              "left",
              "solar:alt-arrow-left-bold-duotone",
              "Left",
              "left-2 top-1/2 -translate-y-1/2",
            )}
            ${arrow(
              "right",
              "solar:alt-arrow-right-bold-duotone",
              "Right",
              "right-2 top-1/2 -translate-y-1/2",
            )}`
          : ""
      }
      ${
        has("ok")
          ? html`<button
              type="button"
              aria-label="OK"
              class="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2
                   items-center justify-center rounded-full bg-accentbg text-accent
                   shadow-[0_1px_3px_rgba(0,0,0,.4)] transition-transform active:scale-90 ${this._flashCls(
                     "ok",
                   )}"
              @pointerdown=${stop}
              @click=${() => this._send("ok")}
            >
              <span class="text-[15px] font-semibold">OK</span>
            </button>`
          : ""
      }
    </div>`;
  }

  _transport() {
    const mp = this._mp();
    const playIcon =
      mp && mp.state === "playing"
        ? "solar:pause-bold-duotone"
        : "solar:play-bold-duotone";
    const tp = (label, icon, key, mpService) => {
      if (!this._cmd(key) && !mp) return "";
      return this._round(
        label,
        icon,
        mp ? () => this._mpService(mpService) : () => this._send(key),
        "h-[var(--fib-hit)] w-[var(--fib-hit)]",
        key,
      );
    };
    const nav = (label, icon, key) =>
      this._cmd(key)
        ? this._round(
            label,
            icon,
            () => this._send(key),
            "h-[var(--fib-hit)] w-[var(--fib-hit)]",
            key,
          )
        : "";
    const transport = [
      tp(
        "Previous",
        "solar:skip-previous-bold-duotone",
        "previous",
        "media_previous_track",
      ),
      tp("Play / pause", playIcon, "play", "media_play_pause"),
      tp("Next", "solar:skip-next-bold-duotone", "next", "media_next_track"),
    ];
    // Apple TV aliases Back → menu; render Menu only when it's a distinct command.
    const showMenu =
      this._cmd("menu") && this._cmd("menu") !== this._cmd("back");
    const navs = [
      nav("Back", "solar:arrow-left-bold-duotone", "back"),
      nav("Home", "solar:home-2-bold-duotone", "home"),
      showMenu ? nav("Menu", "solar:menu-dots-bold-duotone", "menu") : "",
    ];
    const hasT = transport.some((x) => x !== "");
    const hasN = navs.some((x) => x !== "");
    if (!hasT && !hasN) return "";
    return html`<div class="flex flex-wrap items-center justify-center gap-2.5">
      ${transport}
      ${
        hasT && hasN
          ? html`<span class="mx-0.5 h-8 w-px flex-none bg-line"></span>`
          : ""
      }
      ${navs}
    </div>`;
  }

  _volume() {
    const mp = this._mp();
    const hasSlider = mp && mp.attributes.volume_level != null;
    const hasVolCmd = this._cmd("volume_up");
    const muted = mp && mp.attributes.is_volume_muted;
    const hasChannel = this._cmd("channel_up");
    const channel = hasChannel
      ? html`${this._holdBtn(
            "Channel down",
            "solar:alt-arrow-down-bold-duotone",
            "channel_down",
          )}
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
            >CH</span
          >
          ${this._holdBtn(
            "Channel up",
            "solar:alt-arrow-up-bold-duotone",
            "channel_up",
          )}`
      : "";

    if (hasSlider) {
      // If the player drops out mid-hold, release the optimistic value instead of
      // freezing the knob on it until the timeout.
      const gone = !mp || ["unavailable", "unknown", "off"].includes(mp.state);
      const vol = this._volHold.value(
        Math.round(mp.attributes.volume_level * 100),
        { dragging: this._dragging, dragValue: this._dragVol, gone },
      );
      return html`<div class="flex flex-col gap-3">
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Mute"
            aria-pressed=${muted ? "true" : "false"}
            class="fib-hit flex h-9 w-9 flex-none items-center justify-center rounded-full
                   ${muted ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
            @click=${() =>
              this._mpService("volume_mute", { is_volume_muted: !muted })}
          >
            <fib-icon
              class="h-4 w-4 [--mdc-icon-size:16px]"
              icon=${
                muted
                  ? "solar:volume-cross-bold-duotone"
                  : "solar:volume-small-bold-duotone"
              }
            ></fib-icon>
          </button>
          ${sliderTrack({
            pct: vol,
            disabled: gone,
            cls: "flex-1",
            label: "Volume",
            value: vol,
            min: 0,
            max: 100,
            step: 5,
            valueText: `${vol}%`,
            onInput: (v) => this._setVol(v),
            onDown: this._volDown,
            onMove: this._volMove,
            onUp: this._volUp,
            onCancel: () => {
              this._dragging = false;
              this._volHold.clear();
            },
          })}
          <fib-icon
            class="h-4 w-4 flex-none [--mdc-icon-size:16px] text-muted"
            icon="solar:volume-loud-bold-duotone"
          ></fib-icon>
        </div>
        ${
          hasChannel
            ? html`<div class="flex items-center justify-center gap-2.5">
                ${channel}
              </div>`
            : ""
        }
      </div>`;
    }

    if (!hasVolCmd && !hasChannel) return "";
    return html`<div class="flex flex-wrap items-center justify-center gap-2.5">
      ${
        hasVolCmd
          ? html`${this._holdBtn(
              "Volume down",
              "solar:volume-small-bold-duotone",
              "volume_down",
            )}
            ${
              this._cmd("volume_mute")
                ? this._round(
                    "Mute",
                    "solar:volume-cross-bold-duotone",
                    () => this._send("volume_mute"),
                    "h-[var(--fib-hit)] w-[var(--fib-hit)]",
                    "volume_mute",
                  )
                : ""
            }
            ${this._holdBtn(
              "Volume up",
              "solar:volume-loud-bold-duotone",
              "volume_up",
            )}`
          : ""
      }
      ${
        hasVolCmd && hasChannel
          ? html`<span class="mx-0.5 h-8 w-px flex-none bg-line"></span>`
          : ""
      }
      ${channel}
    </div>`;
  }

  render() {
    const cfg = this._config;
    if (!cfg) return html``;
    const hl = cfg.language || this.hass;
    const mp = this._mp();
    const rst = this._st();
    // The dot follows the remote entity's own state (it works with no media_player).
    const on = rst
      ? !OFF_STATES.includes(rst.state)
      : mp
        ? !OFF_STATES.includes(mp.state)
        : null;
    const nowLine = mp
      ? mp.attributes.media_title ||
        mp.attributes.app_name ||
        mp.attributes.source ||
        t(hl, on ? "remote.on" : "remote.off")
      : "";
    const all = this._allSources();
    const collapsed = this._favSources(all);
    const activeSource = mp && mp.attributes.source;

    return html`<div
      class="flex flex-col gap-3 rounded-[14px] border border-line bg-card p-[13px]
             ${this._unavail() ? "opacity-50" : ""}"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]
                 ${on ? "bg-accentbg text-accent" : "bg-card2 text-muted"}"
        >
          <fib-icon
            class="h-[19px] w-[19px] [--mdc-icon-size:19px]"
            icon=${DEVICE_ICON[this._device()] || DEVICE_ICON.generic}
          ></fib-icon>
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-[12px] font-semibold text-ink">
            ${cfg.name || t(hl, "remote.default_name")}
          </div>
          <div class="truncate text-[10.5px] text-muted">${nowLine}</div>
        </div>
        ${this._round(
          "Power",
          "solar:power-bold-duotone",
          () => this._power(),
          "h-[var(--fib-hit)] w-[var(--fib-hit)]",
          "power",
        )}
      </div>

      ${this._dpad()} ${this._transport()} ${this._volume()}
      ${
        all.length
          ? overflowChips({
              hl,
              all,
              collapsed,
              activeValue: activeSource,
              open: this._srcOpen,
              onToggle: () => {
                this._srcOpen = !this._srcOpen;
              },
              onSelect: (s) =>
                this._mpService("select_source", {
                  source: s.source || s.name,
                }),
            })
          : ""
      }
    </div>`;
  }

  getCardSize() {
    return 4;
  }
  getLayoutOptions() {
    return { grid_columns: 6, grid_rows: 4 };
  }
  getGridOptions() {
    return { columns: 6, rows: "auto", min_columns: 3 };
  }
}
