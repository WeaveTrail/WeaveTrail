import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The repository entry point is bilingual, and English is the source of record
 * ([ADR 0044](docs/adr/0044-translate-the-product-explanation-and-keep-the-record-in-english.md)).
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
  ["docs/AI_FAILURE_LOG.md", "docs/AI_FAILURE_LOG.ko.md"],
  ["docs/LIMITATIONS.md", "docs/LIMITATIONS.ko.md"],
  ["docs/DAILY_QUOTES.md", "docs/DAILY_QUOTES.ko.md"],
  ["docs/INSTRUMENT_RESOLUTION.md", "docs/INSTRUMENT_RESOLUTION.ko.md"],
  ["docs/DATA_HANDLING.md", "docs/DATA_HANDLING.ko.md"],
  ["docs/COVERAGE.md", "docs/COVERAGE.ko.md"],
  ["docs/PUBLISHED_DATA_ADMISSION.md", "docs/PUBLISHED_DATA_ADMISSION.ko.md"],
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

/** Enough of a document to be read before its explanation begins. */
const opening = (path: string) =>
  read(path).split("\n").slice(0, 30).join("\n");

describe("entry point", () => {
  it("names the deployed origin in both languages", () => {
    expect(read("README.md")).toContain(DEPLOYED_URL);
    expect(read("README.ko.md")).toContain(DEPLOYED_URL);
  });

  it("offers the other language in the first screenful", () => {
    expect(opening("README.md")).toContain("README.ko.md");
    expect(opening("README.ko.md")).toContain("README.md");
  });
});

describe.each([...KOREAN_FILES])("%s", (path) => {
  it("states under its heading that English governs", () => {
    // ADR 0044: a translation must not be mistaken for a second
    // specification, so the rule is stated before the explanation starts.
    expect(opening(path)).toContain("영문 문서가 기준입니다");
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

/** Whitespace-insensitive, because a reflow must not hide a sentence. */
const flat = (path: string) => read(path).replace(/\s+/g, " ");

/** The plan section's bullet for one version, up to the next bullet. */
const versionBullet = (path: string, version: string) =>
  flat(path).match(
    new RegExp(
      `- \\*\\*\`${version}\` ·(.*?)(?= - \\*\\*| Case Replay is| 사례 재생은)`,
    ),
  )?.[1] ?? "";

const PLAN = [
  {
    readme: "README.md",
    architecture: "docs/ARCHITECTURE.md",
    controlLine:
      "AI proposes. Human approves. Code verifies. Evidence traces back.",
    roles: ["Field mapping", "Bounded case-scope proposal"],
    exists: "exists",
    planned: /planned/i,
  },
  {
    readme: "README.ko.md",
    architecture: "docs/ARCHITECTURE.ko.md",
    controlLine:
      "AI가 제안하고, 사람이 승인하고, 코드가 검증하며, 증거는 원천으로",
    roles: ["데이터 항목 연결", "제한된 조사 범위 제안"],
    exists: "있는 것",
    planned: /계획/,
  },
] as const;

describe.each(PLAN)("$readme plan statement", (plan) => {
  it("states the control line in the readme and the architecture", () => {
    expect(flat(plan.readme)).toContain(plan.controlLine);
    expect(flat(plan.architecture)).toContain(plan.controlLine);
  });

  it("names the two model roles", () => {
    for (const role of plan.roles) expect(flat(plan.readme)).toContain(role);
  });

  it("marks each version of the plan as planned", () => {
    const harness = versionBullet(plan.readme, "v0.2.0");
    expect(harness).toContain(plan.exists);
    expect(harness).toMatch(plan.planned);
    for (const version of ["v0.3.0", "v0.4.0"]) {
      const bullet = versionBullet(plan.readme, version);
      expect(bullet, version).not.toBe("");
      expect(bullet, version).toMatch(plan.planned);
      expect(bullet, version).not.toContain(plan.exists);
    }
  });
});

// Until a model comparison is published with its definition, command and
// environment, the entry points carry no model figure. Remove this check in
// the change that publishes one, alongside its evaluation definition.
describe.each([
  "README.md",
  "README.ko.md",
  "docs/ARCHITECTURE.md",
  "docs/ARCHITECTURE.ko.md",
  "docs/LIMITATIONS.md",
  "docs/LIMITATIONS.ko.md",
])("%s", (path) => {
  it("carries no model percentage before an evaluation is published", () => {
    const prose = read(path).replace(/\]\([^)]*\)|https?:\/\/\S+/g, "");
    expect(prose).not.toMatch(/\d\s?%/);
  });
});
