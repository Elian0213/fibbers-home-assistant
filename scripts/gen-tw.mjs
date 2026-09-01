/* Compile styles/tailwind.css (scanning src/ for used utilities) into a JS
 * string module src/tailwind.gen.js — the same "generated JS, committed"
 * pattern as icons.gen.js, so the bundle stays a single IIFE with no CSS
 * loader. Run via `bun run gen-tw` (build does it automatically). */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "fibtw-"));
const out = join(dir, "tw.css");
execSync(`bunx @tailwindcss/cli -i styles/tailwind.css -o "${out}" --minify`, {
  stdio: "inherit",
});

const css = readFileSync(out, "utf8");
rmSync(dir, { recursive: true, force: true }); // don't leave temp dirs behind
const esc = css
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$\{/g, "\\${");

writeFileSync(
  "src/tailwind.gen.js",
  `/* GENERATED from styles/tailwind.css by 'bun run gen-tw'. Do not hand-edit. */\n` +
    `export const TW_CSS = \`${esc}\`;\n`,
);

console.log(`gen-tw: wrote src/tailwind.gen.js (${css.length} bytes of CSS)`);
