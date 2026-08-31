import { create } from "@storybook/theming";
import logo from "./assets/fibbers-logo.svg";

// Fibbers' dark, forest-green identity applied to the Storybook chrome + docs.
export default create({
  base: "dark",

  brandTitle: "Fibbers",
  brandUrl: "https://github.com/Elian0213/fibbers-home-assistant",
  brandImage: logo,
  brandTarget: "_blank",

  colorPrimary: "#74B98A",
  colorSecondary: "#74B98A",

  // app chrome
  appBg: "#111516",
  appContentBg: "#111516",
  appPreviewBg: "#111516",
  appBorderColor: "#333E41",
  appBorderRadius: 10,

  // text
  textColor: "#EDF1F1",
  textInverseColor: "#111516",
  textMutedColor: "#7D8B8E",

  // toolbar / sidebar
  barBg: "#161C1E",
  barTextColor: "#A9B6B9",
  barSelectedColor: "#74B98A",
  barHoverColor: "#74B98A",

  // form inputs
  inputBg: "#1D2426",
  inputBorder: "#333E41",
  inputTextColor: "#EDF1F1",
  inputBorderRadius: 8,

  fontBase:
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontCode: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
});
