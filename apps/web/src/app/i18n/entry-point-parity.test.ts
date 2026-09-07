import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The repository entry point is bilingual, and English is the source of record
 * ([ADR 0035](docs/adr/0035-translate-the-product-explanation-and-keep-the-record-in-english.md)).
 *
 * These checks are structural, because structure is what a translation drops
 * without anyone noticing: a section, a command, a working link. What a
 * document *claims* cannot be diffed across languages, so a change to either
 * half of a pair still has to update the other by hand.
 */

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const DEPLOYED_URL = "https://weave-trail-web-flax.vercel.app";

/** Every document published in both languages, English path first. */
const PAIRS: readonly (readonly [string, string])[] = [
  ["README.md", "README.ko.md"],
  ["docs/ARCHITECTURE.md", "docs/ARCHITECTURE.ko.md"],
  ["docs/METHODOLOGY.md", "docs/METHODOLOGY.ko.md"],
  ["docs/EVALUATION.md", "docs/EVALUATION.ko.md"],
  ["docs/LIMITATIONS.md", "docs/LIMITATIONS.ko.md"],
  ["docs/DAILY_QUOTES.md", "docs/DAILY_QUOTES.ko.md"],
];

const KOREAN_FILES = new Set(PAIRS.map(([, korean]) => korean));

/** Each Korean document's own English original, which it always links to. */
const ORIGINAL_OF = new Map(
  PAIRS.map(([english, korean]) => [korean, english]),
);

type Link = { readonly target: string; readonly marked: boolean };

/** Markdown links, with whether `(영문)` immediately follows the link. */
const linksIn = (markdown: string): readonly Link[] =>
  [...markdown.matchAll(/\[[^\]]*\]\(([^)\s]+)\)(\(영문\))?/g)].map(
    (match) => ({
      target: match[1] ?? "",
      marked: match[2] !== undefined,
    }),
  );

const isLocal = (target: string) =>
  !target.startsWith("http") &&
  !target.startsWith("#") &&
  !target.startsWith("mailto:");

/** Heading levels in order, e.g. ["#", "##", "###"]. Text cannot be compared. */
const headingShape = (markdown: string): readonly string[] =>
  [...markdown.matchAll(/^(#{1,6}) /gm)].map((match) => match[1] ?? "");

/** Fenced blocks carry commands, which must be identical in both languages. */
const fencedBlocks = (markdown: string): readonly string[] =>
  [...markdown.matchAll(/^```[a-z]*\n([\s\S]*?)^```/gm)].map(
    (match) => match[1] ?? "",
  );

describe.each(PAIRS)("%s and %s", (english, korean) => {
  it("both exist", () => {
    expect(existsSync(resolve(process.cwd(), english))).toBe(true);
    expect(existsSync(resolve(process.cwd(), korean))).toBe(true);
  });

  it("link to each other", () => {
    // README offers the other language in an HTML anchor, so match the raw text.
    const name = (path: string) => path.slice(path.lastIndexOf("/") + 1);
    expect(read(english)).toContain(name(korean));
    expect(read(korean)).toContain(name(english));
  });

  it("carry the same sections in the same order", () => {
    expect(headingShape(read(korean))).toEqual(headingShape(read(english)));
  });

  it("carry the same commands", () => {
    expect(fencedBlocks(read(korean))).toEqual(fencedBlocks(read(english)));
  });
});

describe("entry point", () => {
  it("names the deployed origin in both languages", () => {
    expect(read("README.md")).toContain(DEPLOYED_URL);
    expect(read("README.ko.md")).toContain(DEPLOYED_URL);
  });

  it("offers the other language in the first screenful", () => {
    const opening = (path: string) =>
      read(path).split("\n").slice(0, 30).join("\n");
    expect(opening("README.md")).toContain("README.ko.md");
    expect(opening("README.ko.md")).toContain("README.md");
  });
});

describe.each(PAIRS.flat())("%s", (path) => {
  const markdown = read(path);
  const local = linksIn(markdown).filter((link) => isLocal(link.target));

  it("resolves every local link", () => {
    const unresolved = local
      .map((link) =>
        normalize(join(dirname(path), link.target.split("#")[0] ?? "")),
      )
      .filter((target) => !existsSync(resolve(process.cwd(), target)));
    expect(unresolved).toEqual([]);
  });

  if (KOREAN_FILES.has(path)) {
    const original = ORIGINAL_OF.get(path);

    it("prefers the Korean document wherever one exists", () => {
      const translated = local
        .map((link) => normalize(join(dirname(path), link.target)))
        .filter((target) => target !== original)
        .filter((target) => KOREAN_FILES.has(target.replace(/\.md$/, ".ko.md")))
        .filter((target) => !target.endsWith(".ko.md"));
      expect(translated).toEqual([]);
    });

    it("marks every English-only document it links to", () => {
      const unmarked = local
        .filter((link) => link.target.endsWith(".md") && !link.marked)
        .map((link) => normalize(join(dirname(path), link.target)))
        .filter((target) => target !== original && !KOREAN_FILES.has(target));
      expect(unmarked).toEqual([]);
    });
  }
});
