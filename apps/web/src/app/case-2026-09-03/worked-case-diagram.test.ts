import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { LANGUAGES } from "../i18n/language";
import {
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
      expect(svg, language).toContain('viewBox="0 0 1200 540"');
      expect(svg, language).toContain("<title");
      expect(svg, language).toContain("<desc");
    }
  });
});
