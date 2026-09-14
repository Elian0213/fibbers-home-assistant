/* ================================================================== *
 * fibbers-remote — the host contract the view components (components/*) render
 * against. The `FibbersRemote` element implements it and passes `this` to each
 * view fn (mirrors `LightDetailHost`). Its own file so components never import
 * the element module — no import cycles.
 * ================================================================== */
import type { SliderController } from "@shared/ui";
import type { HomeAssistant, HassEntity } from "@/types/home-assistant";

import type { RemoteDevice } from "./config";
import type { TouchpadController } from "./touchpad-controller";

/** The card surface the view components read state from and drive actions through. */
export interface RemoteHost {
  hass?: HomeAssistant;

  // read state
  readonly devices: RemoteDevice[];
  readonly sel: number;
  readonly flash: string | null;
  readonly srcOpen: boolean;
  readonly vol: SliderController;

  // current device
  dev(): RemoteDevice;
  mp(): HassEntity | null;
  /** The media_player this device's volume row drives (may differ from `mp()`). */
  volMp(): HassEntity | null;
  /** Fire-and-forget media_player call against the volume player. */
  volDo(service: string, data?: Record<string, unknown>): void;
  /** True when the volume row is driven by a player other than the device's own. */
  volDelegated(): boolean;
  kindOf(d: RemoteDevice): string;
  cmd(key: string): string | undefined;
  unavail(): boolean;

  // the touchpad gesture controller (dpad: touchpad)
  readonly touchpad: TouchpadController;

  // actions
  send(key: string): Promise<void>;
  power(): Promise<void> | void;
  mpDo(service: string, data?: Record<string, unknown>): void;
  select(i: number): void;
  hold(fn: () => void): void;
  release(): void;
  toggleSrc(): void;
  volPct(): number;

  // pre-bound gesture bundles (stable listener identity)
  readonly swipe: {
    start(e: PointerEvent): void;
    end(e: PointerEvent): void;
    cancel(): void;
  };
  readonly scrub: {
    step(dir: number): void;
    stepThrottled(dir: number): void;
    down(e: PointerEvent): void;
    move(e: PointerEvent): void;
    up(): void;
    active(): boolean;
  };

  // controls panel
  ctlSlider(entity: string): SliderController | undefined;
  ctlValue(entity: string, s: SliderController): number;
  ctlDo(domain: string, service: string, data?: Record<string, unknown>): void;
  ctlOpen(entity: string): boolean;
  ctlToggle(entity: string): void;
}
