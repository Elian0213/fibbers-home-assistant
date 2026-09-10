/* Wait for the Storybook dev server to answer, then open it in the default
 * browser. Storybook's own auto-open is suppressed when it runs under
 * `concurrently` (no TTY), so `bun run storybook` opens the tab here instead —
 * one tab on http://localhost:6007. */
import { exec } from "node:child_process";

const SB_URL = "http://localhost:6007";

const OPENERS = {
  win32: `start "" "${SB_URL}"`,
  darwin: `open "${SB_URL}"`,
};
const opener = OPENERS[process.platform] || `xdg-open "${SB_URL}"`;

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

async function waitForServer() {
  for (let i = 0; i < 120; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential readiness poll, by design
      const res = await fetch(`${SB_URL}/index.json`);
      if (res.ok) return;
    } catch {
      /* not up yet — keep polling */
    }
    // eslint-disable-next-line no-await-in-loop -- pace the poll
    await sleep(500);
  }
}

await waitForServer();
exec(opener);
