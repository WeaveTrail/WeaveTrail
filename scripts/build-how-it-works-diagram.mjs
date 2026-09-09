/**
 * Writes the layer-separation diagram to the files that commit it: the
 * documentation asset each readme embeds, and the copy served under
 * `/diagrams`. Both come from `how-it-works-diagram.ts`, so the words in the
 * committed figures and the words the page renders cannot drift apart.
 *
 * Each language gets its own pair. The page renders the same module in the
 * reader's language and does not read these files; they exist for the two
 * readmes and for anyone linking a figure directly.
 *
 * Run with `pnpm diagram:build`. `architecture-diagram.test.ts` fails if a
 * committed file no longer matches what this script would write.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { howItWorksSvg } from "../apps/web/src/app/architecture/how-it-works-diagram.ts";

/** Language, then the two files that language's figure is committed to. */
export const DIAGRAM_FILES = [
  [
    "en",
    "docs/assets/how-it-works.svg",
    "apps/web/public/diagrams/how-it-works.svg",
  ],
  [
    "ko",
    "docs/assets/how-it-works.ko.svg",
    "apps/web/public/diagrams/how-it-works.ko.svg",
  ],
];

const root = resolve(import.meta.dirname, "..");

for (const [language, ...files] of DIAGRAM_FILES) {
  const svg = howItWorksSvg(language);
  for (const file of files) {
    writeFileSync(resolve(root, file), svg, "utf8");
    console.log(`wrote ${file} (${Buffer.byteLength(svg)} bytes)`);
  }
}
