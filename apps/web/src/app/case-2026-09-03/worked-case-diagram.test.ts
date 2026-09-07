import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { LANGUAGES } from "../i18n/language";
import {
  CONTENT_RIGHT,
  NAMED_ARTIFACTS,
  workedCaseFigures,
  workedCaseSvg,
} from "./worked-case-diagram";

/**
 * The committed worked-case figures are written from this module, so a reader
 * can reproduce their bytes from the committed artifacts with one command
 * (`pnpm diagram:case`) and CI fails when the two disagree. What the figure
 * shows and what the rule returns cannot drift apart, because there is only
 * one source for both.
 */

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const DIAGRAMS = {
  en: "docs/assets/worked-case.svg",
  ko: "docs/assets/worked-case.ko.svg",
} as const;

describe("the worked-case diagram", () => {
  const figures = workedCaseFigures();

  it.each(Object.entries(DIAGRAMS))(
    "writes %s from this module",
    async (language, file) => {
      await expect(
        workedCaseSvg(language as keyof typeof DIAGRAMS, figures),
      ).toMatchFileSnapshot(resolve(process.cwd(), file));
    },
  );

  it("reads every published price from the committed artifacts", () => {
    for (const artifact of NAMED_ARTIFACTS) {
      const source = `packages/published-data/src/sources/real/${artifact}/source.jsonl`;
      expect(existsSync(resolve(process.cwd(), source)), source).toBe(true);
      for (const file of Object.values(DIAGRAMS))
        expect(read(file), file).toContain(artifact);
    }
  });

  it("shows every observation beside the threshold it was compared with", () => {
    // The safeguard for a published result over a real instrument: a reader
    // sees the threshold and its origin next to the observation it decided.
    for (const language of LANGUAGES) {
      const svg = workedCaseSvg(language, figures);
      for (const leg of figures.legs) {
        expect(svg, language).toContain(`${leg.multiple}×`);
        expect(svg, language).toContain(leg.multipleThreshold);
      }
      expect(svg, language).toContain(figures.rank);
      expect(svg, language).toContain(figures.population);
      expect(svg, language).toContain(figures.rankThreshold);
      expect(svg, language).toContain(figures.agreeingThreshold);
    }
  });

  it("says the figures are deterministic output rather than an approved case", () => {
    expect(workedCaseSvg("en", figures)).toContain(
      "not an approved case or evidence",
    );
    expect(workedCaseSvg("ko", figures)).toContain(
      "승인된 사례나 증거가 아닙니다",
    );
  });

  it("draws both languages from the same geometry", () => {
    for (const language of LANGUAGES) {
      const svg = workedCaseSvg(language, figures);
      expect(svg, language).toContain('viewBox="0 0 1200 560"');
      expect(svg, language).toContain("<title");
      expect(svg, language).toContain("<desc");
    }
  });
});

/**
 * A standalone SVG does not wrap, so a line that runs past the panel is simply
 * clipped when a README embeds it — which is how a material caveat about the
 * thresholds went missing. Real font metrics need a browser, so this estimates
 * generously: it exists to catch a line that overruns its panel, not to
 * measure typography.
 */
const EM = { cjk: 1, space: 0.3, upper: 0.7, digit: 0.62, other: 0.56 };
const FONT_SIZE: Readonly<Record<string, number>> = {
  eyebrow: 11,
  title: 27,
  sub: 14,
  panelLabel: 11,
  who: 11,
  leg: 13,
  key: 12,
  val: 13,
  big: 20,
  gate: 12,
  note: 12,
  foot: 11,
};

const widthOf = (text: string, size: number) =>
  [...text].reduce((total, character) => {
    if (/[\u1100-\u11ff\u3000-\u303f\uac00-\ud7af]/.test(character))
      return total + EM.cjk * size;
    if (character === " ") return total + EM.space * size;
    if (/[A-Z]/.test(character)) return total + EM.upper * size;
    if (/[0-9]/.test(character)) return total + EM.digit * size;
    return total + EM.other * size;
  }, 0);

describe("worked-case diagram layout", () => {
  const figures = workedCaseFigures();

  it.each(LANGUAGES)("keeps every %s line inside the panel", (language) => {
    const svg = workedCaseSvg(language, figures);
    const overruns = [
      ...svg.matchAll(
        /<text class="([a-zA-Z]+)[^"]*" x="([\d.]+)"[^>]*?(text-anchor="(end|middle)")?[^>]*>([^<]+)<\/text>/g,
      ),
    ]
      .map((match) => {
        const size = FONT_SIZE[match[1] ?? ""] ?? 12;
        const width = widthOf(match[5] ?? "", size);
        const x = Number(match[2]);
        const anchor = match[4];
        const right =
          anchor === "end"
            ? x
            : anchor === "middle"
              ? x + width / 2
              : x + width;
        return { right: Math.round(right), text: match[5] };
      })
      .filter(({ right }) => right > CONTENT_RIGHT);
    expect(overruns).toEqual([]);
  });

  it("reports a gate that did not pass as not met", () => {
    // Every gate passes today. If a threshold or an artifact ever changed that,
    // regenerating must not produce a figure claiming the comparison held.
    const failing = {
      ...figures,
      rankPassed: false,
      legs: figures.legs.map((leg, index) =>
        index === 0 ? { ...leg, multiplePassed: false } : leg,
      ),
    };
    for (const language of LANGUAGES) {
      const states = [
        ...workedCaseSvg(language, failing).matchAll(
          /<text class="gate"[^>]*>[^<]*·\s*([^<]+)<\/text>/g,
        ),
      ].map((match) => match[1]?.trim());
      const [notMet, met] =
        language === "ko" ? ["미충족", "충족"] : ["not met", "met"];
      expect(states, language).toEqual([notMet, met, notMet]);
    }
  });
});
