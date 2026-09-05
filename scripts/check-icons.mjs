/**
 * check-icons.mjs — fail the build if the repo references a `solar:` icon that
 * isn't in the eager core set (src/generated/icons.core.gen.js).
 *
 * The core set is what ships statically; anything else is fetched lazily from
 * dist/icons.full.json at runtime. This guard keeps that split honest: a name used
 * in src/ (or the stories) must be in core, so a code-path icon never depends on a
 * network fetch. `gen-icons` derives core from these same references, so a failure
 * here means gen-icons wasn't re-run (or core was hand-edited). Run via `bun run
 * check`; use a `solar:<name>-bold-duotone` name, or an mdi: name.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { ICONS } from "../src/generated/icons.core.gen.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const roots = [join(root, "src"), join(root, "storybook/stories")];
const skip = join(root, "src/generated/icons.core.gen.js");

function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if ((p.endsWith(".ts") || p.endsWith(".js")) && p !== skip)
      out.push(p);
  }
  return out;
}

const re = /solar:[a-z0-9-]+/g;
const missing = new Map(); // name -> [files]

for (const base of roots) {
  for (const file of sourceFiles(base)) {
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
    "check-icons: these `solar:` names are used in src/ but missing from the core " +
      "set (src/generated/icons.core.gen.js) — run `bun run gen-icons`:",
  );
  for (const [name, files] of missing)
    console.error(`  ${name}  (${files.join(", ")})`);
  console.error(
    "\nOnly the Solar bold-duotone style is shipped — use a `solar:<name>-bold-duotone` name, or an mdi: name.",
  );
  process.exit(1);
}

console.log("check-icons: all `solar:` references are in the core set.");
