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
    adr: `${REPO}/docs/adr/0067-separate-mapping-validity-from-approval-before-selection.md`,
    prices: `${REPO}/packages/evals/fixtures/mapping-selection-v1/README.md`,
    protocol: `${REPO}/packages/evals/fixtures/mapping-selection-v1/protocol.json`,
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

export type ChartPoint = {
  name: string;
  kind: "eligible" | "ineligible" | "reference";
  /** Integer SVG coordinates; `costKnown: false` points sit in the left lane. */
  x: number;
  y: number;
  costKnown: boolean;
  accuracy: Count;
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
    const accuracy = all.strictAccuracy;
    const d = BigInt(accuracy.denominator);
    const rise = d === 0n ? 0n : (BigInt(accuracy.numerator) * height) / d;
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
      y: CHART.plotBottom - Number(rise),
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
