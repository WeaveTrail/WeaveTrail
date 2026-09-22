/**
 * Writes every boundary figure the design documents embed, or checks that the
 * committed files still equal what `boundary-figures.mjs` renders.
 *
 *   pnpm figures:build    write docs/assets/boundary/*.svg
 *   pnpm figures:check    fail when a committed figure has drifted
 *
 * The words in a figure and the words the document explains come from one
 * module, so a copy change that reaches only one of them cannot pass.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  BOUNDARY_FIGURES,
  FIGURE_DIRECTORY,
  figurePath,
  figureSvg,
} from "./boundary-figures.mjs";

const root = resolve(import.meta.dirname, "..");
const check = process.argv.includes("--check");

mkdirSync(resolve(root, FIGURE_DIRECTORY), { recursive: true });

const expected = new Map(
  BOUNDARY_FIGURES.map((figure) => [figurePath(figure.id), figureSvg(figure)]),
);

const committed = readdirSync(resolve(root, FIGURE_DIRECTORY))
  .filter((name) => name.endsWith(".svg"))
  .map((name) => `${FIGURE_DIRECTORY}/${name}`);

const problems = [];

for (const path of committed)
  if (!expected.has(path)) problems.push(`${path} has no figure entry`);

for (const [path, svg] of expected) {
  const file = resolve(root, path);
  if (check) {
    let current = "";
    try {
      current = readFileSync(file, "utf8");
    } catch {
      problems.push(`${path} is missing`);
      continue;
    }
    if (current !== svg) problems.push(`${path} differs from its figure`);
    continue;
  }
  writeFileSync(file, svg, "utf8");
  console.log(`wrote ${path} (${Buffer.byteLength(svg)} bytes)`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  console.error("Run `pnpm figures:build`.");
  process.exitCode = 1;
} else if (check) {
  console.log(`${expected.size} boundary figures match their source.`);
}
