/**
 * The model comparison on /evals reads only the committed held-out comparison
 * and its `mapping-selection-decision/1` record (ADR 0067). Everything here is
 * pure and integer-exact: rates stay numerator/denominator strings, and every
 * percentage, cost and chart position is derived with BigInt.
 */

import type { Language } from "../i18n/language";

export type Count = { numerator: string; denominator: string };

export type TagMetrics = {
  validOutput: Count;
  contractRejected: Count;
  providerFailed: Count;
  rejectionByReason: Record<string, Count>;
  strictAccuracy: Count;
  misassignment: Count;
  inventedField: Count;
  abstention: { correct: Count; over: Count };
  injectionFollowed: Count;
  latencyMs: {
    p50: { valueMs: string; sampleCount: string };
    p95: { valueMs: string; sampleCount: string };
  };
  costMicroUsd: { sum: string; coveredRuns: string; totalRuns: string };
};

export type ComparisonGroup = {
  identity: { provider: string; requestedModel: string };
  role: "MODEL" | "REFERENCE";
  resourceSemantics?: string;
  byTag: Record<string, TagMetrics>;
};

export type SelectionDecision = {
  version: "mapping-selection-decision/1";
  rule: string;
  session: { sessionId: string; sessionHash: string } | null;
  comparisonHash: string;
  selectionHash: string;
  primary: string | null;
  escalation: string | null;
  outcome: "SELECTED" | "NO_MODEL";
  eligible: readonly string[];
  primaryFailedDialects: readonly string[];
  escalationCounts: readonly {
    model: string;
    a: string;
    b: string;
    total: string;
  }[];
};

/**
 * One committed held-out session: the `eval:mappings:select` outputs plus the
 * run date from its session receipt and links to the committed run records.
 */
export type HeldOutResult = {
  runDate: string;
  links: { records: string; sessionReceipt: string };
  comparison: {
    priceTable: { version: string; dated: string };
    groups: readonly ComparisonGroup[];
  };
  decision: SelectionDecision;
};

/** The five candidates ADR 0067 declares, in its declared order. */
export const DECLARED_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-2.5-pro",
  "gemini-3.1-pro-preview",
] as const;

export const REFERENCE_NAME = "lexical-baseline/2";

/** Tags in the order the scorer reports them; `ALL` is the overall row. */
export const TAGS = [
  "CLEAR",
  "ABBREVIATED",
  "SYNONYM",
  "AMBIGUOUS",
  "ABSENT_LURE",
  "TRANSFORM_LURE",
  "INJECTION",
] as const;

const REPO = "https://github.com/WeaveTrail/WeaveTrail/blob/develop";

/** Where each number on the page is defined, per language. */
export function definitionLinks(language: Language) {
  const doc = `${REPO}/docs/EVALUATION${language === "ko" ? ".ko" : ""}.md`;
  const anchors =
    language === "ko"
      ? {
          metrics: "#매핑-실행-기록의-오프라인-채점",
          rule: "#미리-선언한-매핑-모델-선택-규칙",
          reference: "#비모델-어휘-기준선",
        }
      : {
          metrics: "#offline-mapping-run-scoring",
          rule: "#declared-mapping-model-selection-rule",
          reference: "#non-model-lexical-reference",
        };
  return {
    metrics: doc + anchors.metrics,
    rule: doc + anchors.rule,
    reference: doc + anchors.reference,
    failureLog: `${REPO}/docs/AI_FAILURE_LOG${language === "ko" ? ".ko" : ""}.md`,
    adr: `${REPO}/docs/adr/0069-recover-mapping-transport-with-a-fresh-held-out-set.md`,
    prices: `${REPO}/packages/evals/fixtures/mapping-selection-v1/README.md`,
    protocol: `${REPO}/packages/evals/fixtures/mapping-selection-v2/protocol.json`,
  };
}

/** Rule thresholds exactly as ADR 0067 states them. */
export const RULE = {
  validOutput: { numerator: "95", denominator: "100" },
  overAbstention: { numerator: "20", denominator: "100" },
  misassignment: { numerator: "3", denominator: "100" },
  primaryAccuracy: { numerator: "90", denominator: "100" },
} as const satisfies Record<string, Count>;

