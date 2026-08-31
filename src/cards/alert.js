/* ================================================================== *
 * CARD — fibbers-alert
 *
 * The "Aandacht nodig" card as real logic instead of 20 lines of Jinja. Runs a
 * list of checks against hass; shows an amber-tinted card with one line per
 * finding when anything fires, or a neutral card with a green tick and "Alles
 * in orde" when all is well. Tapping a finding opens more-info for its entity.
 * ================================================================== */
import { styleBlock } from "../tokens.js";

const friendly = (s) =>
  (s.attributes && s.attributes.friendly_name) || s.entity_id;
const isUnavail = (st) =>
  !st || st.state === "unavailable" || st.state === "unknown";

function runCheck(check, hass) {
  const states = Object.values(hass.states);
  const out = [];
  switch (check.type) {
    case "unavailable_lights": {
      const exclude = check.exclude || [];
      const offline = states.filter(
        (s) =>
          s.entity_id.startsWith("light.") &&
          !exclude.includes(s.entity_id) &&
          isUnavail(s),
      );
      if (offline.length)
        out.push({
          label: offline.length === 1 ? "Lamp offline" : "Lampen offline",
          detail: offline.map(friendly).join(", "),
          entity: offline[0].entity_id,
        });
      break;
    }
    case "low_battery": {
      const below = check.below != null ? check.below : 20;
      const pat = check.exclude_pattern
        ? new RegExp(check.exclude_pattern)
        : null;
      states
        .filter(
          (s) =>
            (s.attributes || {}).device_class === "battery" &&
            !isNaN(parseFloat(s.state)) &&
            parseFloat(s.state) < below &&
            !(pat && pat.test(s.entity_id)),
        )
        .forEach((s) =>
          out.push({
            label: "Batterij laag",
            detail: `${friendly(s)} (${s.state}%)`,
            entity: s.entity_id,
          }),
        );
      break;
    }
    case "updates": {
      const ups = states.filter(
        (s) => s.entity_id.startsWith("update.") && s.state === "on",
      );
      if (ups.length)
        out.push({
          label: "Updates",
          detail:
            ups.length === 1
              ? `1 update beschikbaar`
              : `${ups.length} updates beschikbaar`,
          entity: ups[0].entity_id,
        });
      break;
    }
    case "backup_age": {
      const st = hass.states[check.entity];
      const max = check.max_hours != null ? check.max_hours : 26;
      if (st && !isUnavail(st)) {
        const t = Date.parse(st.state);
        if (!isNaN(t)) {
          const hours = (Date.now() - t) / 3.6e6;
          if (hours > max)
            out.push({
              label: "Back-up",
              detail: `${Math.round(hours)} uur geleden`,
              entity: check.entity,
            });
        }
      }
      break;
    }
  }
  return out;
}

export class FibbersAlert extends HTMLElement {
  static getStubConfig() {
    return {
      type: "custom:fibbers-alert",
      checks: [{ type: "unavailable_lights" }, { type: "updates" }],
    };
  }

  setConfig(config) {
    if (!config || !Array.isArray(config.checks)) {
      throw new Error("fibbers-alert: `checks` must be a list");
    }
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._paint();
  }

  _findings() {
    if (!this._hass) return [];
    const out = [];
    this._config.checks.forEach((c) => {
      try {
        out.push(...runCheck(c, this._hass));
      } catch (_) {
        /* a bad check never breaks the card */
      }
    });
    return out;
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        ${styleBlock()}
        * { box-sizing: border-box; }
        .card {
          border-radius: 12px;
          border: 1px solid var(--fib-line);
          background: var(--fib-card);
          padding: 12px 13px;
        }
        .card[data-alert="true"] {
          background: var(--fib-amber-bg);
          border-color: var(--fib-amber-line);
        }
        .head { display: flex; align-items: center; gap: 8px; }
        .head fib-icon { --mdc-icon-size: 16px; width: 16px; height: 16px; color: var(--fib-green); }
        .card[data-alert="true"] .head fib-icon { color: var(--fib-amber); }
        .heading { font-size: 12px; font-weight: 600; color: var(--fib-green); }
        .card[data-alert="true"] .heading { color: var(--fib-amber); }
        .list { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; }
        .finding {
          font-size: 11.5px; line-height: 1.42; color: var(--fib-amber-tx);
          cursor: pointer; -webkit-tap-highlight-color: transparent;
        }
        .finding b { color: var(--fib-amber); font-weight: 600; }
      </style>
      <div class="card">
        <div class="head">
          <fib-icon></fib-icon>
          <span class="heading"></span>
        </div>
        <div class="list"></div>
      </div>`;
    this._paint();
  }

  _paint() {
    if (!this.shadowRoot) return;
    const card = this.shadowRoot.querySelector(".card");
    if (!card) return;
    const findings = this._findings();
    const alert = findings.length > 0;
    card.setAttribute("data-alert", String(alert));
    this.shadowRoot
      .querySelector(".head fib-icon")
      .setAttribute(
        "icon",
        alert
          ? "solar:danger-triangle-bold-duotone"
          : "solar:check-circle-bold-duotone",
      );
    this.shadowRoot.querySelector(".heading").textContent = alert
      ? "Aandacht nodig"
      : "Alles in orde";

    const list = this.shadowRoot.querySelector(".list");
    list.textContent = "";
    findings.forEach((f) => {
      const row = document.createElement("div");
      row.className = "finding";
      const b = document.createElement("b");
      b.textContent = f.label;
      row.append(b, document.createTextNode(` — ${f.detail}`));
      if (f.entity)
        row.addEventListener("click", () =>
          this.dispatchEvent(
            new CustomEvent("hass-more-info", {
              detail: { entityId: f.entity },
              bubbles: true,
              composed: true,
            }),
          ),
        );
      list.appendChild(row);
    });
  }

  getCardSize() {
    return 2;
  }

  getLayoutOptions() {
    return { grid_columns: "full", grid_rows: 2 };
  }
}
