import { readFileSync, readdirSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * docs/DATA_HANDLING.md states what the site's own code does in a browser: it
 * sends request data only to this site's API routes, adds no script element,
 * and keeps nothing in browser storage except the language choice. Following
 * an ordinary link to another site is navigation, not a request this code makes.
 */

const webSourceDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(path);
    if (!/\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) return [];
    return [path];
  });
}

const sources = productionSourceFiles(webSourceDirectory).map((path) => ({
  file: relative(webSourceDirectory, path),
  text: readFileSync(path, "utf8"),
}));

const matches = (pattern: RegExp) =>
  sources.flatMap(({ file, text }) =>
    [...text.matchAll(pattern)].map((match) => `${file}: ${match[0]}`),
  );

describe("browser data boundary", () => {
  it("sends request data only to this site's own API routes", () => {
    const requests = matches(/\bfetch\s*\(\s*[^)]{0,80}/g);
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.filter((call) => !/fetch\(\s*"\/api\//.test(call))).toEqual(
      [],
    );
    expect(
      matches(/\b(?:sendBeacon|WebSocket|EventSource|XMLHttpRequest)\b/g),
    ).toEqual([]);
  });

  it("adds no script element of its own, so none loads from elsewhere", () => {
    expect(matches(/next\/script|<script\b/g)).toEqual([]);
  });

  it("keeps only the language choice in browser storage", () => {
    expect(
      matches(
        /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie)\b/g,
      ),
    ).toEqual([
      "app/i18n/language.tsx: localStorage",
      "app/i18n/language.tsx: localStorage",
    ]);
    const language = sources.find(
      ({ file }) => file === "app/i18n/language.tsx",
    );
    expect(language?.text).toContain(
      'const STORAGE_KEY = "weavetrail.language";',
    );
    expect(language?.text).toContain("localStorage.getItem(STORAGE_KEY)");
    expect(language?.text).toContain(
      "localStorage.setItem(STORAGE_KEY, language)",
    );
  });
});
