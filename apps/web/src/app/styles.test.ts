import { readFileSync, readdirSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Styles are organized by the design system (`design/`), the site shell
 * (`shell/`) and each page or shared layout beside its components (ADR 0076).
 * A rule for markup that no longer exists is a rule nobody can review, so
 * every class a stylesheet styles has to be named by some component.
 */

const app = resolve(fileURLToPath(import.meta.url), "..");

function files(directory: string, pattern: RegExp): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return files(path, pattern);
    return pattern.test(entry.name) ? [path] : [];
  });
}

const stylesheets = files(app, /\.css$/);
const sources = files(app, /\.tsx?$/).filter(
  (path) => !path.includes(".test."),
);
const code = sources.map((path) => readFileSync(path, "utf8")).join("\n");

/** Class names a stylesheet styles, outside comments. */
function classesIn(css: string): string[] {
  const rules = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{[^{}]*\}/g, "{}");
  return [
    ...new Set(
      [...rules.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]!),
    ),
  ];
}

/**
 * Whether a component names the class: in full, or as the prefix of a
 * template such as `mc-mark-${kind}`.
 */
function named(name: string): boolean {
  if (new RegExp(`(?<![\\w-])${name}(?![\\w-])`).test(code)) return true;
  const prefix = name.slice(0, name.lastIndexOf("-") + 1);
  return prefix.length > 0 && code.includes(`${prefix}\${`);
}

describe("stylesheets", () => {
  it("style only classes some component names", () => {
    const unused = stylesheets.flatMap((path) =>
      classesIn(readFileSync(path, "utf8"))
        .filter((name) => !named(name))
        .map((name) => `${relative(app, path)}: .${name}`),
    );
    expect(unused).toEqual([]);
  });

  it("are each imported by the layout or by the components they style", () => {
    const orphans = stylesheets.filter(
      (path) =>
        !new RegExp(`import "\\./(?:[\\w-]+/)?${basename(path)}";`).test(code),
    );
    expect(orphans.map((path) => relative(app, path))).toEqual([]);
  });
});
