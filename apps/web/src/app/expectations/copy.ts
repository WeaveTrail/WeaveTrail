import type { Bilingual } from "../i18n/language";

/** Labels a reader is told to press, read from the walkthrough's own copy. */
export interface ControlLabels {
  readonly workingMode: string;
  readonly baseline: string;
  readonly approveMapping: string;
  readonly approveCase: string;
  readonly run: string;
  readonly normalize: string;
}

interface ExpectationsCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly answer: string;
  readonly sections: Readonly<
    Record<"outcomes" | "reproduce" | "capture", string>
  >;
  readonly outcomesLine: string;
  readonly columns: Readonly<
    Record<"case" | "listed" | "state" | "result" | "checks", string>
  >;
  readonly listed: string;
  readonly notListed: string;
  readonly notEvaluated: string;
  readonly checksPassing: (passed: number, total: number) => string;
  readonly noChecks: string;
  readonly purpose: Readonly<
    Record<"REVIEWER_FACING" | "ENGINE_REGRESSION", string>
  >;
  readonly facts: Readonly<
    Record<
      | "condition"
      | "mutations"
      | "reason"
      | "nonComparable"
      | "reviewIssues"
      | "hypothesis"
      | "evaluatedBy"
      | "manifest"
      | "instrument"
      | "actors"
      | "window"
      | "dataset"
      | "hash"
      | "gates"
      | "observed"
      | "threshold",
      string
    >
  >;
  readonly noHash: string;
  readonly noManifest: string;
  readonly noGates: string;
  readonly notProduced: string;
  readonly gate: Readonly<Record<"passed" | "failed" | "notEvaluated", string>>;
  readonly reproduceLine: string;
  readonly steps: (labels: ControlLabels) => readonly string[];
  readonly reproduceMore: readonly string[];
  readonly openWorkingMode: string;
  readonly captureLine: string;
  readonly environment: string;
  readonly platform: string;
  /** Tool names keep their own spelling in both languages. */
  readonly tools: Readonly<Record<"node" | "pnpm" | "vitest", string>>;
}

/**
 * The expected result of every committed synthetic case. The values come from
 * `scenario-expectations.json`; the reproduction steps quote the walkthrough's
 * own control labels, so renaming a control renames it here too.
 */
