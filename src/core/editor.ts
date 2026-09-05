/* ================================================================== *
 * EDITOR — one shared visual editor for the cards that ship a form.
 *
 * Rather than hand-roll widgets, we render Home Assistant's own <ha-form> from a
 * per-card schema (entity/icon/text/boolean/select selectors). ha-form gives us
 * validation, theming and translations for free, and round-trips config-changed
 * so saving with no edits leaves the YAML byte-identical.
 *
 * A card wires it up in getConfigElement():
 *   static getConfigElement() {
 *     const el = document.createElement("fibbers-form-editor");
 *     el.schema = SCHEMA;          // [{ name, selector }, ...]
 *     el.labels = { name: "…" };   // optional name -> label overrides
 *     return el;
 *   }
 * ================================================================== */
import { LitElement, html, type TemplateResult } from "lit";

import type { HomeAssistant, LovelaceCardConfig } from "@/types/home-assistant";

/** One ha-form row — a field name paired with its HA selector descriptor. */
export interface FormSchemaRow {
  name: string;
  selector: unknown;
  [key: string]: unknown;
}

/**
 * Shared visual config editor for cards that ship a form — renders HA's own
 * <ha-form> from a per-card `schema`, so validation/theming/i18n come for free and
 * saving with no edits round-trips the YAML byte-identical. A card sets `.schema`
 * (and optional `.labels`) in its static getConfigElement().
 */
export class FibbersFormEditor extends LitElement {
  static properties = {
    hass: { attribute: false },
    schema: { attribute: false },
    labels: { attribute: false },
    _config: { state: true },
  };

  hass?: HomeAssistant;

  schema?: FormSchemaRow[];

  labels?: Record<string, string>;

  _config?: LovelaceCardConfig;

  /** Store the config ha-form edits and round-trips. */
  setConfig(config: LovelaceCardConfig): void {
    this._config = config;
  }

  // ha-form asks per row; fall back to a spaced-out field name so a missing label
  // is readable rather than a raw slug.
  _computeLabel = (row: FormSchemaRow): string =>
    (this.labels && this.labels[row.name]) ||
    row.name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

  // ha-form hands back the full config with the edited field merged in. Re-emit it
  // as config-changed; no change → no event → the saved YAML is unchanged.
  _valueChanged(ev: CustomEvent<{ value: LovelaceCardConfig }>): void {
    ev.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: ev.detail.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Render HA's <ha-form> from the schema; empty until hass, config and schema are set. */
  render(): TemplateResult {
    if (!this.hass || !this._config || !this.schema) return html``;
    return html`<ha-form
      .hass=${this.hass}
      .data=${this._config}
      .schema=${this.schema}
      .computeLabel=${this._computeLabel}
      @value-changed=${(ev: CustomEvent<{ value: LovelaceCardConfig }>) =>
        this._valueChanged(ev)}
    ></ha-form>`;
  }
}

if (!customElements.get("fibbers-form-editor"))
  customElements.define("fibbers-form-editor", FibbersFormEditor);