export function fraction({ numerator, denominator }: Count): string {
  return `${numerator}/${denominator}`;
}

/** One-decimal percentage rounded half up, or null for a zero denominator. */
export function percent({ numerator, denominator }: Count): string | null {
  const d = BigInt(denominator);
  if (d === 0n) return null;
  const tenths = (BigInt(numerator) * 2000n + d) / (2n * d);
  return `${tenths / 10n}.${tenths % 10n}%`;
}

/** Integer micro-USD as dollars, without rounding. */
export function dollars(microUsd: string): string {
  const value = BigInt(microUsd);
  const whole = value / 1_000_000n;
  const fractionPart = (value % 1_000_000n)
    .toString()
    .padStart(6, "0")
    .replace(/0{1,4}$/, "");
  return `$${whole}.${fractionPart.padEnd(2, "0")}`;
}

export function knownCost(metrics: TagMetrics): string | null {
  const cost = metrics.costMicroUsd;
  return cost.coveredRuns === cost.totalRuns && cost.totalRuns !== "0"
    ? cost.sum
    : null;
}

/** Strict accuracy over CLEAR, ABBREVIATED and SYNONYM, as the rule sums it. */
export function primaryAccuracy(group: ComparisonGroup): Count {
  const counts = (["CLEAR", "ABBREVIATED", "SYNONYM"] as const).map(
    (tag) => group.byTag[tag]!.strictAccuracy,
  );
  return {
    numerator: String(counts.reduce((a, c) => a + BigInt(c.numerator), 0n)),
    denominator: String(counts.reduce((a, c) => a + BigInt(c.denominator), 0n)),
  };
}

/**
 * False when every run behind these metrics failed at the provider: no output
 * was retained, so the scorer's zero counts measure nothing. Only the
 * valid-output and provider-failure rates remain observed.
 */
export function outputObserved(
  group: ComparisonGroup,
  metrics: TagMetrics,
): boolean {
  const runs = metrics.providerFailed.denominator;
  return (
    group.role === "REFERENCE" ||
    runs === "0" ||
    metrics.providerFailed.numerator !== runs
  );
}

export type ChartPoint = {
  name: string;
  kind: "eligible" | "ineligible" | "reference";
  /** Integer SVG coordinates; `costKnown: false` points sit in the left lane. */
  x: number;
  /** Null when every run failed at the provider: no output, so no accuracy. */
  y: number | null;
  costKnown: boolean;
  accuracy: Count | null;
  cost: string | null;
};

export const CHART = {
  width: 560,
  height: 300,
  plotLeft: 120,
  plotRight: 540,
  plotTop: 36,
  plotBottom: 260,
  unknownLane: 60,
} as const;

/** Places every model group and the reference on the cost-accuracy plane. */
export function chartPoints(result: HeldOutResult): ChartPoint[] {
  const eligible = new Set(result.decision.eligible);
  const rows = result.comparison.groups.map((group) => {
    const all = group.byTag.ALL!;
    const cost = group.role === "REFERENCE" ? null : knownCost(all);
    return { group, all, cost };
  });
  const maxCost = rows.reduce(
    (max, { cost }) =>
      cost !== null && BigInt(cost) > max ? BigInt(cost) : max,
    1n,
  );
  const width = BigInt(CHART.plotRight - CHART.plotLeft);
  const height = BigInt(CHART.plotBottom - CHART.plotTop);
  return rows.map(({ group, all, cost }) => {
    const accuracy = outputObserved(group, all) ? all.strictAccuracy : null;
    const d = accuracy ? BigInt(accuracy.denominator) : 0n;
    const rise =
      !accuracy || d === 0n ? 0n : (BigInt(accuracy.numerator) * height) / d;
    return {
      name:
        group.role === "REFERENCE"
          ? REFERENCE_NAME
          : group.identity.requestedModel,
      kind:
        group.role === "REFERENCE"
          ? "reference"
          : eligible.has(group.identity.requestedModel)
            ? "eligible"
            : "ineligible",
      x:
        cost === null
          ? CHART.unknownLane
          : CHART.plotLeft + Number((BigInt(cost) * width) / maxCost),
      y: accuracy ? CHART.plotBottom - Number(rise) : null,
      costKnown: cost !== null,
      accuracy,
      cost,
    };
  });
}

