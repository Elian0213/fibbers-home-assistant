import "../src/stubs.js"; // ha-icon + loadCardHelpers stubs, then loads the real bundle
import theme from "./theme.js";

/** @type {import('@storybook/web-components-vite').Preview} */
const preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "fibbers",
      values: [{ name: "fibbers", value: "#111516" }],
    },
    controls: { hideNoControlsWarning: true },
    docs: { toc: true, theme, source: { language: "yaml" } },
    options: {
      storySort: {
        order: [
          "Introduction",
          "Getting Started",
          ["Installation", "Usage", "Theming"],
          "Cards",
          [
            "Nav",
            "Back",
            "Section",
            "Room",
            "Light Row",
            "Sheet",
            "Alert",
            "Chips",
            "Scene",
          ],
        ],
      },
    },
  },
  decorators: [
    (story, ctx) => {
      const font =
        "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
      // Nav + Sheet render into document.body and pin to the iframe viewport, so they
      // want a full-bleed canvas (their metas set layout:"fullscreen"). Everything else
      // renders inline and looks best in a centered phone-screen panel.
      const bodyRendered = /Nav|Sheet/i.test(ctx.title || "");

      // clear a stale hash so a sheet from a previous story closes
      if (!/Sheet/i.test(ctx.title || "") && window.location.hash) {
        window.location.hash = "";
      }

      const wrap = document.createElement("div");
      if (bodyRendered) {
        wrap.style.cssText =
          "width:100%;min-height:100dvh;background:#111516;color:#EDF1F1;" +
          font;
      } else {
        wrap.style.cssText =
          "width:360px;margin:0 auto;background:#111516;color:#EDF1F1;" +
          "border:1px solid #333E41;border-radius:22px;padding:14px;" +
          "box-shadow:0 24px 60px rgba(0,0,0,.45);" +
          font;
      }
      const node = story();
      if (node) wrap.appendChild(node);
      return wrap;
    },
  ],
};

export default preview;
