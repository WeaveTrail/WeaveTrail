/**
 * Writes the English layer-separation diagram to the two files that commit it:
 * the documentation asset the readme embeds, and the copy served under
 * `/diagrams`. Both come from `how-it-works-diagram.ts`, so the words in the
 * committed figure and the words the page renders cannot drift apart.
 *
 * The page renders the same module in the reader's language and does not read
 * these files. They exist for the documentation, which has one language.
 *
 * Run with `pnpm diagram:build`. `how-it-works-diagram.test.ts` fails if a
 * committed file no longer matches what this script would write.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { howItWorksSvg } from "../apps/web/src/app/architecture/how-it-works-diagram.ts";

export const DIAGRAM_FILES = [
  "docs/assets/how-it-works.svg",
  "apps/web/public/diagrams/how-it-works.svg",
];

const root = resolve(import.meta.dirname, "..");
const svg = howItWorksSvg("en");

for (const file of DIAGRAM_FILES) {
  writeFileSync(resolve(root, file), svg, "utf8");
  console.log(`wrote ${file} (${Buffer.byteLength(svg)} bytes)`);
}
