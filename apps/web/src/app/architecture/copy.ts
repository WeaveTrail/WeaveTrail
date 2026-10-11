import type { Bilingual } from "../i18n/language";

type Item = readonly [title: string, text: string];

interface ArchitectureCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly answer: string;
  readonly sections: Readonly<
    Record<
      "roles" | "results" | "mistakes" | "repeat" | "data" | "docs",
      string
    >
  >;
  readonly rolesLine: string;
  /** Who does what: the AI, the reviewer, the rules, the evidence trail. */
  readonly roles: readonly Item[];
  readonly resultsLine: string;
  /** The three results, each a contract value and what it means. */
  readonly results: readonly (readonly [
    result: "SUPPORTED" | "NOT_SUPPORTED" | "INCONCLUSIVE",
    name: string,
    text: string,
  ])[];
  readonly reviewRequired: string;
  readonly mistakesLine: string;
  readonly mistakes: readonly string[];
  readonly comparisonLink: string;
  readonly repeatLine: string;
  readonly repeat: readonly string[];
  readonly dataLine: string;
  readonly data: readonly string[];
  readonly docsLine: string;
  /** Each linked document's title, and its file name under `docs/`. */
  readonly docs: readonly (readonly [title: string, file: string])[];
}

/**
 * How the service runs, for a reader who already knows why they would use
 * it. Each section is a short line and a few one-sentence points; the
 * repository documents hold the rest.
 */
