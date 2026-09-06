import "../src/stubs.js"; // ha-icon + loadCardHelpers stubs, then loads the real bundle
import theme from "./theme.js";

// The test-runner injects its own axe (axe-playwright); the addon's automatic
// run would collide with it ("Axe is already running"). Manual-only under tests.
const isTestRunner =
  typeof navigator !== "undefined" &&
  navigator.userAgent.includes("StorybookTestRunner");

/** @type {import('@storybook/web-components-vite').Preview} */
const preview = {
  parameters: {
    a11y: { manual: isTestRunner },
    layout: "centered",
    backgrounds: {
      default: "fibbers",
      values: [{ name: "fibbers", value: "#111516" }],
    },
    // stories are config-driven (each is a fixed YAML), so there are no args/controls
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
            "Light Group",
            "Light Row",
            "Sheet",
            "Alert",
            "Chips",
            "Scene",
            "Stat",
            "Graph",
            "Entities",
            "Presence",
            "Backup",
            "Weather",
            "Media",
            "Sysmon",
            "Scheduler",
            "Remote",
            "Climate",
            "Number",
            "Select",
            "Toggle",
            "Datetime",
            "Greeting",
          ],
          "Pages",
          ["Dashboard", "Gallery"],
        ],
      },
    },
  },
  decorators: [
    (story, ctx) => {
      const font =
        "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
      // Nav + Sheet render into document.body and pin to the iframe viewport, and the
      // Pages/* composed views want the full canvas too. Everything else renders inline
      // and looks best in a centered phone-screen panel.
      const bodyRendered = /Nav|Sheet|Pages/i.test(ctx.title || "");

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
