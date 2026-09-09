import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

/**
 * The four figures the entry point explains the product with. The layer
 * diagram is rendered from `how-it-works-diagram.ts` and pinned by
 * `architecture-diagram.test.ts`; the other three are drawn by hand in each
 * language, which is what the checks below are here to hold together.
 */
const DIAGRAM_PAIRS = [
  ["docs/assets/problem.svg", "docs/assets/problem.ko.svg"],
  ["docs/assets/how-it-works.svg", "docs/assets/how-it-works.ko.svg"],
  ["docs/assets/design.svg", "docs/assets/design.ko.svg"],
  ["docs/assets/component-chain.svg", "docs/assets/component-chain.ko.svg"],
] as const;

/** Documents that embed a figure and must reach the one in their language. */
const ENTRY_POINTS = ["README.ko.md", "docs/ARCHITECTURE.ko.md"] as const;

/** Identifiers, versions and result values. Never translated, so both languages spell them alike. */
const CONTRACT_VOCABULARY = [
  "REVIEW_REQUIRED",
  "eventTime",
  "sequence",
  "eventId",
  "RFC 8785",
  "canonicalResultHash",
  "receivedAt",
  "rawRowHash",
  "workflowState",
  "sourceArtifactHash",
  "mappingVersion 1.4",
  "approvedArtifactHash",
  "canonicalDatasetHash",
  "DatasetProfile",
  "approvedManifestHash",
  "RAPID_PRICE_LIFT 1.1",
  "INPUT_REVIEW_REQUIRED",
  "MAPPING_REVIEW_REQUIRED",
  "CASE_REVIEW_REQUIRED",
  "SUPPORTED",
  "NOT_SUPPORTED",
  "INCONCLUSIVE",
] as const;

/**
 * ADR 0035 holds the Korean product vocabulary to the deployed surface, so a
 * reader moving between the site and the repository meets one set of words.
 * Each pair is a word the surface uses and a plausible synonym it does not.
 */
const SURFACE_VOCABULARY: readonly (readonly [string, readonly string[]])[] = [
  ["원본 행", ["소스 행"]],
  ["필드", ["항목 대응"]],
  ["gate", ["관문"]],
  ["제약된 매퍼", ["스키마 매퍼"]],
  ["아티팩트 해시", ["자료 해시"]],
  ["core", ["결정론적 핵심"]],
  ["행위자", ["계좌 집단"]],
  ["사례", ["사건 제안기"]],
  ["증거 번들", ["증거 다발"]],
  ["override", ["재정의"]],
];

const HANGUL = /[가-힣]/;

