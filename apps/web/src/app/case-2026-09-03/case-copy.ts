import { type Language } from "../i18n/language";

export type CaseCopy = {
  heading: string;
  lede: string;
  meta: readonly string[];
  notOurJobTitle: string;
  notOurJob: readonly string[];
  sourcesTitle: string;
  sourcesLede: string;
  spotSource: string;
  futureSource: string;
  mappingReviewed: string;
  limitsTitle: string;
  limits: readonly string[];
  scopeTitle: string;
  scopeLede: string;
  analysedDate: string;
  baselineRange: string;
  legs: string;
  minimumMultiple: string;
  maximumRank: string;
  minimumAgreeing: string;
  exactScope: string;
  approve: string;
  approved: string;
  runTitle: string;
  runLede: string;
  run: string;
  running: string;
  runBlocked: string;
  resultTitle: string;
  gates: string;
  observations: string;
  gateNames: Readonly<Record<string, string>>;
  legNames: Readonly<Record<string, string>>;
  relations: Readonly<Record<string, string>>;
  columns: Readonly<Record<string, string>>;
  observed: string;
  threshold: string;
  passed: string;
  failed: string;
  rankReading: (position: string, population: string) => string;
  rankCaveat: string;
  evidenceTitle: string;
  evidenceLede: string;
  stopTitle: string;
  saysTitle: string;
  /** Read from the returned analysis: these sentences are rule output, so they
   *  cannot be written down ahead of the run. */
  says: (position: string, population: string) => readonly string[];
  doesNotSayTitle: string;
  doesNotSay: readonly string[];
  dayCaptionSpot: string;
  dayCaptionFuture: string;
  baselineCaption: string;
  chartNote: string;
  artifactHash: string;
};

