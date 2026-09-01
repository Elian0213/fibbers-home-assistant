/**
 * check-icons.mjs — fail the build if the repo references a `solar:` icon that
 * isn't baked into src/icons.gen.js.
 *
 * An un-baked `solar:` name renders as a silent blank in Home Assistant (HA has
 * no `solar` iconset), so this guard keeps src/ and the stories honest. The full
 * Solar bold-duotone style is shipped, so in practice this catches a non-duotone
 * style (e.g. `-linear`) or a typo. Run via `bun run check`; use a
 * `solar:<name>-bold-duotone` name, or an mdi: name.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { ICONS } from "../src/icons.gen.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const roots = [join(root, "src"), join(root, "storybook/stories")];
const skip = join(root, "src/icons.gen.js");

function jsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...jsFiles(p));
    else if (p.endsWith(".js") && p !== skip) out.push(p);
  }
  return out;
}

const re = /solar:[a-z0-9-]+/g;
const missing = new Map(); // name -> [files]

for (const base of roots) {
  for (const file of jsFiles(base)) {
    const src = readFileSync(file, "utf8");
    for (const name of src.match(re) || []) {
      if (ICONS[name]) continue;
      const rel = relative(root, file);
      const list = missing.get(name) || [];
      if (!list.includes(rel)) list.push(rel);
      missing.set(name, list);
    }
  }
}

if (missing.size) {
  console.error(
    "check-icons: these `solar:` names are used but not baked into src/icons.gen.js:",
  );
  for (const [name, files] of missing)
    console.error(`  ${name}  (${files.join(", ")})`);
  console.error(
    "\nOnly the Solar bold-duotone style is shipped — use a `solar:<name>-bold-duotone` name, or an mdi: name.",
  );
  process.exit(1);
}

console.log("check-icons: all `solar:` references are baked.");
