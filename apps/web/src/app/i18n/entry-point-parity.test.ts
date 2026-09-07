import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { sha256Canonical } from "@weavetrail/replay-engine";

import {
  ANALYSED_DATE,
  publishedCaseProposal,
  publishedCaseSeries,
  replayPublishedCase,
} from "../../lib/published-case";

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

type Link = {
  readonly target: string;
  readonly marked: boolean;
  readonly image: boolean;
};

/** Markdown links, with whether `(영문)` immediately follows the link. */
const linksIn = (markdown: string): readonly Link[] =>
  [...markdown.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)\)(\(영문\))?/g)].map(
    (match) => ({
      target: match[2] ?? "",
      marked: match[3] !== undefined,
      image: match[1] === "!",
    }),
  );

/** Source files are English by nature; the marker is about documents. */
const isCode = (target: string) => /\.(ts|tsx|mjs|js|json|css)$/.test(target);

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

    // Not restricted to `.md`: `LICENSE` and the `docs/adr` directory are
    // English destinations too, and an unmarked link to one is the same
    // surprise for a reader.
    it("marks every English-only destination it links to", () => {
      const unmarked = local
        .filter((link) => !link.image && !isCode(link.target) && !link.marked)
        .map((link) => normalize(join(dirname(path), link.target)))
        .filter((target) => target !== original && !KOREAN_FILES.has(target));
      expect(unmarked).toEqual([]);
    });
  }
});

/**
 * The worked-case figures carry real published prices and real rule output.
 * Nothing generates them — they are drawn — so the numbers on them can go
 * stale against the artifacts they claim to show. These checks pin every
 * figure on both diagrams to the committed rows and to the engine's own
 * result, so a changed artifact fails here instead of shipping a diagram that
 * quietly disagrees with the case it illustrates.
 */
describe("the worked-case diagrams", () => {
  const DIAGRAMS = {
    en: "docs/assets/worked-case.svg",
    ko: "docs/assets/worked-case.ko.svg",
  } as const;

  /** The committed artifacts the diagrams name in their attribution. */
  const NAMED_ARTIFACTS = [
    "fsc-kospi-200-baseline-20260701-20260903",
    "fsc-kospi-200-futures-20260903",
  ] as const;

  const approval = {
    approvedArtifactHash: sha256Canonical(publishedCaseProposal().proposal),
    reviewerRef: "reviewer:local-lab",
    decision: "APPROVED" as const,
    overrides: [],
    approvedAt: "2026-09-07T00:00:00Z",
  };

  const series = publishedCaseSeries();
  const analysedDay = series.spot.at(-1);
  const { analysis } = replayPublishedCase(approval).evaluation;
  if (analysedDay === undefined || analysis === null)
    throw new Error(
      "The published case must reach an analysed day and an analysis before " +
        "its diagrams can be checked against it",
    );

  /** The diagrams print published prices grouped, to two decimals. */
  const displayed = (value: string) =>
    Number(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  it("illustrates the day the case analyses", () => {
    expect(analysedDay.tradingDate).toBe(ANALYSED_DATE.replaceAll("-", ""));
  });

  it.each(NAMED_ARTIFACTS)("names %s, which is committed", (artifact) => {
    const source = `packages/published-data/src/sources/real/${artifact}/source.jsonl`;
    expect(existsSync(resolve(process.cwd(), source))).toBe(true);
    for (const diagram of Object.values(DIAGRAMS))
      expect(read(diagram)).toContain(artifact);
  });

  it.each(Object.entries(DIAGRAMS))(
    "shows %s's published prices exactly as committed",
    (_language, diagram) => {
      const svg = read(diagram);
      for (const day of [analysedDay, series.future]) {
        expect(svg).toContain(displayed(day.low));
        expect(svg).toContain(displayed(day.high));
      }
    },
  );

  it.each(Object.entries(DIAGRAMS))(
    "rounds %s's multiples from the rule's own output",
    (language, diagram) => {
      const pattern =
        language === "ko" ? /약 (\d+)배/g : /&#8776; (\d+)&#215;/g;
      // The accessible description repeats the visible figures, so compare
      // the distinct values rather than every occurrence.
      const shown = [
        ...new Set(
          [...read(diagram).matchAll(pattern)].map((match) => Number(match[1])),
        ),
      ];
      expect(shown).toEqual(
        analysis.legs.map((leg) => Math.round(Number(leg.reversalMultiple))),
      );
    },
  );

  it.each(Object.entries(DIAGRAMS))(
    "reports %s's standing as the rule reported it",
    (language, diagram) => {
      const svg = read(diagram);
      const [position, populationSize] =
        language === "ko"
          ? ([...svg.matchAll(/(\d+)거래일 중 (\d+)번째/g)].map((match) => [
              match[2],
              match[1],
            ])[0] ?? [])
          : ([...svg.matchAll(/(\d+)(?:st|nd|rd|th) of (\d+)/g)].map(
              (match) => [match[1], match[2]],
            )[0] ?? []);
      expect({ position, populationSize }).toEqual({
        position: analysis.rank.position,
        populationSize: analysis.rank.populationSize,
      });
    },
  );
});