export const caseCopy: Readonly<Record<Language, CaseCopy>> = {
  ko: {
    heading: "2026년 9월 3일, 코스피200에 무슨 일이 있었나",
    lede: "그날 지수는 전일보다 올라서 끝났습니다. 종가만 보면 평범한 하루입니다. 그런데 시가 1046.17보다 낮은 1032.82로 끝났고, 장중에는 1050.77까지 올랐다가 1009.7까지 내려갔습니다. 같은 날 선물도 같은 모양이었습니다. 아래 값은 전부 금융위원회가 공개한 원본 그대로입니다.",
    meta: [
      "금융위원회 공개 데이터",
      "45거래일 기준선",
      "승인해야 실행",
      "결과는 판정이 아님",
    ],
    notOurJobTitle: "먼저, 이 서비스가 하지 않는 일",
    notOurJob: [
      "이상 징후를 처음 찾아내는 일은 이 서비스의 역할이 아닙니다. 이 페이지는 이 날짜가 이미 지목되었다는 상황에서 시작합니다.",
      "날짜는 사람이 지정했고, 규칙은 지정된 날짜 하나만 평가합니다. 여러 날을 훑어 가장 그럴듯한 날을 고르지 않습니다. 계약에 그렇게 기록됩니다.",
    ],
    sourcesTitle: "무엇을 자료로 쓰는가",
    sourcesLede:
      "커밋된 공개 아티팩트 두 개입니다. 이 페이지가 값을 만들어 내지 않습니다.",
    spotSource: "현물 지수 · 금융위원회 지수시세정보 · 코스피 200",
    futureSource: "선물 · 금융위원회 파생상품시세정보 · 코스피200 F 202609",
    mappingReviewed:
      "두 자료의 데이터 항목 연결은 저장소에 이미 검토·기록되어 있습니다. 이 페이지에서 사용자가 승인하는 것은 조사 범위입니다.",
    limitsTitle: "이 자료로 답할 수 없는 것",
    limits: [
      "일별 자료입니다. 장중 시각, 개별 체결, 거래 주체, 주문 정보가 없습니다.",
      "그래서 몇 시에 무슨 일이 있었는지, 누가 사고팔았는지는 이 자료로 알 수 없습니다.",
      "하루의 시가·고가·저가·종가만으로 그날 안에서 얼마나 되돌렸는지까지는 볼 수 있습니다. 이 페이지가 확인하는 것은 거기까지입니다.",
    ],
    scopeTitle: "조사 범위 승인",
    scopeLede:
      "무엇을 어떤 기준으로 볼지 먼저 정합니다. 승인은 지금 보고 있는 이 내용 하나에만 묶이고, 서버는 실행 전에 다시 검증합니다.",
    analysedDate: "분석 대상일",
    baselineRange: "기준선 기간",
    legs: "비교할 두 시장",
    minimumMultiple: "최소 되돌림 배수",
    maximumRank: "허용하는 최대 기준선 순위",
    minimumAgreeing: "같은 모양이어야 하는 시장 수",
    exactScope: "승인할 내용 원문 보기",
    approve: "조사 범위 승인",
    approved: "조사 범위를 승인했습니다",
    runTitle: "증거 분석",
    runLede:
      "승인한 범위 안에서, 버전이 고정된 규칙이 두 시장의 하루를 다시 계산합니다.",
    run: "증거 분석 실행",
    running: "분석 실행 중…",
    runBlocked: "조사 범위를 먼저 승인하세요.",
    resultTitle: "결과",
    gates: "판단 항목",
    observations: "두 시장의 그날",
    gateNames: {
      BASELINE_RANK: "기준선 안에서의 순위",
      LEG_REVERSAL_MULTIPLE: "되돌림 배수",
      AGREEING_LEGS: "같은 모양을 보인 시장 수",
    },
    legNames: {
      "spot-index": "현물 지수 · 코스피 200",
      "front-future": "선물 · 코스피200 F 202609",
    },
    relations: {
      OPPOSED: "전일 대비 방향과 반대",
      ALIGNED: "전일 대비 방향과 같음",
      FLAT: "시가와 종가가 같음",
    },
    columns: {
      open: "시가",
      high: "고가",
      low: "저가",
      close: "종가",
      netChange: "전일 대비",
      sessionReversal: "그날 안에서 되돌린 폭",
      relation: "방향",
      reversalMultiple: "되돌림 배수",
    },
    observed: "관측값",
    threshold: "기준",
    passed: "충족",
    failed: "미충족",
    rankReading: (position, population) =>
      `기준선 ${population}거래일 가운데 ${position}번째`,
    rankCaveat:
      "선언된 기간 안에서의 순위일 뿐이며, 확률이 아닙니다. 기간을 바꾸면 순위도 바뀝니다.",
    evidenceTitle: "판단 근거가 나온 원본 행",
    evidenceLede:
      "각 판단이 참조한 기록을, 공개 자료의 원래 행과 열 값까지 그대로 펼쳐 봅니다.",
    stopTitle: "여기서 멈춥니다",
    saysTitle: "이 결과가 말하는 것",
    says: (position, population) => [
      `승인된 기간과 규칙 1.0 안에서, 2026-09-03은 현물 지수의 되돌림 배수가 기준선 ${population}거래일 가운데 ${position}번째였습니다.`,
      "그날 현물과 선물 모두, 전일 대비로는 올랐지만 그날 안에서는 시가보다 낮게 끝났습니다.",
      "위 문장은 모두 커밋된 공개 값에서 다시 계산할 수 있고, 결과 해시로 재현을 확인할 수 있습니다.",
    ],
    doesNotSayTitle: "이 결과가 말하지 않는 것",
    doesNotSay: [
      "누가 사고팔았는지, 왜 그랬는지는 말하지 않습니다. 이 자료에는 거래 주체가 없습니다.",
      "위법인지 아닌지도 말하지 않습니다. 이것은 법적 판단이 아니며 인과관계에 대한 결론도 아닙니다.",
      "다른 기간이나 다른 기준을 골랐다면 다른 순위가 나옵니다. 그 선택은 위에서 사람이 승인한 것입니다.",
      "이 결과는 선언된 패턴 가설을 승인된 범위 안에서 얼마나 뒷받침하는지만 말합니다.",
    ],
    dayCaptionSpot: "코스피 200 · 2026-09-03 · 발행처 공개 값",
    dayCaptionFuture: "코스피200 F 202609 · 2026-09-03 · 발행처 공개 값",
    baselineCaption:
      "코스피 200 · 기준선 45거래일의 고가–저가 구간과 종가 · 발행처 공개 값",
    chartNote:
      "그림에 그려진 값은 전부 발행처가 공개한 원본입니다. 순위와 배수는 아직 계산하지 않았습니다. 그것은 아래에서 규칙이 합니다.",
    artifactHash: "자료 해시",
  },
  en: {
    heading: "What happened to the KOSPI 200 on 3 September 2026",
    lede: "The index finished the day above the day before. On the close alone it is an ordinary session. It also finished at 1032.82, below its open of 1046.17, after reaching 1050.77 and falling to 1009.7 inside the same day. The front-month future did the same thing. Every figure below is the published value, as distributed.",
    meta: [
      "Published FSC data",
      "45 trading days of baseline",
      "runs only once approved",
      "a result is not a verdict",
    ],
    notOurJobTitle: "First, what this service does not do",
    notOurJob: [
      "Finding an unusual session in the first place is not this service's job. This page starts where that date has already been named.",
      "A person stated the date, and the rule evaluates that one date. It does not scan candidates and pick the most convincing one. The contract records that.",
    ],
    sourcesTitle: "What it reads",
    sourcesLede:
      "Two committed published artifacts. This page produces none of these values.",
    spotSource: "Spot index · FSC market index prices · KOSPI 200",
    futureSource: "Future · FSC derivative product prices · KOSPI 200 F 202609",
    mappingReviewed:
      "The field mapping for both artifacts was reviewed and recorded in the repository. What you approve on this page is the case scope.",
    limitsTitle: "What this data cannot answer",
    limits: [
      "These are daily records. There is no intraday time, no individual execution, no actor and no order information.",
      "So this data cannot say what happened at a particular hour, or who bought and sold.",
      "What four daily prices can still show is how much of the day was given back inside the day. That is as far as this page goes.",
    ],
    scopeTitle: "Approve the case scope",
    scopeLede:
      "What is examined, and against what, is settled first. An approval binds to this exact scope, and the server revalidates it before anything runs.",
    analysedDate: "Analysed date",
    baselineRange: "Baseline range",
    legs: "The two markets compared",
    minimumMultiple: "Minimum reversal multiple",
    maximumRank: "Highest baseline rank allowed",
    minimumAgreeing: "Markets that must agree",
    exactScope: "Inspect the exact scope",
    approve: "Approve the case scope",
    approved: "Case scope approved",
    runTitle: "Run the evidence",
    runLede:
      "Within the approved scope, versioned code recomputes both markets' session.",
    run: "Run the evidence analysis",
    running: "Running…",
    runBlocked: "Approve the case scope first.",
    resultTitle: "Result",
    gates: "Checks",
    observations: "Both markets that day",
    gateNames: {
      BASELINE_RANK: "Rank within the baseline",
      LEG_REVERSAL_MULTIPLE: "Reversal multiple",
      AGREEING_LEGS: "Markets showing the same shape",
    },
    legNames: {
      "spot-index": "Spot index · KOSPI 200",
      "front-future": "Future · KOSPI 200 F 202609",
    },
    relations: {
      OPPOSED: "opposite to the day's net change",
      ALIGNED: "same as the day's net change",
      FLAT: "open and close are equal",
    },
    columns: {
      open: "Open",
      high: "High",
      low: "Low",
      close: "Close",
      netChange: "Net change",
      sessionReversal: "Given back inside the day",
      relation: "Direction",
      reversalMultiple: "Reversal multiple",
    },
    observed: "Observed",
    threshold: "Threshold",
    passed: "Met",
    failed: "Not met",
    rankReading: (position, population) =>
      `Position ${position} of ${population} trading days in the baseline`,
    rankCaveat:
      "A position within the declared range, not a probability. Change the range and the position changes.",
    evidenceTitle: "The committed rows each check rests on",
    evidenceLede:
      "Every record a check referenced, opened back to the published row and its original column values.",
    stopTitle: "This is where it stops",
    saysTitle: "What this result says",
    says: (position, population) => [
      `Within the approved range and rule 1.0, 2026-09-03 sits at position ${position} of the ${population} baseline trading days by the spot index's reversal multiple.`,
      "On that date both the spot index and the front-month future closed above the previous day yet below their own open.",
      "Every sentence above can be recomputed from the committed published values, and the result hash checks that recomputation.",
    ],
    doesNotSayTitle: "What it does not say",
    doesNotSay: [
      "It says nothing about who bought or sold, or why. This data carries no actor.",
      "It says nothing about legality. This is not a legal conclusion and not a causal one.",
      "A different range or different thresholds would give a different position. That choice was approved above, by a person.",
      "The result states support for a declared pattern hypothesis under the approved scope, and nothing wider.",
    ],
    dayCaptionSpot: "KOSPI 200 · 2026-09-03 · published values",
    dayCaptionFuture: "KOSPI 200 F 202609 · 2026-09-03 · published values",
    baselineCaption:
      "KOSPI 200 · high-to-low span and close for 45 baseline trading days · published values",
    chartNote:
      "Everything drawn here is a published value. No rank and no multiple has been computed yet; that is the rule's work, below.",
    artifactHash: "Artifact hash",
  },
};
