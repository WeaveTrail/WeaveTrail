import { describe, expect, it } from "vitest";

import { LANGUAGES, type Language } from "./language";
import { chromeCopy } from "./chrome-text";
import { homeCopy } from "../home-content";
import { navigationCopy } from "../site-navigation";
import { architectureCopy } from "../architecture/architecture-content";
import { whyCopy } from "../why/why-view";
import { guideStepsByLanguage, guideUi } from "../replay/case-replay";
import { methodologyCopy } from "../methodology/methodology-content";
import { checks } from "../evals/page";
import { howItWorksSvg } from "../architecture/how-it-works-diagram";
import {
  CONCLUSION_NOT_METHOD,
  NON_AFFILIATION,
  NO_UPSTREAM_INTEGRATION,
  OWN_REASONING_MARK,
  POSITION,
  additionStatements,
  diagramAttribution,
  gateInputs,
  handoverStatements,
  layerAuthorities,
  lede,
  notClaimed,
  sources,
  upstreamStatements,
} from "../why/why-content";

/**
 * Each language writes its own voice copy, so the two surfaces cannot be
 * diffed line by line any more. What still has to hold is that they carry the
 * same claims: the same capabilities, the same limits, the same disclosures,
 * and one spelling for contract vocabulary.
 *
 * These checks are structural, because structure is what a translation can
 * silently drop — a role card, a layer, a chain entry, a "planned" marker.
 */

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

const surfaces: readonly (readonly [
  string,
  Readonly<Record<Language, unknown>>,
])[] = [
  ["chrome", chromeCopy],
  ["home", homeCopy],
  ["navigation", navigationCopy],
  ["architecture", architectureCopy],
  ["why", whyCopy],
  ["guide UI", guideUi],
  ["guide steps", guideStepsByLanguage],
  ["methodology", methodologyCopy],
];

const koreanEvaluationCheckNames = [
  "공개 시세의 도출과 정규화",
  "행 순서 불변성",
  "리터럴 골든 해시",
  "완전히 같은 중복 행 허용",
  "식별자 충돌 거부",
  "시각 형식 동등성",
  "밀리초 미만 순서",
  "로캘과 무관한 순서",
  "변동 메타데이터 제외",
  "혼합 sequence 정책",
  "방언 수렴",
  "데이터셋 프로파일 결정성",
  "매핑 승인 결속",
  "레코드 집합 완전성",
  "매핑 일치 보고",
  "도달 가능한 매핑 검토",
  "사례 분류",
  "증거 완전성",
];

/** The `why` argument, whose statements are localized one string at a time. */
const whyStatements = [
  lede,
  diagramAttribution,
  ...upstreamStatements,
  ...handoverStatements,
  ...additionStatements,
];

const whyLocalized = [
  POSITION,
  CONCLUSION_NOT_METHOD,
  NO_UPSTREAM_INTEGRATION,
  NON_AFFILIATION,
  OWN_REASONING_MARK,
  ...notClaimed,
  ...whyStatements.map((statement) => statement.text),
  ...gateInputs.flat(),
  ...layerAuthorities.flatMap((layer) => [
    layer.name,
    layer.may,
    layer.mayNot,
    ...(layer.status ? [layer.status] : []),
  ]),
  ...sources.flatMap((source) => [
    source.publisher,
    source.title,
    source.published,
  ]),
];

describe("the two languages carry the same claims", () => {
  it("holds a copy table for every language", () => {
    for (const [name, surface] of surfaces)
      expect(Object.keys(surface).sort(), name).toEqual([...LANGUAGES].sort());
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
    // The guide keeps a blank blocker for the steps that have none, so blank
    // is a value here. What would be a bug is a blank on one side only.
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
      // Either both surfaces name it or neither does; a translated identifier
      // would show up as one carrier.
      expect(carriers.length, identifier).not.toBe(1);
    }
  });

  it("marks planned components as planned in both languages", () => {
    // Neither language may present a planned component as working.
    const planned: Readonly<Record<Language, RegExp>> = {
      en: /\bplanned\b/i,
      ko: /계획/,
    };
    for (const language of LANGUAGES) {
      const architecture = stringsIn(architectureCopy[language]).join("\n");
      expect(planned[language].test(architecture), language).toBe(true);
      expect(
        planned[language].test(stringsIn(chromeCopy[language]).join("\n")),
        language,
      ).toBe(true);
    }
    for (const layer of layerAuthorities)
      if (layer.status)
        for (const language of LANGUAGES)
          expect(
            planned[language].test(layer.status[language]),
            layer.name.en,
          ).toBe(true);
  });

  it("states fixture mode and the source kind on every page, in both languages", () => {
    // The header context line and the home status strip are gone; the footer
    // is where these disclosures now reach every page, so both languages have
    // to carry them there.
    for (const language of LANGUAGES) {
      const footer = chromeCopy[language].footerStatus;
      expect(footer.toLowerCase(), language).toContain("fixture");
      expect(
        /synthetic|합성/.test(footer) && /quote|시세/.test(footer),
        language,
      ).toBe(true);
    }
  });

  it("writes Korean rather than repeating the English string", () => {
    // Voice copy and prose are written in each language. A Korean value equal
    // to its English one is an untranslated string, not a decision.
    for (const [name, surface] of surfaces) {
      const en = stringsIn(surface.en);
      const ko = stringsIn(surface.ko);
      expect(ko.length, name).toBe(en.length);
      // A repeated multi-word English phrase is an untranslated string. Single
      // tokens are product names, contract identifiers and machine values,
      // which carry one spelling on purpose.
      const shared = en.filter(
        (value, index) =>
          value === ko[index] && /[A-Za-z]{4,}\s+\S/.test(value),
      );
      // The guide's actor discriminants stay in English by design; nothing
      // else may.
      for (const value of shared)
        expect(
          [
            "Committed input",
            "A model proposed it",
            "A person approved it",
            "Versioned code decided it",
          ],
          `${name}: ${value}`,
        ).toContain(value);
    }
    for (const value of whyLocalized)
      expect(value.ko, value.en).not.toBe(value.en);
  });

  it("keeps a Korean name for every evaluation check", () => {
    expect(koreanEvaluationCheckNames).toHaveLength(checks.length);
    for (const name of koreanEvaluationCheckNames)
      expect(/[가-힣]/.test(name), name).toBe(true);
  });
});
