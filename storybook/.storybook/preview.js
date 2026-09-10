import "../src/stubs.js"; // ha-icon + loadCardHelpers stubs, then loads the real bundle
import theme from "./theme.js";
import { setPreviewDark, setPreviewLang } from "../src/story.js";

/** @type {import('@storybook/web-components-vite').Preview} */
const preview = {
  parameters: {
    // The Vitest addon runs axe on every story and fails the run on violations.
    // Keep the dark theme's known muted-text contrast trade-off out of the gate
    // (documented in docs/accessibility.md); names, roles, aria, nesting stay
    // enforced.
    a11y: {
      test: "error",
      config: { rules: [{ id: "color-contrast", enabled: false }] },
    },
    layout: "centered",
    // stories are config-driven (each is a fixed YAML), so there are no args/controls
    controls: { hideNoControlsWarning: true },
    docs: { toc: true, theme, source: { language: "yaml" } },
    options: {
      storySort: {
        // Docs first, then the cards grouped into five functional categories,
        // then the composed page examples. The nested arrays set the order of the
        // sub-categories and of the cards within each.
        order: [
          "Introduction",
          "Getting Started",
          ["Installation", "Usage", "Theming"],
          "Cards",
          [
            "Shell & Navigation",
            ["Nav", "Back", "Section", "Sheet", "Greeting"],
            "Rooms, Lights & Scenes",
            [
              "Room",
              "Light Group",
              "Light Row",
              "Light Detail",
              "Scene",
              "Chips",
            ],
            "Status & Data",
            [
              "Alert",
              "Stat",
              "Graph",
              "Entities",
              "Presence",
              "Backup",
              "Weather",
              "Sysmon",
            ],
            "Devices & Media",
            ["Media", "Remote", "Climate"],
            "Inputs & Controls",
            ["Number", "Select", "Toggle", "Datetime", "Scheduler", "Alarm"],
          ],
          "Pages",
          ["Dashboard", "Gallery"],
        ],
      },
    },
  },

  // A light/dark switch in the toolbar. It seeds the mock hass's `themes.darkMode`
  // (setPreviewDark, consumed by src/story.js), so every card's real ThemeController
  // flips the palette — the same path Home Assistant drives at runtime.
  globalTypes: {
    theme: {
      description: "Fibbers light / dark theme",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: [
          { value: "dark", title: "Dark", icon: "circle" },
          { value: "light", title: "Light", icon: "circlehollow" },
        ],
        dynamicTitle: true,
      },
    },
    // Language selector. At runtime cards follow the Home Assistant account
    // language; here the toolbar seeds the mock hass's language (setPreviewLang,
    // consumed by src/story.js) so every card renders through the real i18n path.
    language: {
      description: "Card language (follows Home Assistant at runtime)",
      toolbar: {
        title: "Language",
        icon: "globe",
        items: [
          { value: "en", title: "English" },
          { value: "nl", title: "Nederlands" },
        ],
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (story, ctx) => {
      const isLight = ctx.globals.theme === "light";
      setPreviewDark(!isLight); // seed the mock hass darkMode before the story renders
      setPreviewLang(ctx.globals.language); // seed the mock hass language too

      const font =
        "font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
      const bg = isLight ? "#EEF1F0" : "#111516";
      const ink = isLight ? "#14201A" : "#EDF1F1";
      const line = isLight ? "#DFE4E1" : "#333E41";
      const glow = isLight
        ? "0 24px 60px rgba(20,32,26,.16)"
        : "0 24px 60px rgba(0,0,0,.45)";

      // Paint the canvas so the area around the phone frame follows the theme too
      // (skip in docs view, where the body is the docs page, not a single story).
      if (ctx.viewMode !== "docs") document.body.style.background = bg;

      // The Nav bar and the Sheet render into document.body (pinned to the iframe
      // viewport), and the Pages/* composed views want the full canvas too.
      // Everything else renders inline in a centered phone-screen panel. Match the
      // card segment (title ends with /Nav or /Sheet) so the "Shell & Navigation"
      // group name isn't mistaken for the Nav card.
      const title = ctx.title || "";
      const bodyRendered =
        /\/(Nav|Sheet)$/.test(title) || /^Pages(\/|$)/i.test(title);

      // clear a stale hash so a sheet from a previous story closes
      if (!/\/Sheet$/.test(title) && window.location.hash) {
        window.location.hash = "";
      }

      const wrap = document.createElement("div");
      if (bodyRendered) {
        wrap.style.cssText = `width:100%;min-height:100dvh;background:${bg};color:${ink};${font}`;
      } else {
        wrap.style.cssText =
          `width:360px;margin:0 auto;background:${bg};color:${ink};` +
          `border:1px solid ${line};border-radius:22px;padding:14px;` +
          `box-shadow:${glow};${font}`;
      }
      const node = story();
      if (node) wrap.appendChild(node);
      return wrap;
    },
  ],

  initialGlobals: {
    theme: "dark",
    language: "en",
  },
};

export default preview;