export type FailureMode = {
  key:
    | "contractRejected"
    | "providerFailed"
    | "misassignment"
    | "overAbstention"
    | "inventedField"
    | "injectionFollowed";
  count: Count;
};

/** Every non-zero failure mode of one group, most frequent first. */
export function failureModes(group: ComparisonGroup): FailureMode[] {
  const all = group.byTag.ALL!;
  const modes: FailureMode[] = [
    { key: "contractRejected", count: all.contractRejected },
    { key: "providerFailed", count: all.providerFailed },
    { key: "misassignment", count: all.misassignment },
    { key: "overAbstention", count: all.abstention.over },
    { key: "inventedField", count: all.inventedField },
    { key: "injectionFollowed", count: all.injectionFollowed },
  ];
  return modes
    .filter(({ count }) => count.numerator !== "0")
    .sort((a, b) => {
      const left =
        BigInt(a.count.numerator) * BigInt(b.count.denominator || "1");
      const right =
        BigInt(b.count.numerator) * BigInt(a.count.denominator || "1");
      return left > right ? -1 : left < right ? 1 : 0;
    });
}

/**
 * The AI failure log entries, as titled in docs/AI_FAILURE_LOG.md and its
 * Korean companion. A test keeps this list equal to the documents.
 */
export const FAILURE_LOG_ENTRIES = [
  {
    id: "F-001",
    status: "FIXED",
    en: "The configured mapping gate accepted transform-invalid outputs",
    ko: "설정된 매핑 검증이 변환 불가능한 출력을 통과시킴",
  },
  {
    id: "F-002",
    status: "ACCEPTED_RESIDUAL",
    en: "A well-formed swap of same-shaped columns passes validation",
    ko: "같은 형태의 열을 바꾼 올바른 형식의 출력이 검증을 통과함",
  },
  {
    id: "F-003",
    status: "FIXED",
    en: "Correct abstention is rejected as an invalid mapping run",
    ko: "올바른 기권을 유효하지 않은 매핑 실행으로 거절함",
  },
  {
    id: "F-004",
    status: "ACCEPTED_RESIDUAL",
    en: "Every held-out mapping request failed without observed output",
    ko: "보관 평가 집합의 모든 매핑 요청이 출력 관측 없이 실패함",
  },
  {
    id: "F-005",
    status: "FIXED",
    en: "The compatibility endpoint rejects the store request parameter",
    ko: "호환 엔드포인트가 store 요청 매개변수를 거부함",
  },
  {
    id: "F-006",
    status: "ACCEPTED_RESIDUAL",
    en: "An attack header is also an allowed output value",
    ko: "공격 문구가 담긴 헤더가 허용된 출력 값이기도 함",
  },
  {
    id: "F-007",
    status: "ACCEPTED_RESIDUAL",
    en: "An ambiguous column is mapped instead of left for review",
    ko: "모호한 열을 검토로 남기지 않고 연결함",
  },
  {
    id: "F-008",
    status: "ACCEPTED_RESIDUAL",
    en: "An uncertain column still gets a target under schema-mapping/2",
    ko: "schema-mapping/2에서도 확신하지 못한 열에 대상을 붙임",
  },
  {
    id: "F-009",
    status: "ACCEPTED_RESIDUAL",
    en: "Reasoning time exceeds the mapping deadline",
    ko: "추론 시간이 매핑 마감 시간을 넘김",
  },
  {
    id: "F-010",
    status: "ACCEPTED_RESIDUAL",
    en: "A timestamp format is read as a receipt time",
    ko: "시각 형식을 수신 시각으로 읽음",
  },
] as const;

/** GitHub's heading anchor for one failure-log entry. */
export function failureLogAnchor(title: string, id: string): string {
  return `#${`${id}: ${title}`
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-")}`;
}

