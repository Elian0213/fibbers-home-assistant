/**
 * check-i18n.mjs — fail the build if a card renders a hard-coded Dutch string.
 *
 * Part 1 of 0.6.0 moved every user-facing string into src/translations/*.json,
 * reached through `t(hl, key)`. This guard keeps it that way: it scans the string
 * literals in src/cards/*.js (comments stripped first) for a denylist of Dutch
 * words. A hit means a literal escaped translation — use `t(hl, "<card>.<key>")`
 * instead. The translation JSON itself is not scanned (it is Dutch by design).
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const cardsDir = join(root, "src/cards");

// Unambiguously-Dutch tokens we removed. Kept whole-word to avoid colliding with
// English (e.g. "order" ⊅ "orde"). Short international words (min, auto, media,
// offline) are intentionally excluded.
const DUTCH = [
  "Uit", "Aan", "Onbereikbaar", "Aanwezigheid", "Niemand", "Goedemorgen",
  "Goedemiddag", "Goedenavond", "Goedenacht", "Terug", "Wekker", "Thermostaat",
  "Ingesteld", "Verwarmen", "Verwarmt", "Koelen", "Koelt", "Ventilator",
  "Ventileert", "Drogen", "Droogt", "Inactief", "Mislukt", "Geslaagd",
  "geleden", "Batterij", "beschikbaar", "Lampen", "lampen", "Kleur", "Neutraal",
  "Helder", "Zonnig", "Bewolkt", "bewolkt", "Stortregen", "Onweer", "Sneeuw",
  "Hagel", "Winderig", "inklappen", "uitklappen", "historie", "Aandacht",
  "orde", "spelen", "volgende", "Afstandsbediening",
];
const DENY = new RegExp(`\\b(${DUTCH.join("|")})\\b`);

// Strip comments so an English header that quotes an old Dutch example (e.g.
// `"Aandacht nodig" from real checks`) doesn't trip the guard. The line-comment
// pattern preserves `://` so a URL inside a string survives.
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

// Every "…", '…' and `…` literal (templates may span lines).
const LITERAL = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/gs;

const hits = [];
for (const entry of readdirSync(cardsDir)) {
  if (!entry.endsWith(".js")) continue;
  const file = join(cardsDir, entry);
  const code = stripComments(readFileSync(file, "utf8"));
  for (const lit of code.match(LITERAL) || []) {
    const m = lit.match(DENY);
    if (m) hits.push(`  ${relative(root, file)}: ${m[1]}  in  ${lit.trim()}`);
  }
}

if (hits.length) {
  console.error("check-i18n: hard-coded Dutch string(s) found in src/cards/:");
  console.error(hits.join("\n"));
  console.error(
    '\nRoute user-facing text through t(hl, "<card>.<key>") with a key in src/translations/*.json.',
  );
  process.exit(1);
}

console.log("check-i18n: no hard-coded Dutch strings in src/cards/.");
