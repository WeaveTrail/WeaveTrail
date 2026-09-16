import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { EvidenceGrade } from "@weavetrail/contracts";

import {
  EvidenceBadge,
  EvidenceGradeTally,
  countEvidenceGrades,
  evidenceGradeCopy,
  evidenceGradeForResult,
  formatEvidenceGradeTally,
} from "./evidence-grade";

const allGrades: readonly EvidenceGrade[] = [
  "QUOTED",
  "COMPUTED",
  "DIFFERS",
  "UNCONFIRMABLE",
  "INTERPRETATION",
];

const exampleCounts = {
  QUOTED: 7,
  COMPUTED: 5,
  DIFFERS: 1,
  UNCONFIRMABLE: 2,
  INTERPRETATION: 3,
} as const;

describe("evidence badges", () => {
  it("renders every fixed name and explanation in both languages", () => {
    const expected = {
      ko: [
        ["원문 인용", "원문 해당 구간과 글자 그대로 같습니다."],
        ["계산 확인", "공개 데이터로 다시 계산한 값과 같습니다."],
        [
          "불일치",
          "다시 계산하면 다른 값이 나옵니다. 계산한 값을 함께 표시합니다.",
        ],
        [
          "확인 불가",
          "공개 자료로는 확인할 수 없습니다. 이유와 필요한 자료를 함께 표시합니다.",
        ],
        ["AI 해석", "모델이 요약·분류했거나, 데이터로 판단할 문장이 아닙니다."],
      ],
      en: [
        ["Quoted", "Matches the source text exactly."],
        ["Recomputed", "Equals the value recomputed from public data."],
        [
          "Differs",
          "Recomputing gives a different value. The computed value is shown with it.",
        ],
        [
          "Not confirmable",
          "Public data cannot confirm this. The reason and what would settle it are shown with it.",
        ],
        [
          "AI interpretation",
          "A model summarized or classified this, or it is not a data question.",
        ],
      ],
    } as const;
    for (const language of ["ko", "en"] as const)
      expect(
        allGrades.map((grade) => [
          evidenceGradeCopy[language].grades[grade].label,
          evidenceGradeCopy[language].grades[grade].explanation,
        ]),
      ).toEqual(expected[language]);
  });

  it("keeps prohibited verdict language out of badge copy", () => {
    const prohibited = [
      "의심",
      "이상거래",
      "때문에 올랐다",
      "AI가 판단했다",
      "틀렸다",
      "오류",
      "가짜",
      "허위",
    ];
    for (const language of ["ko", "en"] as const) {
      const text = evidenceGradeCopy[language];
      const rendered = [
        text.relation,
        text.differenceNote,
        ...allGrades.flatMap((grade) => [
          text.grades[grade].label,
          text.grades[grade].tallyLabel,
          text.grades[grade].explanation,
        ]),
      ].join("\n");
      for (const phrase of prohibited)
        expect(rendered, `${language}: ${phrase}`).not.toContain(phrase);
    }
  });

  it("gives the visible badge a hidden relationship without exposing codes", () => {
    const korean = renderToStaticMarkup(
      createElement(EvidenceBadge, { grade: "COMPUTED", language: "ko" }),
    );
    const english = renderToStaticMarkup(
      createElement(EvidenceBadge, { grade: "COMPUTED", language: "en" }),
    );
    expect(korean).toContain("근거: ");
    expect(korean).toContain("계산 확인");
    expect(english).toContain("Evidence: ");
    expect(english).toContain("Recomputed");
    for (const internal of [
      "QUOTED",
      "COMPUTED",
      "DIFFERS",
      "UNCONFIRMABLE",
      "INTERPRETATION",
      "SUPPORTED",
      "NOT_SUPPORTED",
      "INCONCLUSIVE",
    ]) {
      expect(korean).not.toContain(internal);
      expect(english).not.toContain(internal);
    }
    expect(korean).not.toContain("title=");
    expect(english).not.toContain("title=");
  });

  it("always shows the fixed companion sentence beside a differing badge", () => {
    expect(
      renderToStaticMarkup(
        createElement(EvidenceBadge, {
          grade: "DIFFERS",
          language: "ko",
          computedValue: "1032.82",
        }),
      ),
    ).toContain("정의나 기준(종가·고가)의 차이일 수 있습니다.");
    const english = renderToStaticMarkup(
      createElement(EvidenceBadge, {
        grade: "DIFFERS",
        language: "en",
        computedValue: "1032.82",
      }),
    );
    expect(english).toContain("1032.82");
    expect(english).toContain(
      "The difference can come from a different definition or reference price (close, high).",
    );
  });

  it("renders the complete unconfirmable reason in the selected language", () => {
    const korean = renderToStaticMarkup(
      createElement(EvidenceBadge, {
        grade: "UNCONFIRMABLE",
        language: "ko",
        reason: {
          missing: "공개 시세는 하루 단위라 시각이 없습니다",
          wouldSettle: "분 단위 자료",
        },
      }),
    );
    expect(korean).toContain(
      "공개 시세는 하루 단위라 시각이 없습니다. 분 단위 자료가 연결되면 확인할 수 있습니다.",
    );
    const english = renderToStaticMarkup(
      createElement(EvidenceBadge, {
        grade: "UNCONFIRMABLE",
        language: "en",
        reason: {
          missing: "Public quotes are daily, so there is no time of day",
          wouldSettle: "Minute-level data",
        },
      }),
    );
    expect(english).toContain(
      "Public quotes are daily, so there is no time of day. Minute-level data would let us confirm it.",
    );
  });
});

