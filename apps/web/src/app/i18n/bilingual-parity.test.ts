import { describe, expect, it } from "vitest";

import { checks } from "../evals/checks";
import { ledgerCopy } from "../evals/copy";
import { howItWorksSvg } from "../architecture/how-it-works-diagram";
import { situation, sources } from "../why/copy";
import { architectureCopy } from "../architecture/copy";
import { shellCopy } from "../shell/copy";
import { LANGUAGES, type Language } from "./language";

/**
 * Each language writes its own voice copy, so the two surfaces cannot be
 * diffed line by line. What still has to hold is that they carry the same
 * claims: the same capabilities, the same limits, the same disclosures, and
 * one spelling for contract vocabulary.
 *
 * The checks are structural, because structure is what a translation can
 * silently drop — a section, a layer, a chain entry, a "planned" marker. They
 * run over every bilingual table the copy modules export, found here rather
 * than listed, so a new table cannot be left out.
 */

type Surface = Readonly<Record<Language, unknown>>;

const isBilingual = (value: unknown): value is Surface =>
  value !== null &&
  typeof value === "object" &&
  Object.keys(value).sort().join() === [...LANGUAGES].sort().join();

const modules = {
  ...import.meta.glob("../**/*copy.ts", { eager: true }),
  ...import.meta.glob("../replay/steps/*.ts", { eager: true }),
} as Record<string, Record<string, unknown>>;

/** Every bilingual table exported by a copy module or a panel's copy. */
const surfaces: readonly (readonly [string, Surface])[] = Object.entries(
  modules,
).flatMap(([path, exports]) =>
  Object.entries(exports).flatMap(([name, value]) => {
    if (isBilingual(value)) return [[`${path} ${name}`, value] as const];
    if (value && typeof value === "object" && "panel" in value)
      return Object.entries(value)
        .filter(([, part]) => isBilingual(part))
        .map(
          ([part, table]) =>
            [`${path} ${name}.${part}`, table as Surface] as const,
        );
    return [];
  }),
);

/** Describes a copy value by shape alone, ignoring every word in it. */
function shapeOf(value: unknown): unknown {
  if (typeof value === "string") return "string";
  if (typeof value === "function") return "function";
  if (Array.isArray(value)) return value.map(shapeOf);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, shapeOf(entry)]),
    );
  return typeof value;
}

/** Every string in a copy value, in order. */
function stringsIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object")
    return Object.values(value).flatMap(stringsIn);
  return [];
}

/** The `why` facts and sources, localized one string at a time. */
const whyLocalized = [
  ...situation.map((statement) => statement.text),
  ...sources.flatMap((source) => [
    source.publisher,
    source.title,
    source.published,
  ]),
];

/** Strings that keep one spelling in both languages on purpose. */
const SHARED = new Set<string>([]);

describe("the two languages carry the same claims", () => {
  it("finds the copy tables", () => {
    const names = surfaces.map(([name]) => name).join("\n");
    for (const expected of [
      "shellCopy",
      "homeCopy",
      "replayCopy",
      "mappingStep.panel",
      "whyCopy",
      "architectureCopy",
      "ledgerCopy",
      "modelComparisonCopy",
      "tourCopy",
      "explainerCopy",
    ])
      expect(names).toContain(expected);
  });

  it("keeps every surface the same shape in both languages", () => {
    // A capability, limit or disclosure that exists in one language and not
    // the other shows up here as a missing key or a shorter list.
    for (const [name, surface] of surfaces) {
      const shapes = LANGUAGES.map((language) => shapeOf(surface[language]));
      for (const shape of shapes.slice(1))
        expect(JSON.stringify(shape), name).toBe(JSON.stringify(shapes[0]));
    }
  });

  it("leaves a string blank in one language only when it is blank in both", () => {
    for (const [name, surface] of surfaces) {
      const en = stringsIn(surface.en);
      const ko = stringsIn(surface.ko);
      en.forEach((value, index) =>
        expect(ko[index]!.trim() === "", `${name} #${index}: ${value}`).toBe(
          value.trim() === "",
        ),
      );
    }
    for (const value of whyLocalized)
      for (const language of LANGUAGES)
        expect(value[language].trim().length, value.en).toBeGreaterThan(0);
  });

  it("gives contract vocabulary one spelling in both languages", () => {
    const identifiers = [
      "SUPPORTED",
      "NOT_SUPPORTED",
      "INCONCLUSIVE",
      "REVIEW_REQUIRED",
      "canonicalReplayResultHash",
      "eventId",
      "rawRowHash",
    ];
    const rendered = Object.fromEntries(
      LANGUAGES.map((language) => [
        language,
        [
          ...surfaces.flatMap(([, surface]) => stringsIn(surface[language])),
          ...whyLocalized.map((value) => value[language]),
          howItWorksSvg(language),
        ].join("\n"),
      ]),
    ) as Record<Language, string>;
    for (const identifier of identifiers) {
      const carriers = LANGUAGES.filter((language) =>
        rendered[language].includes(identifier),
      );
      // Either both name it or neither does; a translated identifier would
      // show up as one carrier.
      expect(carriers.length, identifier).not.toBe(1);
    }
  });

  it("uses the fixed Korean product vocabulary", () => {
    // `분석 실행` runs the replay and `직접 조작` is working mode; the
    // retired words never reach a Korean screen.
    const korean = [
      ...surfaces.flatMap(([, surface]) => stringsIn(surface.ko)),
      ...whyLocalized.map((value) => value.ko),
    ].join("\n");
    for (const retired of ["리플레이", "워킹 모드"])
      expect(korean, retired).not.toContain(retired);
  });

  it("marks planned components as planned in both languages", () => {
    const planned: Readonly<Record<Language, RegExp>> = {
      en: /\bplanned\b/i,
      ko: /계획/,
    };
    for (const language of LANGUAGES) {
      for (const surface of [architectureCopy, shellCopy])
        expect(
          planned[language].test(stringsIn(surface[language]).join("\n")),
          language,
        ).toBe(true);
    }
  });

  it("states demo mode and the source kind on every page, in both languages", () => {
    for (const language of LANGUAGES) {
      const footer = shellCopy[language].footerStatus;
      expect(footer.toLowerCase(), language).toMatch(/demo|시연/);
      expect(
        /synthetic|합성/.test(footer) && !/quote|시세/.test(footer),
        language,
      ).toBe(true);
    }
  });

  it("writes Korean rather than repeating the English string", () => {
    for (const [name, surface] of surfaces) {
      const en = stringsIn(surface.en);
      const ko = stringsIn(surface.ko);
      expect(ko.length, name).toBe(en.length);
      // A repeated multi-word English phrase is an untranslated string.
      // Single tokens are product names, contract identifiers and machine
      // values, which carry one spelling on purpose.
      const shared = en.filter(
        (value, index) =>
          value === ko[index] && /[A-Za-z]{4,}\s+\S/.test(value),
      );
      for (const value of shared)
        expect(SHARED.has(value), `${name}: ${value}`).toBe(true);
    }
    for (const value of whyLocalized)
      expect(value.ko, value.en).not.toBe(value.en);
  });

  it("keeps a Korean name for every evaluation check", () => {
    for (const check of checks) {
      const [name] = ledgerCopy.ko.checks[check.name];
      expect(/[가-힣]/.test(name), check.name).toBe(true);
    }
  });
});