export const architectureCopy: Bilingual<ArchitectureCopy> = {
  en: {
    eyebrow: "How it runs",
    title: "The AI only suggests.|Fixed rules compute the result.",
    answer:
      "The AI, the reviewer and the rules each have their own part. So an AI mistake never reaches a result unchecked.",
    sections: {
      roles: "Who does what",
      results: "The three results",
      mistakes: "When the AI is wrong",
      repeat: "Why a rerun gives the same result",
      data: "How data is handled",
      docs: "Full documents",
    },
    rolesLine: "Each part does one job, and none does another's.",
    roles: [
      [
        "AI",
        "Suggests which field each column holds. It cannot compute a value or change the data. Suggesting a review scope is planned.",
      ],
      [
        "Reviewer",
        "Checks and approves the AI's suggestion and the review scope. A request that differs from what was approved does not run.",
      ],
      [
        "Rules",
        "Compute the result only within the approved scope. The rules are versioned, so the same input gives the same result.",
      ],
      [
        "Evidence trace",
        "Every finding is linked to its source trade row. A finding whose row cannot be found is not shown.",
      ],
    ],
    resultsLine:
      "A result says whether the data supports one declared pattern.",
    results: [
      ["SUPPORTED", "Supported", "Every threshold the rule declares is met."],
      [
        "NOT_SUPPORTED",
        "Not supported",
        "The data is sufficient, but at least one threshold is not met.",
      ],
      [
        "INCONCLUSIVE",
        "Inconclusive",
        "There is not enough data for the declared comparison.",
      ],
    ],
    reviewRequired:
      "REVIEW_REQUIRED is not a result. It means something needs checking before any calculation.",
    mistakesLine:
      "A malformed or unclear suggestion stops before the calculation.",
    mistakes: [
      "A suggestion that breaks the required format is rejected at validation.",
      "An unclear suggestion is not computed; the reviewer is asked to check it.",
      "The rule is to test the column-matching model and use only one that clears a bar set in advance.",
    ],
    comparisonLink: "See the model comparison",
    repeatLine: "Nothing in the calculation depends on chance or timing.",
    repeat: [
      "Prices and quantities are computed as exact decimals, never rounded.",
      "Trades are always ordered by time, then sequence, then record ID.",
      "Each result carries a hash, so a rerun can be compared at a glance.",
    ],
    dataLine:
      "Only what the demo needs is sent, and its contents are not stored.",
    data: [
      "Only synthetic data is used.",
      "Approvals and reviewer reasons are not stored.",
      "Request contents are not written to logs.",
      "The browser keeps only your language choice.",
    ],
    docsLine: "The documents below hold the full detail.",
    docs: [
      ["Architecture", "ARCHITECTURE"],
      ["Methodology", "METHODOLOGY"],
      ["Data handling", "DATA_HANDLING"],
      ["Evaluation", "EVALUATION"],
    ],
  },
  ko: {
    eyebrow: "작동 원리",
    title: "AI는 제안만 하고,|결과는 정해진 규칙으로 계산합니다.",
    answer:
      "AI와 검토자, 계산 규칙이 맡는 일을 나눠 두었습니다. 그래서 AI의 실수가 확인 없이 결과에 섞이지 않습니다.",
    sections: {
      roles: "누가 무엇을 맡나",
      results: "결과는 세 가지입니다",
      mistakes: "AI가 틀리면",
      repeat: "다시 계산해도 결과가 같은 이유",
      data: "자료를 다루는 방식",
      docs: "전체 문서",
    },
    rolesLine: "각자 맡은 일만 합니다.",
    roles: [
      [
        "AI",
        "열마다 어떤 항목인지 제안합니다. 값을 계산하거나 자료를 고치지는 못합니다. 조사 범위를 제안하는 기능은 계획 단계입니다.",
      ],
      [
        "검토자",
        "AI의 제안과 조사 범위를 확인하고 승인합니다. 승인한 내용과 다른 요청은 실행되지 않습니다.",
      ],
      [
        "계산 규칙",
        "승인한 범위 안에서만 결과를 계산합니다. 규칙의 버전이 고정되어 있어 입력이 같으면 결과도 같습니다.",
      ],
      [
        "근거 추적",
        "판단 근거마다 원본 거래 행을 찾아 연결합니다. 원본 행을 찾지 못한 근거는 보여 주지 않습니다.",
      ],
    ],
    resultsLine: "결과는 정해 둔 패턴 하나를 자료가 뒷받침하는지 알려 줍니다.",
    results: [
      ["SUPPORTED", "뒷받침함", "규칙에 정한 판단 기준을 모두 충족합니다."],
      [
        "NOT_SUPPORTED",
        "뒷받침하지 않음",
        "자료는 충분하지만, 충족하지 못한 기준이 있습니다.",
      ],
      ["INCONCLUSIVE", "판단 불가", "비교에 필요한 자료가 부족합니다."],
    ],
    reviewRequired:
      "REVIEW_REQUIRED는 결과가 아닙니다. 계산 전에 확인할 것이 있어 멈춘 상태입니다.",
    mistakesLine: "형식이 틀리거나 애매한 제안은 계산 전에 멈춥니다.",
    mistakes: [
      "정해진 형식에 맞지 않는 제안은 검증 단계에서 걸러집니다.",
      "애매한 제안은 계산하지 않고 검토자에게 확인을 요청합니다.",
      "열을 맞출 모델은 시험을 치르게 하고, 미리 정한 기준을 넘은 것만 쓰는 것이 원칙입니다.",
    ],
    comparisonLink: "모델 비교 보기",
    repeatLine: "계산 과정에는 우연이나 시점에 따라 달라지는 것이 없습니다.",
    repeat: [
      "가격과 수량은 반올림하지 않고 정확한 소수로 계산합니다.",
      "거래는 늘 체결 시각, 순번, 기록 번호 순으로 정렬합니다.",
      "결과마다 고유한 확인 값(해시)이 붙어, 다시 계산한 결과와 바로 비교할 수 있습니다.",
    ],
    dataLine: "체험에 필요한 것만 보내고, 그 내용은 저장하지 않습니다.",
    data: [
      "합성 자료만 씁니다.",
      "승인 내용과 검토자가 적은 확인 이유는 저장하지 않습니다.",
      "요청 내용은 로그에 남기지 않습니다.",
      "브라우저에는 언어 선택만 남깁니다.",
    ],
    docsLine: "자세한 내용은 아래 문서에 있습니다.",
    docs: [
      ["아키텍처", "ARCHITECTURE"],
      ["방법론", "METHODOLOGY"],
      ["데이터 처리", "DATA_HANDLING"],
      ["평가", "EVALUATION"],
    ],
  },
};
