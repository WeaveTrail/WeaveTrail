import type { Bilingual } from "../i18n/language";

type Item = readonly [title: string, line: string];

interface MethodologyCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly answer: string;
  readonly sections: Readonly<
    Record<"results" | "review" | "roles" | "computed" | "limits", string>
  >;
  readonly resultsLine: string;
  /** The three results, in the contract's own spelling. */
  readonly results: readonly Item[];
  readonly reviewLine: string;
  readonly reviewMore: string;
  readonly rolesLine: string;
  readonly roles: readonly Item[];
  readonly computedLine: string;
  readonly computedMore: readonly string[];
  readonly limitsLine: string;
  readonly limitsMore: readonly string[];
  readonly document: string;
}

export const methodologyCopy: Bilingual<MethodologyCopy> = {
  en: {
    eyebrow: "Methodology",
    title: "Three results, and a stop that is not one.",
    answer:
      "A result says whether approved data supports one versioned pattern hypothesis: SUPPORTED, NOT_SUPPORTED or INCONCLUSIVE. A problem found before anything runs is REVIEW_REQUIRED, which is never a result.",
    sections: {
      results: "The three results",
      review: "The stop before anything runs",
      roles: "Who decides what",
      computed: "How a result is computed",
      limits: "What a result does not mean",
    },
    resultsLine:
      "Each one is support for the declared pattern under the approved scope.",
    results: [
      [
        "SUPPORTED",
        "Validated data meets every required threshold of the approved rule version.",
      ],
      [
        "NOT_SUPPORTED",
        "The data is sufficient, and one or more required thresholds are not met.",
      ],
      [
        "INCONCLUSIVE",
        "Approved inputs ran, but valid evidence was too thin for the declared comparison.",
      ],
    ],
    reviewLine:
      "REVIEW_REQUIRED: a mapping, identity, scope or approval problem a person has to look at. Nothing runs, and no result hash exists.",
    reviewMore:
      "A rejected or ambiguous model proposal fails closed here. The person decides what happens next; nothing is decided for them.",
    rolesLine: "A model proposes, a person approves, and code decides.",
    roles: [
      [
        "A model may",
        "Propose a field mapping, and later a bounded case scope. Nothing else.",
      ],
      [
        "Code must",
        "Validate, order, deduplicate, calculate, evaluate, hash and keep every finding traceable.",
      ],
      [
        "Neither may",
        "Decide guilt, invent a missing fact, recommend a trade or place an order.",
      ],
    ],
    computedLine:
      "The same approved input always gives the same result and the same hash.",
    computedMore: [
      "Events are ordered by event time, then sequence, then event id. Prices, quantities and thresholds stay exact decimal strings; no floating-point arithmetic touches them.",
      "A duplicate source row is handled by an explicit rule, and conflicting events that share an identity are refused rather than dropped.",
      "Volatile metadata, such as when a request arrived, is left out of the result hash.",
    ],
    limitsLine: "Not guilt, a legal violation, causation or investment advice.",
    limitsMore: [
      "Removing the approved actors and recomputing is a mechanical sensitivity comparison, not a causal conclusion.",
      "Every committed case is synthetic, and each rule's thresholds are per-case configuration, not calibrated market thresholds.",
    ],
    document: "Read the full methodology",
  },
  ko: {
    eyebrow: "방법론",
    title: "결과는 셋이고, 결과가 아닌 멈춤이 하나 있습니다.",
    answer:
      "결과는 승인된 자료가 버전이 고정된 패턴 가설 하나를 뒷받침하는지를 말합니다. SUPPORTED, NOT_SUPPORTED, INCONCLUSIVE 가운데 하나입니다. 실행 전에 발견한 문제는 REVIEW_REQUIRED이며, 결과가 아닙니다.",
    sections: {
      results: "세 가지 결과",
      review: "실행 전의 멈춤",
      roles: "누가 무엇을 정하나",
      computed: "결과를 계산하는 방식",
      limits: "결과가 뜻하지 않는 것",
    },
    resultsLine:
      "어느 결과든 승인된 범위 안에서 선언된 패턴을 뒷받침하는 정도입니다.",
    results: [
      [
        "SUPPORTED",
        "검증된 자료가 승인된 규칙 버전의 판단 기준을 모두 충족합니다.",
      ],
      [
        "NOT_SUPPORTED",
        "자료는 충분하지만 판단 기준 하나 이상을 충족하지 못합니다.",
      ],
      [
        "INCONCLUSIVE",
        "승인된 입력으로 실행했지만, 선언된 비교에 쓸 근거가 부족합니다.",
      ],
    ],
    reviewLine:
      "REVIEW_REQUIRED는 항목 연결, 식별자, 범위, 승인에 사람이 봐야 할 문제가 있다는 뜻입니다. 아무것도 실행하지 않으며 결과 해시도 없습니다.",
    reviewMore:
      "거절되거나 모호한 모델 제안은 여기서 멈춥니다. 다음에 무엇을 할지는 사람이 정하며, 대신 결정되는 것은 없습니다.",
    rolesLine: "모델은 제안하고, 사람은 승인하고, 코드가 판정합니다.",
    roles: [
      [
        "모델이 할 수 있는 일",
        "항목 연결을 제안하고, 나중에는 한정된 조사 범위를 제안합니다. 그 밖의 일은 하지 않습니다.",
      ],
      [
        "코드가 해야 하는 일",
        "검증, 정렬, 중복 처리, 계산, 평가, 해시를 맡고 판단 근거를 끝까지 추적할 수 있게 둡니다.",
      ],
      [
        "둘 다 할 수 없는 일",
        "유죄를 판단하거나, 없는 사실을 만들거나, 거래를 권하거나, 주문을 넣지 않습니다.",
      ],
    ],
    computedLine: "같은 승인 입력은 언제나 같은 결과와 같은 해시를 냅니다.",
    computedMore: [
      "거래 기록은 체결 시각, 순번, 기록 식별자 순으로 정렬합니다. 가격, 수량, 판단 기준은 반올림 없는 소수 문자열이며 부동소수점 계산을 쓰지 않습니다.",
      "중복된 원본 행은 정해 둔 규칙대로 처리하고, 같은 식별자를 쓰면서 내용이 다른 기록은 버리지 않고 거부합니다.",
      "요청이 들어온 시각 같은 변동 메타데이터는 결과 해시에서 뺍니다.",
    ],
    limitsLine: "유죄, 법 위반, 인과, 투자 조언이 아닙니다.",
    limitsMore: [
      "승인된 거래 주체를 빼고 다시 계산한 값은 기계적인 민감도 비교이지 인과에 대한 결론이 아닙니다.",
      "커밋된 사례는 모두 합성 자료이며, 규칙의 판단 기준은 사례마다 정한 값이지 시장에 맞춰 보정한 값이 아닙니다.",
    ],
    document: "방법론 문서 전체 읽기",
  },
};
