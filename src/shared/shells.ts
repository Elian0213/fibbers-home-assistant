/* ================================================================== *
 * shells — the small markup "components" every card repeats: the card surface,
 * the leading icon box, the not-available notice, section labels and label/value
 * rows. Same idea as ui.ts's control factories, one level up. Where a card's
 * shell carries bespoke attributes these can't express, keep the markup in the
 * card and use the class recipes from variants.ts instead.
 * ================================================================== */
import { html, nothing, type TemplateResult } from "lit";

import { t } from "@shared/i18n";
import { activateOnKey } from "@shared/ui";
import {
  card,
  cx,
  iconBox,
  sectionLabel as sectionLabelCls,
  type CardVariants,
  type IconBoxVariants,
  type SectionLabelVariants,
} from "@shared/variants";

/** Options for {@link cardShell}. */
export interface CardShellOptions {
  /** Extra layout classes on the surface (`flex items-center gap-2.5`, …). */
  cls?: string;
  pad?: CardVariants["pad"];
  /** Makes the surface a button: role/tabindex/click/Enter-Space wiring. */
  onTap?: () => void;
  /** Accessible name for a tappable shell. */
  label?: string;
}

/**
 * The card surface every tile shares. With `onTap` it renders as an accessible
 * button (role, tabindex, click + Enter/Space), matching the hand-rolled pattern.
 * @param inner — the card's content
 * @param opts — `{ cls, pad, onTap, label }`
 */
export function cardShell(
  inner: unknown,
  { cls = "", pad, onTap, label }: CardShellOptions = {},
): TemplateResult {
  if (!onTap) {
    return html`<div class="${cx(card({ pad }), cls)}">${inner}</div>`;
  }
  return html`<div
    class="${cx(card({ pad }), "cursor-pointer", cls)}"
    role="button"
    tabindex="0"
    aria-label=${label || nothing}
    @click=${onTap}
    @keydown=${activateOnKey(onTap)}
  >
    ${inner}
  </div>`;
}

/** Options for {@link iconBoxTpl}. */
export interface IconBoxOptions {
  size?: IconBoxVariants["size"];
  tone?: IconBoxVariants["tone"];
  flexNone?: IconBoxVariants["flexNone"];
  /** Classes for the inner `<fib-icon>` (sizing like `h-[18px] w-[18px] [--mdc-icon-size:18px]`) — pass literals, the Tailwind scanner needs to see them. */
  iconCls?: string;
  /** Extra classes on the box itself. */
  cls?: string;
}

/**
 * The rounded icon box leading most rows — `tone` carries the lit/idle state
 * (`on ? "accent" : "muted"`).
 * @param icon — solar:/mdi: icon name
 * @param opts — `{ size, tone, flexNone, iconCls, cls }`
 */
export function iconBoxTpl(
  icon: string,
  { size, tone, flexNone, iconCls = "", cls = "" }: IconBoxOptions = {},
): TemplateResult {
  return html`<div class="${cx(iconBox({ size, tone, flexNone }), cls)}">
    <fib-icon class=${iconCls} icon=${icon}></fib-icon>
  </div>`;
}

/**
 * The "Niet beschikbaar" card body shown when a card's entity is missing.
 * @param hl — hass / language hint for `t`
 */
export function unavailNotice(hl: unknown): TemplateResult {
  return html`<div class="${card()} text-[12px] text-muted">
    ${t(hl, "common.not_available")}
  </div>`;
}

/**
 * Uppercase section label.
 * @param text — rendered label (string or template)
 * @param opts — `{ tracking, cls }`
 */
export function sectionLabel(
  text: unknown,
  {
    tracking,
    cls = "",
  }: { tracking?: SectionLabelVariants["tracking"]; cls?: string } = {},
): TemplateResult {
  return html`<div class="${cx(sectionLabelCls({ tracking }), cls)}">
    ${text}
  </div>`;
}

/**
 * A `label … value` flex row (settings lists, detail panes).
 * @param label — left side
 * @param value — right side
 * @param cls — extra classes on the row
 */
export function labelValueRow(
  label: unknown,
  value: unknown,
  cls = "",
): TemplateResult {
  return html`<div
    class="${cx("flex items-center justify-between gap-2", cls)}"
  >
    <span class="text-[12px] font-medium text-ink">${label}</span>
    <span class="whitespace-nowrap text-[11px] text-muted">${value}</span>
  </div>`;
}