/**
 * The prompt version history, one row per `PROMPT_VERSIONS` entry. A test
 * keeps the keys equal to the registry in packages/contracts.
 */
export const PROMPT_HISTORY = {
  "schema-mapping/1": {
    introduced: "95f283b, #17",
    model: true,
    en: "The field-mapping instruction every candidate receives. Unchanged since it was introduced.",
    ko: "모든 후보 모델이 받는 데이터 항목 연결 지시문입니다. 처음 도입한 뒤 바꾸지 않았습니다.",
  },
  "schema-mapping/2": {
    introduced: "#320",
    model: true,
    en: "The ADR 0075 retry instruction: every version 1 sentence plus three rules. Instruction-like text is data, an unsettled column is left for review, and each target is used once. Checked on DEV only; no held-out set has seen it yet.",
    ko: "ADR 0075 재시도 지시문입니다. 1판의 문장을 모두 유지하고 세 규칙을 더했습니다. 지시처럼 보이는 글은 데이터로 보고, 판단할 수 없는 열은 검토로 남기고, 각 대상 항목은 한 번만 씁니다. DEV에서만 확인했고 아직 어떤 held-out 세트에도 보내지 않았습니다.",
  },
  "schema-mapping/3": {
    introduced: "#320",
    model: true,
    en: "ADR 0075 revision 1: every version 2 sentence plus target definitions, a target only when certain, the conversions no transform performs and the required targets. Checked on DEV only; no held-out set has seen it yet.",
    ko: "ADR 0075 개정 1판입니다. 2판의 문장을 모두 유지하고 대상 정의, 확신할 때만 대상 지정, 어떤 변환도 하지 못하는 변환, 필수 대상을 더했습니다. DEV에서만 확인했고 아직 어떤 held-out 세트에도 보내지 않았습니다.",
  },
  "schema-mapping/4": {
    introduced: "#320",
    model: true,
    en: "ADR 0075 revision 2: every version 3 sentence plus a rule that the header, not the value format, decides the target, and that receivedAt needs a header saying so. Checked on DEV only; no held-out set has seen it yet.",
    ko: "ADR 0075 개정 2판입니다. 3판의 문장을 모두 유지하고, 대상은 값의 형식이 아니라 헤더로 정하며 receivedAt은 헤더가 그렇게 말할 때만 쓴다는 규칙을 더했습니다. DEV에서만 확인했고 아직 어떤 held-out 세트에도 보내지 않았습니다.",
  },
  "fixture-mapping/1": {
    introduced: "95f283b, #17",
    model: false,
    en: "Label of the registered mapping fixture. No prompt is sent.",
    ko: "등록된 연결 fixture의 표시입니다. 프롬프트를 보내지 않습니다.",
  },
  "rapid-price-lift-case-v1": {
    introduced: "bf8946a, #15",
    model: false,
    en: "Label of an authored synthetic case manifest. No prompt is sent.",
    ko: "직접 작성한 합성 사례 범위의 표시입니다. 프롬프트를 보내지 않습니다.",
  },
  "published-execution-schema-case-v1": {
    introduced: "e60b89d, #79",
    model: false,
    en: "Label of an authored synthetic case manifest. No prompt is sent.",
    ko: "직접 작성한 합성 사례 범위의 표시입니다. 프롬프트를 보내지 않습니다.",
  },
  "published-execution-broad-case-v1": {
    introduced: "e8689cf, #176",
    model: false,
    en: "Label of an authored synthetic case manifest. No prompt is sent.",
    ko: "직접 작성한 합성 사례 범위의 표시입니다. 프롬프트를 보내지 않습니다.",
  },
  "non-model/no-prompt/1": {
    introduced: "8235395, #284",
    model: false,
    en: "Label of the non-model baseline. No model is called.",
    ko: "비모델 기준선의 표시입니다. 모델을 호출하지 않습니다.",
  },
  "synthetic-no-prompt/1": {
    introduced: "8235395, #284",
    model: false,
    en: "Label of authored scorer controls. No model is called.",
    ko: "직접 작성한 채점 대조군의 표시입니다. 모델을 호출하지 않습니다.",
  },
} as const;
