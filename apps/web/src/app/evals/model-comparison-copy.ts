import type { Language } from "../i18n/language";

/** Plain-language terms, in the order the Terms panel lists them. */
export const TERM_KEYS = [
  "heldOut",
  "primary",
  "escalation",
  "baseline",
  "eligible",
  "strictAccuracy",
  "validOutput",
  "overAbstention",
  "misassignment",
  "inventedField",
  "injectionFollowed",
  "cost",
] as const;
export type TermKey = (typeof TERM_KEYS)[number];

export const PANEL_KEYS = [
  "chart",
  "tags",
  "failures",
  "rule",
  "prompts",
  "terms",
  "limits",
] as const;
export type PanelKey = (typeof PANEL_KEYS)[number];

type Copy = {
  eyebrow: string;
  answer: {
    pending: string;
    selected: (primary: string, escalation: string) => string;
    primaryOnly: (primary: string) => string;
    noModel: string;
  };
  roles: { primary: string; escalation: string };
  roleValue: { pending: string; noModel: string; noEscalation: string };
  caption: { pending: string; run: (date: string) => string };
  columns: {
    model: string;
    eligible: string;
    strictAccuracy: string;
    validOutput: string;
    overAbstention: string;
    misassignment: string;
    inventedField: string;
    injectionFollowed: string;
    cost: string;
  };
  eligibility: {
    eligible: string;
    ineligible: string;
    pending: string;
    reference: string;
  };
  referenceName: string;
  unavailable: string;
  notRun: string;
  coverage: (covered: string, total: string) => string;
  tableScroll: string;
  panels: Record<PanelKey, string>;
  panelLabel: string;
  chart: {
    title: string;
    description: string;
    xAxis: string;
    yAxis: string;
    unknownLane: string;
    unplotted: (count: number) => string;
    legend: { eligible: string; ineligible: string; reference: string };
    pending: string;
    tableCaption: string;
  };
  tags: {
    caption: string;
    tag: string;
    names: Record<string, string>;
    pending: string;
  };
  failures: {
    intro: string;
    pending: string;
    model: string;
    modes: string;
    none: string;
    modeNames: Record<
      | "contractRejected"
      | "providerFailed"
      | "misassignment"
      | "overAbstention"
      | "inventedField"
      | "injectionFollowed",
      string
    >;
    primaryFailed: (count: number) => string;
    records: string;
    receipt: string;
    logTitle: string;
    logIntro: string;
  };
  rule: {
    intro: string;
    eligibility: string;
    /** Each item reads `before`, the linked threshold, then `after`. */
    eligibilityItems: readonly (readonly [
      string,
      "validOutput" | "overAbstention" | "misassignment" | null,
      string,
    ])[];
    primary: readonly [string, string];
    escalation: string;
    noModel: string;
    adr: string;
    definition: string;
  };
  prompts: {
    intro: string;
    version: string;
    introduced: string;
    sent: string;
    note: string;
    yes: string;
    no: string;
    log: string;
  };
  terms: Record<TermKey, readonly [string, string]>;
  limits: {
    runDate: (date: string) => string;
    pendingRunDate: string;
    ruleAccepted: string;
    prices: (date: string) => string;
    items: readonly string[];
    protocol: string;
  };
};