/** The structural comments each figure names its panels and components with. */
const declarations = (svg: string) =>
  [...svg.matchAll(/<!--\s*([\s\S]*?)\s*-->/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter((comment) =>
      /^(?:panel|stage) \d+|^\d+ [a-z]|^(?:untrusted input|the gate|deterministic core)$/i.test(
        comment,
      ),
    );

/**
 * How the figure marks what is proposed but not built. The counts are of
 * frames and chips, not of text lines: a language sets its own body copy and
 * breaks it where it breaks, so line counts differ between the two by design.
 */
const plannedMarkers = (svg: string) => ({
  plannedFrames: (svg.match(/stroke-dasharray="4 3"/g) ?? []).length,
  plannedChips: (svg.match(/stroke="#a9bebc"/g) ?? []).length,
});

const accessibleText = (svg: string, element: "title" | "desc") =>
  svg.match(new RegExp(`<${element}\\b[^>]*>([^<]+)</${element}>`))?.[1] ?? "";

const attributes = (markup: string) =>
  Object.fromEntries(
    [...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [
      match[1] ?? "",
      match[2] ?? "",
    ]),
  );

/**
 * An upper bound on how wide a line sets, in the committed faces.
 *
 * A Hangul syllable advances exactly one em in IBM Plex Sans KR; the Latin
 * classes are rounded up from IBM Plex Sans, so the estimate never runs under
 * the width a renderer produces. It exists to catch a line drawn too long for
 * the box it sits in — the failure a Korean figure fitted into English line
 * breaks produces, because Korean does not measure like English.
 */
const ADVANCE_EMS = {
  hangul: 1,
  upper: 0.66,
  digit: 0.6,
  lower: 0.53,
  space: 0.28,
  narrow: 0.3,
  other: 0.55,
} as const;

const advance = (character: string) => {
  if (/[가-힣㄰-㆏一-鿿]/.test(character)) return ADVANCE_EMS.hangul;
  if (character === " ") return ADVANCE_EMS.space;
  if (/[.,:;'!|]/.test(character)) return ADVANCE_EMS.narrow;
  if (/\d/.test(character)) return ADVANCE_EMS.digit;
  if (/\p{Lu}/u.test(character)) return ADVANCE_EMS.upper;
  if (/\p{Ll}/u.test(character)) return ADVANCE_EMS.lower;
  return ADVANCE_EMS.other;
};

const textWidth = (value: string, fontSize: number, letterSpacing: number) => {
  const text = value
    .replace(/&#8594;/g, "→")
    .replace(/&#183;/g, "·")
    .replace(/&amp;/g, "&");
  let ems = 0;
  for (const character of text) ems += advance(character) + letterSpacing;
  return ems * fontSize;
};

/** Every `<text>` in the figure, with the box it has to fit inside. */
const overflowingLines = (svg: string) => {
  const sizes = new Map<string, { size: number; letterSpacing: number }>();
  for (const [, name, body] of svg.matchAll(/\.(\w+)\{([^}]*)\}/g)) {
    const size = body?.match(/font-size:([\d.]+)px/)?.[1];
    if (!name || !size) continue;
    sizes.set(name, {
      size: Number(size),
      letterSpacing: Number(
        body?.match(/letter-spacing:(-?[\d.]+)em/)?.[1] ?? 0,
      ),
    });
  }

  const boxes = [...svg.matchAll(/<rect([^>]*)\/>/g)]
    .map((match) => attributes(match[1] ?? ""))
    .map((box) => ({
      x: Number(box.x ?? 0),
      y: Number(box.y ?? 0),
      width: Number(box.width),
      height: Number(box.height),
    }))
    .filter(
      (box) =>
        Number.isFinite(box.width) &&
        Number.isFinite(box.height) &&
        !(box.width >= 1190 && box.height >= 400),
    );

  const overflowing: string[] = [];
  for (const [, markup, value] of svg.matchAll(
    /<text([^>]*)>([^<]*)<\/text>/g,
  )) {
    if (!value?.trim()) continue;
    const attrs = attributes(markup ?? "");
    let size = 12;
    let letterSpacing = 0;
    for (const name of (attrs.class ?? "").split(/\s+/)) {
      const style = sizes.get(name);
      if (style) ({ size, letterSpacing } = style);
    }
    if (attrs["font-size"]) size = Number(attrs["font-size"].replace("px", ""));

    const width = textWidth(value, size, letterSpacing);
    const anchor = attrs["text-anchor"] ?? "start";
    const start =
      Number(attrs.x ?? 0) -
      (anchor === "end" ? width : anchor === "middle" ? width / 2 : 0);
    const baseline = Number(attrs.y ?? 0);

    // The tightest box the line starts inside; the frame when it sits outside one.
    const box = boxes
      .filter(
        (candidate) =>
          candidate.x <= start + 1 &&
          start < candidate.x + candidate.width &&
          candidate.y <= baseline &&
          baseline <= candidate.y + candidate.height + 2,
      )
      .sort((a, b) => a.width * a.height - b.width * b.height)[0];
    const limit = box ? box.x + box.width : 1160;

    if (start + width > limit + 0.5)
      overflowing.push(
        `${value} (${Math.round(start + width)} > ${Math.round(limit)})`,
      );
  }
  return overflowing;
};

describe("Korean entry-point diagrams", () => {
  it("gives every figure the entry point embeds Korean accessible text", () => {
    for (const document of ENTRY_POINTS) {
      const targets = [
        ...read(document).matchAll(/!\[[^\]]*\]\(([^)]+\.svg)\)/g),
      ].map((match) => match[1] ?? "");

      expect(targets.length, document).toBeGreaterThan(0);
      for (const target of targets) {
        const path = resolve(process.cwd(), dirname(document), target);
        expect(existsSync(path), `${document} ${target}`).toBe(true);
        const svg = readFileSync(path, "utf8");
        expect(accessibleText(svg, "title"), `${target} title`).toMatch(HANGUL);
        expect(accessibleText(svg, "desc"), `${target} description`).toMatch(
          HANGUL,
        );
      }
    }
  });

  it("keeps the same declared panels, layers, components and planned marks", () => {
    for (const [englishPath, koreanPath] of DIAGRAM_PAIRS) {
      const english = read(englishPath);
      const korean = read(koreanPath);

      expect(declarations(english).length, englishPath).toBeGreaterThan(0);
      expect(declarations(korean), koreanPath).toEqual(declarations(english));
      expect(plannedMarkers(korean), koreanPath).toEqual(
        plannedMarkers(english),
      );
      if (englishPath.endsWith("component-chain.svg"))
        for (const [path, svg] of [
          [englishPath, english],
          [koreanPath, korean],
        ] as const) {
          expect(plannedMarkers(svg).plannedChips, path).toBe(1);
          expect(
            (svg.match(/class="bodyPlanned"/g) ?? []).length,
            path,
          ).toBeGreaterThan(0);
        }
    }
  });

  it("spells contract vocabulary the same way in both languages", () => {
    for (const [englishPath, koreanPath] of DIAGRAM_PAIRS) {
      const english = read(englishPath);
      const korean = read(koreanPath);
      expect(
        CONTRACT_VOCABULARY.filter((word) => korean.includes(word)),
        koreanPath,
      ).toEqual(CONTRACT_VOCABULARY.filter((word) => english.includes(word)));
    }
  });

  it("keeps the English figures free of Korean", () => {
    for (const [englishPath] of DIAGRAM_PAIRS)
      expect(read(englishPath), englishPath).not.toMatch(HANGUL);
  });

  it("takes its Korean product vocabulary from the deployed surface", () => {
    const rejectedWords = SURFACE_VOCABULARY.flatMap(
      ([, rejected]) => rejected,
    );

    for (const [, koreanPath] of DIAGRAM_PAIRS) {
      const korean = read(koreanPath);
      for (const word of rejectedWords)
        expect(korean, `${koreanPath} must not say ${word}`).not.toContain(
          word,
        );
    }

    // The alt text stands in for the figure, so it names things the same way.
    for (const document of ENTRY_POINTS)
      for (const [, alt] of read(document).matchAll(
        /!\[([^\]]*)\]\([^)]+\.svg\)/g,
      ))
        for (const word of rejectedWords)
          expect(
            alt ?? "",
            `${document} alt text must not say ${word}`,
          ).not.toContain(word);
  });

  it("draws every Korean line short enough for the box it sits in", () => {
    for (const [englishPath, koreanPath] of DIAGRAM_PAIRS) {
      expect(overflowingLines(read(englishPath)), englishPath).toEqual([]);
      expect(overflowingLines(read(koreanPath)), koreanPath).toEqual([]);
    }
  });

  it("resolves Hangul through the committed Korean font stack", () => {
    for (const [, koreanPath] of DIAGRAM_PAIRS) {
      const svg = read(koreanPath);
      for (const family of [
        "IBM Plex Sans KR",
        "Apple SD Gothic Neo",
        "Malgun Gothic",
        "Noto Sans KR",
      ])
        expect(svg, `${koreanPath} ${family}`).toContain(family);
    }
  });
});
