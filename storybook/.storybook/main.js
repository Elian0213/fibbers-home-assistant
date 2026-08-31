import remarkGfm from "remark-gfm";

/** @type {import('@storybook/web-components-vite').StorybookConfig} */
const config = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.js"],
  addons: [
    // essentials gives controls/backgrounds/viewport/toolbars; docs is provided
    // separately below so we can enable GitHub-flavoured Markdown (tables) in MDX.
    { name: "@storybook/addon-essentials", options: { docs: false } },
    {
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: { remarkPlugins: [remarkGfm] },
        },
      },
    },
    "@storybook/addon-a11y",
  ],
  framework: { name: "@storybook/web-components-vite", options: {} },
  async viteFinal(cfg) {
    // GitHub Pages serves this at a project subpath — use relative asset URLs.
    cfg.base = "./";
    // allow importing the built bundle from ../dist (outside the storybook root)
    cfg.server = cfg.server || {};
    cfg.server.fs = { ...(cfg.server.fs || {}), allow: [".", "..", "../.."] };
    return cfg;
  },
};
export default config;