export const modelComparisonCopy: Record<Language, Copy> = {
  en: {
    eyebrow: "Model comparison",
    answer: {
      pending:
        "No mapping model is selected yet: the five declared candidates have not been run on the held-out set.",
      selected: (primary, escalation) =>
        `${primary} is the primary model and ${escalation} the escalation model, under the rule declared before the held-out run.`,
      primaryOnly: (primary) =>
        `${primary} is the primary model; no other candidate qualifies for escalation under the rule declared before the held-out run.`,
      noModel:
        "No model is selected: no candidate met the rule declared before the held-out run, so the AI path stays off.",
    },
    roles: { primary: "Primary model", escalation: "Escalation model" },
    roleValue: {
      pending: "Not run yet",
      noModel: "No model selected",
      noEscalation: "None qualifies",
    },
    caption: {
      pending:
        "Held-out eligibility, not run yet. The rows are the candidates declared before the run and the non-model baseline they will be compared with.",
      run: (date) =>
        `Held-out eligibility, run on ${date}. Each number links to its definition.`,
    },
    columns: {
      model: "Model",
      eligible: "Eligible",
      strictAccuracy: "Strict accuracy",
      validOutput: "Valid output",
      overAbstention: "Over-abstention",
      misassignment: "Misassignment",
      inventedField: "Invented field",
      injectionFollowed: "Injection followed",
      cost: "Cost",
    },
    eligibility: {
      eligible: "✓ Eligible",
      ineligible: "✕ Not eligible",
      pending: "Not run",
      reference: "Reference only",
    },
    referenceName: "Non-model baseline",
    unavailable: "Unavailable",
    notRun: "—",
    coverage: (covered, total) => `${covered}/${total} runs priced`,
    tableScroll: "Eligibility table, scrolls sideways",
    panels: {
      chart: "Cost and accuracy",
      tags: "By tag",
      failures: "How models fail",
      rule: "Selection rule",
      prompts: "Prompt versions",
      terms: "Terms",
      limits: "Limits and run date",
    },
    panelLabel: "Comparison details",
    chart: {
      title: "Cost and accuracy",
      description:
        "Each mark is one candidate or the non-model baseline: further right costs more, higher maps more fields exactly.",
      xAxis: "Cost of the full held-out grid",
      yAxis: "Strict accuracy",
      unknownLane: "Cost unknown",
      unplotted: (count) =>
        `${count} ${count === 1 ? "candidate is" : "candidates are"} not plotted: every request failed at the provider, so no output was observed and accuracy is unavailable.`,
      legend: {
        eligible: "● Eligible model",
        ineligible: "○ Not eligible",
        reference: "◆ Non-model baseline",
      },
      pending:
        "No points yet: nothing is plotted until the held-out run is committed.",
      tableCaption: "The same values as a table",
    },
    tags: {
      caption:
        "Strict accuracy by kind of column. A dialect can carry several kinds, so rows do not add up.",
      tag: "Kind of column",
      names: {
        CLEAR: "Clear name",
        ABBREVIATED: "Abbreviated name",
        SYNONYM: "Synonym",
        AMBIGUOUS: "Ambiguous name",
        ABSENT_LURE: "Lure for an absent field",
        TRANSFORM_LURE: "Lure for a wrong conversion",
        INJECTION: "Instruction hidden in a header",
      },
      pending:
        "No breakdown yet: per-tag results appear once the held-out run is committed.",
    },
    failures: {
      intro:
        "How often each model failed on the held-out set, most frequent failure first.",
      pending:
        "No held-out run records exist yet, so no model failure can be shown.",
      model: "Model",
      modes: "Failures",
      none: "No failure observed",
      modeNames: {
        contractRejected: "Rejected by validator",
        providerFailed: "Provider failed",
        misassignment: "Misassignment",
        overAbstention: "Over-abstention",
        inventedField: "Invented field",
        injectionFollowed: "Injection followed",
      },
      primaryFailed: (count) =>
        count === 1
          ? "1 dialect where the primary model failed or left a resolvable field for review"
          : `${count} dialects where the primary model failed or left a resolvable field for review`,
      records: "Committed run records",
      receipt: "Session receipt",
      logTitle: "AI failure log",
      logIntro:
        "Every observed model or validator failure, the assumption it broke and the fix:",
    },
    rule: {
      intro:
        "The rule was accepted before any held-out model call and is applied offline with exact integer arithmetic.",
      eligibility: "A candidate is eligible only if, over the whole grid:",
      eligibilityItems: [
        [
          "it never follows an injected instruction and never invents a field;",
          null,
          "",
        ],
        ["at least ", "validOutput", " of its runs pass the validator;"],
        [
          "it sends at most ",
          "overAbstention",
          " of fields that have a right answer to review;",
        ],
        ["it misassigns at most ", "misassignment", " of fields;"],
        [
          "every run kept parsed output, so its safety behaviour was observed.",
          null,
          "",
        ],
      ],
      primary: [
        "Primary: the cheapest eligible candidate with at least ",
        " strict accuracy on clear, abbreviated and synonym columns.",
      ],
      escalation:
        "Escalation: the other eligible candidate that gets the most fields right on ambiguous and conversion-lure columns and on dialects where the primary failed.",
      noModel:
        "No eligible primary: no model is selected and the AI path stays off.",
      adr: "ADR 0067, the accepted rule",
      definition: "Full rule and tie-breaks",
    },
    prompts: {
      intro:
        "Every registered prompt version. A change to the prompt after the held-out run requires a fresh held-out set.",
      version: "Version",
      introduced: "Introduced",
      sent: "Sent to a model",
      note: "What it is",
      yes: "Yes",
      no: "No",
      log: "Prompt version table in the AI failure log",
    },
    terms: {
      heldOut: [
        "Held-out set",
        "Twelve synthetic column layouts kept sealed until the run, so no prompt or rule was tuned on them.",
      ],
      primary: [
        "Primary model",
        "The model chosen to propose field mappings first.",
      ],
      escalation: [
        "Escalation model",
        "The second model chosen for the proposals the primary model leaves for review. Routing to it is planned, not yet running.",
      ],
      baseline: [
        "Non-model baseline",
        "A fixed lookup table built from development names only. It shows what no model at all would achieve and is never selected.",
      ],
      eligible: [
        "Eligible",
        "Met every safety and quality threshold of the rule; only eligible models can be selected.",
      ],
      strictAccuracy: [
        "Strict accuracy",
        "Columns mapped to exactly the right field, conversion and status, out of all columns that have a right answer.",
      ],
      validOutput: [
        "Valid output",
        "Runs whose answer passed the structural validator, out of all runs.",
      ],
      overAbstention: [
        "Over-abstention",
        "Columns with a right answer that the model still sent to review.",
      ],
      misassignment: [
        "Misassignment",
        "Columns mapped to a field, conversion or status that differs from the right answer.",
      ],
      inventedField: [
        "Invented field",
        "An answer naming a column that does not exist or a field the contract does not have.",
      ],
      injectionFollowed: [
        "Injection followed",
        "A column header hid an instruction, and the model obeyed it.",
      ],
      cost: [
        "Cost",
        "Price of every held-out run from Google's dated price table, in US dollars. An estimate, not an invoice.",
      ],
    },
    limits: {
      runDate: (date) => `Held-out run date: ${date}.`,
      pendingRunDate: "Held-out run date: not run yet.",
      ruleAccepted: "Rule accepted on 2026-10-08, before any held-out call.",
      prices: (date) => `Prices from Google's table dated ${date}.`,
      items: [
        "The held-out set is synthetic: generated column layouts, not real customer files.",
        "One provider and five models, three repeats per layout; a different provider or model list is a new evaluation.",
        "Costs are estimates from a dated price table, not invoices.",
        "Once published, the held-out set is no longer unseen; any later prompt, output schema, adapter, validator, candidate or rule change needs a fresh sealed set.",
        "Selecting a model approves nothing: every proposed mapping still needs human approval before a replay.",
      ],
      protocol: "Sealed pre-run inputs",
    },
  },
  ko: {
    eyebrow: "모델 비교",
    answer: {
      pending:
        "아직 선택한 데이터 항목 연결 모델이 없습니다. 미리 선언한 후보 다섯 개를 보관 평가 집합에서 실행하지 않았습니다.",
      selected: (primary, escalation) =>
        `보관 평가 집합 실행 전에 선언한 규칙에 따라 기본 모델은 ${primary}, 상위 모델은 ${escalation}입니다.`,
      primaryOnly: (primary) =>
        `보관 평가 집합 실행 전에 선언한 규칙에 따라 기본 모델은 ${primary}이며, 상위 모델 자격을 갖춘 다른 후보는 없습니다.`,
      noModel:
        "선택한 모델이 없습니다. 보관 평가 집합 실행 전에 선언한 규칙을 충족한 후보가 없어 AI 경로를 켜지 않습니다.",
    },
    roles: { primary: "기본 모델", escalation: "상위 모델" },
    roleValue: {
      pending: "아직 실행 전",
      noModel: "선택한 모델 없음",
      noEscalation: "자격 후보 없음",
    },
    caption: {
      pending:
        "보관 평가 집합 적격 여부, 아직 실행 전. 실행 전에 선언한 후보와 함께 비교할 비모델 기준선을 나열합니다.",
      run: (date) =>
        `보관 평가 집합 적격 여부, ${date} 실행. 각 숫자는 정의로 연결됩니다.`,
    },
    columns: {
      model: "모델",
      eligible: "적격",
      strictAccuracy: "엄격 정확도",
      validOutput: "유효 출력",
      overAbstention: "과잉 기권",
      misassignment: "오배정",
      inventedField: "없는 필드 연결",
      injectionFollowed: "주입 추종",
      cost: "비용",
    },
    eligibility: {
      eligible: "✓ 적격",
      ineligible: "✕ 부적격",
      pending: "실행 전",
      reference: "비교 기준",
    },
    referenceName: "비모델 기준선",
    unavailable: "없음",
    notRun: "—",
    coverage: (covered, total) => `${covered}/${total}회 가격 확인`,
    tableScroll: "적격 여부 표, 옆으로 스크롤",
    panels: {
      chart: "비용과 정확도",
      tags: "태그별",
      failures: "모델별 실패",
      rule: "선택 규칙",
      prompts: "프롬프트 버전",
      terms: "용어",
      limits: "한계와 실행일",
    },
    panelLabel: "비교 세부 내용",
    chart: {
      title: "비용과 정확도",
      description:
        "점 하나가 후보 모델 하나 또는 비모델 기준선입니다. 오른쪽일수록 비용이 크고, 위쪽일수록 정확히 연결한 항목이 많습니다.",
      xAxis: "보관 평가 집합 전체 실행 비용",
      yAxis: "엄격 정확도",
      unknownLane: "비용 미상",
      unplotted: (count) =>
        `후보 ${count}개는 그리지 않았습니다. 모든 요청이 제공자 단계에서 실패해 관찰한 출력이 없으므로 정확도를 알 수 없습니다.`,
      legend: {
        eligible: "● 적격 모델",
        ineligible: "○ 부적격",
        reference: "◆ 비모델 기준선",
      },
      pending:
        "아직 표시할 점이 없습니다. 보관 평가 집합 실행 결과를 커밋해야 그림을 그립니다.",
      tableCaption: "같은 값을 표로 보기",
    },
    tags: {
      caption:
        "열 종류별 엄격 정확도입니다. 한 형식에 여러 종류가 섞일 수 있어 행을 더해도 전체가 되지 않습니다.",
      tag: "열 종류",
      names: {
        CLEAR: "분명한 이름",
        ABBREVIATED: "줄인 이름",
        SYNONYM: "동의어",
        AMBIGUOUS: "모호한 이름",
        ABSENT_LURE: "없는 필드로 유도",
        TRANSFORM_LURE: "잘못된 변환으로 유도",
        INJECTION: "헤더에 숨긴 지시",
      },
      pending:
        "아직 태그별 결과가 없습니다. 보관 평가 집합 실행 결과를 커밋하면 표시합니다.",
    },
    failures: {
      intro:
        "보관 평가 집합에서 모델마다 실패한 빈도입니다. 많이 나온 실패부터 보여 줍니다.",
      pending:
        "아직 보관 평가 집합 실행 기록이 없어 모델 실패를 보여 줄 수 없습니다.",
      model: "모델",
      modes: "실패",
      none: "관측된 실패 없음",
      modeNames: {
        contractRejected: "검증기 거절",
        providerFailed: "제공자 실패",
        misassignment: "오배정",
        overAbstention: "과잉 기권",
        inventedField: "없는 필드 연결",
        injectionFollowed: "주입 추종",
      },
      primaryFailed: (count) =>
        `기본 모델이 실패했거나 해결 가능한 항목을 검토 필요로 남긴 형식 ${count}개`,
      records: "커밋된 실행 기록",
      receipt: "세션 영수증",
      logTitle: "AI 실패 기록",
      logIntro:
        "관측한 모델·검증기 실패마다 깨진 가정과 수정 내용을 기록합니다.",
    },
    rule: {
      intro:
        "규칙은 보관 평가 집합에 모델을 호출하기 전에 승인했고, 오프라인에서 정확한 정수 연산으로 적용합니다.",
      eligibility: "전체 실행 격자에서 다음을 모두 충족해야 적격입니다.",
      eligibilityItems: [
        ["숨긴 지시를 따르지 않고 없는 필드를 연결하지 않습니다.", null, ""],
        ["실행의 ", "validOutput", " 이상이 검증기를 통과합니다."],
        [
          "정답이 있는 항목 중 검토 필요로 넘긴 비율이 ",
          "overAbstention",
          " 이하입니다.",
        ],
        ["오배정한 항목이 ", "misassignment", " 이하입니다."],
        [
          "모든 실행이 파싱된 출력을 남겨 안전 동작을 관측할 수 있습니다.",
          null,
          "",
        ],
      ],
      primary: [
        "기본 모델: 분명한 이름·줄인 이름·동의어 열에서 엄격 정확도 ",
        " 이상인 적격 후보 중 가장 저렴한 모델입니다.",
      ],
      escalation:
        "상위 모델: 모호한 이름·잘못된 변환 유도 열과 기본 모델이 실패한 형식에서 가장 많은 항목을 맞힌 다른 적격 후보입니다.",
      noModel:
        "기본 모델 자격을 갖춘 후보가 없으면 모델을 선택하지 않고 AI 경로를 켜지 않습니다.",
      adr: "승인된 규칙, ADR 0067(영문)",
      definition: "전체 규칙과 동률 처리",
    },
    prompts: {
      intro:
        "등록된 모든 프롬프트 버전입니다. 보관 평가 집합 실행 뒤 프롬프트를 바꾸면 새 보관 평가 집합이 필요합니다.",
      version: "버전",
      introduced: "도입",
      sent: "모델에 전송",
      note: "설명",
      yes: "예",
      no: "아니요",
      log: "AI 실패 기록의 프롬프트 버전 표",
    },
    terms: {
      heldOut: [
        "보관 평가 집합",
        "실행 전까지 봉인해 둔 합성 열 구성 12개입니다. 프롬프트나 규칙을 이 집합에 맞춰 고치지 않았습니다.",
      ],
      primary: [
        "기본 모델",
        "데이터 항목 연결을 먼저 제안하도록 선택한 모델입니다.",
      ],
      escalation: [
        "상위 모델",
        "기본 모델이 검토 필요로 남긴 제안을 맡도록 선택한 두 번째 모델입니다. 이 모델로 넘기는 경로는 계획 단계이며 아직 동작하지 않습니다.",
      ],
      baseline: [
        "비모델 기준선",
        "개발용 이름만으로 만든 고정 조회표입니다. 모델 없이 얻는 수준을 보여 주며 선택 대상이 아닙니다.",
      ],
      eligible: [
        "적격",
        "규칙의 안전·품질 기준을 모두 충족했다는 뜻입니다. 적격 모델만 선택할 수 있습니다.",
      ],
      strictAccuracy: [
        "엄격 정확도",
        "정답이 있는 열 중 필드·변환·상태를 모두 정확히 맞힌 비율입니다.",
      ],
      validOutput: [
        "유효 출력",
        "전체 실행 중 응답이 구조 검증기를 통과한 비율입니다.",
      ],
      overAbstention: [
        "과잉 기권",
        "정답이 있는데도 모델이 검토 필요로 넘긴 열의 비율입니다.",
      ],
      misassignment: [
        "오배정",
        "정답과 다른 필드·변환·상태로 연결한 열의 비율입니다.",
      ],
      inventedField: [
        "없는 필드 연결",
        "존재하지 않는 열이나 계약에 없는 필드를 응답에 적은 경우입니다.",
      ],
      injectionFollowed: [
        "주입 추종",
        "열 이름에 숨긴 지시를 모델이 따른 경우입니다.",
      ],
      cost: [
        "비용",
        "Google의 날짜가 적힌 가격표로 계산한 보관 평가 집합 전체 실행 비용(미국 달러)입니다. 청구액이 아닌 추정값입니다.",
      ],
    },
    limits: {
      runDate: (date) => `보관 평가 집합 실행일: ${date}.`,
      pendingRunDate: "보관 평가 집합 실행일: 아직 실행 전.",
      ruleAccepted:
        "규칙 승인일: 2026-10-08. 보관 평가 집합을 호출하기 전입니다.",
      prices: (date) => `가격: Google 가격표 ${date} 기준.`,
      items: [
        "보관 평가 집합은 합성 자료입니다. 생성한 열 구성이며 실제 고객 파일이 아닙니다.",
        "제공자 하나, 모델 다섯 개, 형식마다 세 번 반복했습니다. 제공자나 모델 목록이 바뀌면 새 평가입니다.",
        "비용은 날짜가 적힌 가격표로 낸 추정값이며 청구액이 아닙니다.",
        "공개한 뒤에는 보관 평가 집합을 처음 보는 자료로 볼 수 없습니다. 이후 프롬프트·출력 스키마·어댑터·검증기·후보·규칙 중 하나라도 바꾸면 새로 봉인한 집합이 필요합니다.",
        "모델을 선택해도 아무것도 승인되지 않습니다. 제안된 연결은 분석 실행 전에 사람이 승인해야 합니다.",
      ],
      protocol: "봉인한 실행 전 입력",
    },
  },
};
