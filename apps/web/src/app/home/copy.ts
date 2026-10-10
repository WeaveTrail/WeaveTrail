import type { Bilingual } from "../i18n/language";
import type { GuideStage } from "../guide-stages";

export const HOME_TERM_KEYS = [
  "mapping",
  "threshold",
  "validator",
  "versionedCode",
  "reviewRequired",
] as const;
export type HomeTermKey = (typeof HOME_TERM_KEYS)[number];

/**
 * The example screen on the first screen: the worked case's prepared mapping,
 * its result and its thresholds, and the control line.
 * `[[key|label]]` marks a term whose plain explanation opens from it; the key
 * names an entry of `terms`.
 */
interface ExampleCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly mappingLabel: string;
  readonly resultLabel: string;
  readonly rule: (rule: string) => string;
  readonly gatesLabel: string;
  readonly gateColumn: string;
  readonly observedColumn: string;
  readonly thresholdColumn: string;
  readonly passed: string;
  readonly failed: string;
  readonly unitNote: string;
  readonly resultHash: string;
  readonly control: string;
  readonly walkThrough: string;
  readonly seeExpected: string;
  readonly close: string;
  readonly terms: Readonly<Record<HomeTermKey, readonly [string, string]>>;
}

const EXAMPLE_EN: ExampleCopy = {
  eyebrow: "Example screen · synthetic data",
  title: "What the walkthrough ends with",
  mappingLabel:
    "Prepared [[mapping|column mapping]] you approve in the walkthrough",
  resultLabel: "Result",
  rule: (rule) => `Rule ${rule}`,
  gatesLabel: "Each [[threshold|threshold]] beside its observation",
  gateColumn: "Check",
  observedColumn: "Observed",
  thresholdColumn: "Threshold",
  passed: "Passes",
  failed: "Fails",
  unitNote: "Rates in basis points (100 bps = 1%); repeats are a count.",
  resultHash: "Result hash",
  control:
    "Rejected, malformed or ambiguous output stops at the [[validator|validator]] or at [[reviewRequired|REVIEW_REQUIRED]]. Only [[versionedCode|versioned code]] computes a result, after a person approves.",
  walkThrough: "Walk through a case",
  seeExpected: "Every case's expected results",
  close: "Close",
  terms: {
    mapping: [
      "Column mapping",
      "Saying which field each column of an unfamiliar data file holds, such as price or quantity, and how to convert its values.",
    ],
    threshold: [
      "Threshold",
      "The value a check must reach, fixed in the versioned rule before the case runs.",
    ],
    validator: [
      "Validator",
      "Code, not a model, that checks a proposal's fields and conversions against the versioned contract. A proposal it rejects goes no further.",
    ],
    versionedCode: [
      "Versioned code",
      "The replay engine at a fixed version: the same approved input always gives the same result and the same hash.",
    ],
    reviewRequired: [
      "REVIEW_REQUIRED",
      "Where a rejected or unclear proposal stops. A person has to look at it; nothing is decided for them.",
    ],
  },
};