describe("evidence tally", () => {
  it("uses the fixed order, separators and spoken form", () => {
    expect(formatEvidenceGradeTally(exampleCounts, "ko")).toEqual({
      visible:
        "문장 18 — 원문 인용 7 · 계산 확인 5 · 불일치 1 · 확인 불가 2 · AI 해석 3",
      spoken:
        "문장 18개 가운데 원문 인용 7개, 계산 확인 5개, 불일치 1개, 확인 불가 2개, AI 해석 3개입니다.",
    });
    expect(formatEvidenceGradeTally(exampleCounts, "en")).toEqual({
      visible:
        "18 sentences — 7 quoted · 5 recomputed · 1 differs · 2 not confirmable · 3 AI interpretation",
      spoken:
        "Of 18 sentences: 7 quoted, 5 recomputed, 1 differs, 2 not confirmable, 3 AI interpretation.",
    });
  });

  it("omits zero grades, handles singular totals and inserts commas", () => {
    expect(
      formatEvidenceGradeTally(
        {
          QUOTED: 0,
          COMPUTED: 1,
          DIFFERS: 0,
          UNCONFIRMABLE: 0,
          INTERPRETATION: 0,
        },
        "en",
      )?.visible,
    ).toBe("1 sentence — 1 recomputed");
    expect(
      formatEvidenceGradeTally(
        {
          QUOTED: 1_000,
          COMPUTED: 0,
          DIFFERS: 0,
          UNCONFIRMABLE: 0,
          INTERPRETATION: 0,
        },
        "ko",
      )?.visible,
    ).toBe("문장 1,000 — 원문 인용 1,000");
  });

  it("does not render a line for zero sentences", () => {
    const counts = countEvidenceGrades([]);
    expect(formatEvidenceGradeTally(counts, "ko")).toBeNull();
    expect(
      renderToStaticMarkup(
        createElement(EvidenceGradeTally, { counts, language: "ko" }),
      ),
    ).toBe("");
  });

  it("rejects invalid counts instead of producing a misleading tally", () => {
    expect(() =>
      formatEvidenceGradeTally(
        { ...exampleCounts, QUOTED: -1, COMPUTED: 1 },
        "en",
      ),
    ).toThrow("nonnegative safe integers");
    expect(() =>
      formatEvidenceGradeTally({ ...exampleCounts, QUOTED: 1.5 }, "en"),
    ).toThrow("nonnegative safe integers");
  });

  it("puts the spoken sentence on the rendered tally", () => {
    const markup = renderToStaticMarkup(
      createElement(EvidenceGradeTally, {
        counts: exampleCounts,
        language: "en",
      }),
    );
    expect(markup).toContain(
      'aria-label="Of 18 sentences: 7 quoted, 5 recomputed, 1 differs, 2 not confirmable, 3 AI interpretation."',
    );
    expect(markup).toContain('aria-hidden="true"');
  });
});

describe("evidence grade presentation rules", () => {
  it("maps internal results without rendering their names", () => {
    expect(evidenceGradeForResult("SUPPORTED")).toBe("COMPUTED");
    expect(evidenceGradeForResult("NOT_SUPPORTED")).toBe("DIFFERS");
    expect(evidenceGradeForResult("INCONCLUSIVE")).toBe("UNCONFIRMABLE");
  });

  it("uses only the assigned tokens and five non-color shapes", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/styles.css"),
      "utf8",
    );
    const start = styles.indexOf(".evidence-badge {");
    const end = styles.indexOf(".evidence-companion {");
    const badgeStyles = styles.slice(start, end);
    for (const token of [
      "--hairline-ink",
      "--authorship-code",
      "--result-supported-bg",
      "--result-supported",
      "--result-not-supported",
      "--text-inverse",
      "--result-inconclusive-bg",
      "--result-inconclusive",
      "--authorship-ai-bg",
      "--authorship-ai",
      "--border-proposal",
      "--radius-sm",
    ])
      expect(badgeStyles, token).toContain(token);
    expect(badgeStyles).not.toMatch(/--red-|--state-refused/);
    expect(badgeStyles).not.toContain("text-transform");
    expect(badgeStyles).toContain("background: transparent");
    expect(badgeStyles).toContain("border: 1px solid transparent");
    expect(badgeStyles).toContain("color: var(--text-inverse)");
    expect(badgeStyles).toContain(
      "border: 1px solid var(--result-inconclusive)",
    );
    expect(badgeStyles).toContain("border: var(--border-proposal)");
  });

  it("keeps the inverse label visible when print backgrounds are disabled", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/styles.css"),
      "utf8",
    );
    const print = styles.slice(styles.indexOf("@media print"));
    expect(print).toContain(".evidence-badge--inverse");
    expect(print).toContain("border: var(--hairline-ink)");
    expect(print).toContain("color: var(--authorship-code)");
    expect(print).toContain("background: transparent");
  });
});