export const expectationsCopy: Bilingual<ExpectationsCopy> = {
  en: {
    eyebrow: "Expected results",
    title: "What each committed case returns.",
    answer:
      "Every synthetic case has one expected outcome, pinned by the test suite. Pick a case in working mode, run it, and compare.",
    sections: {
      outcomes: "Expected outcome per case",
      reproduce: "Reproduce one",
      capture: "How these were captured",
    },
    outcomesLine:
      "Cases in the Case Replay source list come first; the rest pin engine behaviour and run in pnpm test.",
    columns: {
      case: "Case",
      listed: "In Case Replay",
      state: "Final state",
      result: "Result",
      checks: "Checks passing",
    },
    listed: "Available",
    notListed: "Not available",
    notEvaluated: "Not evaluated",
    checksPassing: (passed, total) => `${passed} of ${total}`,
    noChecks: "—",
    purpose: {
      REVIEWER_FACING: "Reviewer-facing",
      ENGINE_REGRESSION: "Pins engine behavior",
    },
    facts: {
      condition: "Condition demonstrated",
      mutations: "Available input mutations",
      reason: "Abstention reason",
      nonComparable: "Non-comparable events",
      reviewIssues: "Review issue",
      hypothesis: "Versioned hypothesis",
      evaluatedBy: "evaluated by",
      manifest: "Manifest version",
      instrument: "Instrument",
      actors: "Approved actor group",
      window: "Window",
      dataset: "Canonical dataset hash",
      hash: "Canonical result hash",
      gates: "Gate readings",
      observed: "Observed",
      threshold: "threshold",
    },
    noHash: "Not produced; stopped for pre-replay review",
    noManifest:
      "No committed case manifest: the run ends after the approved mapping and normalization, before any pattern is evaluated.",
    noGates: "No rule gates or thresholds are declared for this source.",
    notProduced: "not produced",
    gate: { passed: "PASS", failed: "FAIL", notEvaluated: "NOT EVALUATED" },
    reproduceLine:
      "Five steps in a fresh browser session, with the default fixture provider.",
    steps: (labels) => [
      `Open ${labels.workingMode} and leave the input variation on ${labels.baseline}.`,
      "Choose a case marked Available in the table above.",
      `Give every field marked REVIEW_REQUIRED a reason, then select ${labels.approveMapping}.`,
      `If a case scope is shown, review it and select ${labels.approveCase}.`,
      `Select ${labels.run} (or ${labels.normalize}), then compare the final state, result, checks and result hash.`,
    ],
    reproduceMore: [
      "Approval hashing needs Web Crypto in a secure browser context: HTTPS or http://localhost. Elsewhere approvals stay unset and nothing runs.",
      "Repeating a run checks same-input repeatability only. These values describe one fixed source, approved mapping and rule version; they do not establish the truth of the source or any legal, causal or investment conclusion.",
    ],
    openWorkingMode: "Open working mode",
    captureLine:
      "The committed expectations were captured with pnpm expectations:update in this environment:",
    environment: "Environment",
    platform: "Linux WSL2 x86_64",
    tools: { node: "Node", pnpm: "pnpm", vitest: "Vitest" },
  },
  ko: {
    eyebrow: "기대 결과",
    title: "커밋된 사례마다 나오는 결과.",
    answer:
      "합성 사례마다 기대 결과가 하나씩 있고, 테스트가 그 값을 고정합니다. 직접 조작에서 사례를 골라 실행하고 비교해 보세요.",
    sections: {
      outcomes: "사례별 기대 결과",
      reproduce: "직접 재현하기",
      capture: "이 값을 캡처한 방법",
    },
    outcomesLine:
      "사례 따라가기의 원본 목록에 있는 사례를 먼저 두었습니다. 나머지는 엔진 동작을 고정하며 pnpm test로 실행합니다.",
    columns: {
      case: "사례",
      listed: "원본 목록",
      state: "최종 상태",
      result: "결과",
      checks: "충족한 판단 항목",
    },
    listed: "표시됨",
    notListed: "표시되지 않음",
    notEvaluated: "평가하지 않음",
    checksPassing: (passed, total) => `${total}개 중 ${passed}개`,
    noChecks: "—",
    purpose: {
      REVIEWER_FACING: "검토용",
      ENGINE_REGRESSION: "엔진 동작 고정용",
    },
    facts: {
      condition: "이 사례가 보여 주는 조건",
      mutations: "제공되는 입력 변경",
      reason: "판단 보류 사유",
      nonComparable: "비교할 수 없는 이벤트",
      reviewIssues: "검토 사유",
      hypothesis: "버전이 붙은 가설",
      evaluatedBy: "적용 규칙",
      manifest: "조사 범위 버전",
      instrument: "종목",
      actors: "승인된 행위자 그룹",
      window: "구간",
      dataset: "정리된 데이터셋 해시",
      hash: "분석 결과 해시",
      gates: "판단 항목 관측값",
      observed: "관측값",
      threshold: "판단 기준",
    },
    noHash: "생성되지 않음 · 실행 전 검토에서 멈춤",
    noManifest:
      "커밋된 조사 범위가 없습니다. 항목 연결 승인과 자료 정리까지만 하고 패턴은 평가하지 않습니다.",
    noGates: "이 원본에는 판단 항목이나 판단 기준이 선언되지 않았습니다.",
    notProduced: "생성되지 않음",
    gate: { passed: "충족", failed: "미충족", notEvaluated: "평가하지 않음" },
    reproduceLine:
      "기본 fixture 제안으로, 새 브라우저 세션에서 다섯 단계를 따릅니다.",
    steps: (labels) => [
      `${labels.workingMode} 화면을 열고 입력 자료 변경은 ${labels.baseline}에 둡니다.`,
      "위 표에서 표시됨인 사례를 고릅니다.",
      `REVIEW_REQUIRED로 표시된 항목마다 확인 이유를 적고 ${labels.approveMapping}을 누릅니다.`,
      `조사 범위가 보이면 검토한 뒤 ${labels.approveCase}을 누릅니다.`,
      `${labels.run}(또는 ${labels.normalize})을 누르고 최종 상태, 결과, 판단 항목, 결과 해시를 비교합니다.`,
    ],
    reproduceMore: [
      "승인 해시는 보안 브라우저 환경의 Web Crypto가 필요합니다. HTTPS와 http://localhost에서는 쓸 수 있고, 그 밖의 환경에서는 승인이 되지 않아 아무것도 실행되지 않습니다.",
      "다시 실행하면 같은 입력의 반복 가능성만 확인합니다. 이 값은 정해진 원본, 승인된 연결, 규칙 버전 하나에 대한 것이며 원본의 진위나 법적·인과적·투자 결론을 뜻하지 않습니다.",
    ],
    openWorkingMode: "직접 조작 열기",
    captureLine:
      "커밋된 기대값은 pnpm expectations:update로 다음 환경에서 캡처했습니다.",
    environment: "실행 환경",
    platform: "Linux WSL2 x86_64",
    tools: { node: "Node", pnpm: "pnpm", vitest: "Vitest" },
  },
};

/** The condition each case demonstrates, in Korean; English is the record's own. */
export const conditionsKo: Readonly<Record<string, string>> = {
  "published-execution-fix44-broad-participation.csv":
    "FIX 형태 체결 여섯 건 모두 비교할 입력을 갖춥니다. 매수 참여자가 분산되어 ACTOR_CONCENTRATION 기준(8000 bps)을 충족하지 못하고, 승인된 행위자를 제외해도 가격 상승폭이 같아 REMOVAL_SENSITIVITY 기준(100 bps)에 못 미치는 0 bps가 됩니다. 나머지 세 기준은 통과합니다.",
  "rapid-price-lift-supported.csv":
    "완전한 증거가 선언된 RAPID_PRICE_LIFT 판단 기준을 모두 충족합니다.",
  "rapid-price-lift-broad-participation.csv":
    "평가할 증거는 충분하지만 참여자가 분산되어 선언된 집중도 판단 기준을 충족하지 못합니다.",
  "rapid-price-lift-insufficient-evidence.csv":
    "구간 내 체결 네 건에 Side(54)가 모두 없어 규칙이 전부 비교 불가 증거로 제외하고 판단을 보류합니다.",
  "published-execution-fix44-conflicting-evidence.csv":
    "ExecID(17) 120001이 서로 다른 TransactTime(60)과 LastPx(31) 값으로 재사용되어, 재현 전에 입력 검토가 필요하고 결과 해시는 생성되지 않습니다.",
};
