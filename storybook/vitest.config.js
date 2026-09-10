import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dir = dirname(fileURLToPath(import.meta.url));

// Vitest browser-mode config for the Storybook addon: every story runs as a
// Chromium test (a render smoke test) plus the addon-a11y axe gate. This replaces
// the old jest-based @storybook/test-runner, which is unfixable on Node 20/22 under
// Storybook 10 (storybook#36116) and is deprecated in favour of this addon.
export default defineConfig({
  plugins: [storybookTest({ configDir: join(dir, ".storybook") })],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
    setupFiles: [join(dir, ".storybook/vitest.setup.js")],
  },
});