const EXAMPLE_KO: ExampleCopy = {
  eyebrow: "예시 화면 · 합성 자료",
  title: "사례 따라가기의 마지막 화면",
  mappingLabel:
    "사례 따라가기에서 승인하는, 미리 준비된 [[mapping|데이터 항목 연결]]",
  resultLabel: "분석 결과",
  rule: (rule) => `규칙 ${rule}`,
  gatesLabel: "관측값 옆에 둔 [[threshold|판단 기준]]",
  gateColumn: "판단 항목",
  observedColumn: "관측값",
  thresholdColumn: "판단 기준",
  passed: "통과",
  failed: "미달",
  unitNote: "비율은 bps(100 bps = 1%), 반복 체결은 건수입니다.",
  resultHash: "결과 해시",
  control:
    "거절되거나 형식이 깨졌거나 모호한 출력은 [[validator|검증기]]나 [[reviewRequired|REVIEW_REQUIRED]]에서 멈춥니다. 결과는 사람이 승인한 뒤 [[versionedCode|버전이 고정된 코드]]만 계산합니다.",
  walkThrough: "사례 따라가기",
  seeExpected: "모든 사례의 기대 결과",
  close: "닫기",
  terms: {
    mapping: [
      "데이터 항목 연결",
      "처음 보는 데이터 파일의 각 열이 가격, 수량 같은 어느 항목인지, 값을 어떻게 바꿔 읽는지 정하는 일입니다.",
    ],
    threshold: [
      "판단 기준",
      "판단 항목이 넘어야 하는 값입니다. 사례를 실행하기 전에 버전이 고정된 규칙에 정해 둡니다.",
    ],
    validator: [
      "검증기",
      "모델이 아닌 코드입니다. 제안의 항목과 변환을 버전이 고정된 계약으로 검사하고, 거절한 제안은 더 나아가지 못합니다.",
    ],
    versionedCode: [
      "버전이 고정된 코드",
      "버전이 고정된 분석 엔진입니다. 같은 승인 입력은 언제나 같은 결과와 같은 해시를 냅니다.",
    ],
    reviewRequired: [
      "REVIEW_REQUIRED",
      "거절되거나 모호한 제안이 멈추는 상태입니다. 사람이 직접 확인해야 하며, 대신 결정되는 것은 없습니다.",
    ],
  },
};

/** The evaluation facts the "runs today" board cites, read on the server. */
export interface HomeEvaluation {
  readonly candidates: number;
  readonly runDate: string | null;
}

interface HomeCopy {
  /** What the site is, in one line, before any question about it. */
  readonly intro: {
    readonly eyebrow: string;
    readonly title: string;
    readonly lede: string;
    readonly walkMeta: string;
  };
  readonly example: ExampleCopy;
  readonly flowLabel: string;
  /** One short line per stage; the stage name already says who acts. */
  readonly stages: Readonly<Record<GuideStage, string>>;
  readonly flowStop: { readonly state: string; readonly text: string };
  readonly whyKicker: string;
  readonly whyHeading: string;
  readonly reasons: readonly (readonly [title: string, text: string])[];
  readonly boardKicker: string;
  readonly runsToday: string;
  readonly planned: string;
  readonly comparisonTitle: string;
  readonly comparison: (candidates: number, runDate: string | null) => string;
  readonly probesTitle: string;
  readonly probes: string;
  readonly failureLogTitle: string;
  readonly failureLog: (entries: number) => string;
  readonly guidedTitle: string;
  readonly guided: string;
  readonly plannedItems: readonly string[];
  readonly boundary: string;
  readonly gateLinkText: string;
}

/**
 * Voice copy is written in each language rather than translated. The first
 * screen says what the site is and offers the walkthrough, shows the end of
 * its worked case beside it, and draws the four stages below; the rest says why and
 * what exists, and every detail is one link away. Stage names
 * come from the guided walkthrough, so the two never name a stage differently.
 */
