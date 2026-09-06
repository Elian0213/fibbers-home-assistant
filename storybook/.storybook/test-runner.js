/* global expect -- jest global inside the test-runner sandbox */
/* Test-runner hooks: every story is a smoke test for free; on top of that each
 * story gets an axe pass (critical/serious fail the run, minor findings only
 * log) and, when VRT=1, a screenshot compared against the committed Linux
 * baseline (Windows fonts render differently — never generate baselines here). */
const { getStoryContext } = require("@storybook/test-runner");
const { injectAxe, checkA11y } = require("axe-playwright");

/** @type {import('@storybook/test-runner').TestRunnerConfig} */
module.exports = {
  async preVisit(page) {
    await injectAxe(page);
  },

  async postVisit(page, context) {
    const story = await getStoryContext(page, context);
    const a11y = (story.parameters && story.parameters.a11y) || {};

    if (!a11y.disable) {
      // The a11y addon auto-runs axe on story render and axe throws when two
      // runs overlap — wait out any in-flight run, and retry once if the addon
      // sneaks a run in between.
      const axeIdle = () =>
        page
          .waitForFunction(() => !window.axe || !window.axe._running, undefined, {
            timeout: 10000,
          })
          .catch(() => {});
      for (let attempt = 0; ; attempt++) {
        await axeIdle();
        try {
          // Whole page, not #storybook-root — nav/sheet stories render into body.
          await checkA11y(page, undefined, {
            includedImpacts: ["critical", "serious"],
            detailedReport: true,
            detailedReportOptions: { html: false },
            axeOptions: {
              ...(a11y.config || {}),
              rules: {
                // The dark theme's muted text is a known contrast trade-off
                // (docs/accessibility.md); the a11y addon panel still reports it.
                // Everything else — names, roles, aria, nesting — stays enforced.
                "color-contrast": { enabled: false },
                ...((a11y.config || {}).rules || {}),
              },
            },
          });
          break;
        } catch (e) {
          if (attempt < 2 && String(e).includes("already running")) continue;
          throw e;
        }
      }
    }

    if (process.env.VRT === "1") {
      const { toMatchImageSnapshot } = require("jest-image-snapshot");
      expect.extend({ toMatchImageSnapshot });
      const image = await page.screenshot({ animations: "disabled" });
      expect(image).toMatchImageSnapshot({
        customSnapshotsDir: `${__dirname}/../__image_snapshots__`,
        customSnapshotIdentifier: context.id,
        // absorbs anti-aliasing noise, still catches real layout/colour drift
        failureThreshold: 0.01,
        failureThresholdType: "percent",
      });
    }
  },
};