export const homeCopy: Bilingual<HomeCopy> = {
  en: {
    intro: {
      eyebrow: "Synthetic market-surveillance cases",
      title: "AI reads the data. Code decides the result.",
      lede: "A model suggests what each column of a trading file means. You approve it, versioned code checks the pattern, and every finding opens to its source row.",
      walkMeta: "8 steps · about 5–10 minutes · no sign-in",
    },
    example: EXAMPLE_EN,
    flowLabel: "From proposal to evidence",
    stages: {
      propose: "Suggests what each column holds",
      approve: "Nothing runs until approved",
      verify:
        "SUPPORTED, NOT_SUPPORTED or INCONCLUSIVE, the same for the same approved input",
      trace: "Every finding opens to its source row",
    },
    flowStop: {
      state: "REVIEW_REQUIRED · pre-replay",
      text: "Rejected or unclear: a person checks it before anything runs. Never a result.",
    },
    whyKicker: "Why it is needed",
    whyHeading: "Where a model helps, and where it goes wrong",
    reasons: [
      [
        "Every file names columns differently",
        "Is amt a quantity or an amount? One wrong link changes the result.",
      ],
      [
        "A model can be quietly wrong",
        "It can invent a column or obey text hidden in a cell.",
      ],
      [
        "So models are measured and fenced in",
        "Chosen by a rule fixed before the run, kept behind a validator and a person.",
      ],
    ],
    boardKicker: "What is built",
    runsToday: "Runs today",
    planned: "Planned",
    comparisonTitle: "Model comparison",
    comparison: (candidates, runDate) =>
      `${candidates} models + a non-model baseline${runDate ? ` · ${runDate}` : ""}`,
    probesTitle: "Validator under hostile output",
    probes: "Checked on every pull request",
    failureLogTitle: "AI failure log",
    failureLog: (entries) => `${entries} entries`,
    guidedTitle: "Walk through a case",
    guided: "8 steps · about 5–10 minutes",
    plannedItems: [
      "Escalate once to a stronger model, then a person",
      "Try a change: alter a column layout and watch",
      "AI-proposed case scope within the dataset profile",
    ],
    boundary:
      "Results describe support for a versioned pattern hypothesis on synthetic data, not guilt, causation or investment advice.",
    gateLinkText: "Where it fits",
  },
  ko: {
    intro: {
      eyebrow: "합성 시장감시 사례",
      title: "AI는 자료를 읽고, 판정은 코드가 합니다.",
      lede: "모델이 거래 파일의 열마다 뜻을 제안하면 사람이 승인하고, 버전이 고정된 코드가 패턴을 확인합니다. 판단 근거마다 원본 행이 열립니다.",
      walkMeta: "8단계 · 약 5~10분 · 회원가입 없음",
    },
    example: EXAMPLE_KO,
    flowLabel: "제안에서 근거까지",
    stages: {
      propose: "열마다 어느 항목인지 제안",
      approve: "승인 전에는 아무것도 실행하지 않음",
      verify:
        "SUPPORTED, NOT_SUPPORTED, INCONCLUSIVE 가운데 하나, 같은 승인 입력이면 언제나 같게",
      trace: "판단 근거마다 원본 행까지 열림",
    },
    flowStop: {
      state: "REVIEW_REQUIRED · 분석 실행 이전",
      text: "거절되거나 모호하면 실행 전에 사람이 확인합니다. 결과가 아닙니다.",
    },
    whyKicker: "필요한 이유",
    whyHeading: "모델이 돕는 곳, 그리고 틀리는 곳",
    reasons: [
      [
        "파일마다 열 이름이 다릅니다",
        "amt는 수량일까요, 금액일까요? 하나만 잘못 연결해도 결과가 바뀝니다.",
      ],
      [
        "모델은 조용히 틀릴 수 있습니다",
        "없는 열을 만들거나 셀 안에 숨은 지시를 따를 수 있습니다.",
      ],
      [
        "그래서 측정하고, 울타리 안에 둡니다",
        "실행 전에 정한 규칙으로 고르고, 검증기와 사람 뒤에 둡니다.",
      ],
    ],
    boardKicker: "만든 것",
    runsToday: "지금 동작",
    planned: "계획",
    comparisonTitle: "모델 비교",
    comparison: (candidates, runDate) =>
      `후보 ${candidates}개 + 비모델 기준선${runDate ? ` · ${runDate}` : ""}`,
    probesTitle: "적대 출력으로 시험한 검증기",
    probes: "PR마다 확인",
    failureLogTitle: "AI 실패 기록",
    failureLog: (entries) => `${entries}건`,
    guidedTitle: "사례 따라가기",
    guided: "8단계 · 약 5~10분",
    plannedItems: [
      "상위 모델에 한 번, 그다음 사람에게",
      "바꿔 보기: 열 구성을 바꾸고 반응 보기",
      "데이터 프로필 안에서 AI가 조사 범위 제안",
    ],
    boundary:
      "결과는 합성 자료 위에서 버전이 고정된 패턴 가설을 얼마나 뒷받침하는지 나타냅니다. 유죄, 인과, 투자 조언이 아닙니다.",
    gateLinkText: "어디에 쓰이나",
  },
};
