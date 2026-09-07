import { type Language } from "../i18n/language";

export type Chapter = { title: string; purpose: string };

export type CaseCopy = {
  chapters: readonly Chapter[];
  pathCaption: string;
  pathNote: string;
  legShort: readonly [string, string];
  columnsLede: string;
  columnHeaders: readonly [string, string, string];
  legTableTitles: Readonly<Record<string, string>>;
  awaitingRun: string;
  previousCloseLabel: string;
  columnGloss: Readonly<Record<string, string>>;
  didTitle: string;
  did: readonly string[];
  closing: string;
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
  thresholdOrigin: string;
  artifactHash: string;
};

export const caseCopy: Readonly<Record<Language, CaseCopy>> = {
  ko: {
    chapters: [
      {
        title: "이 자료가 어디서 왔나",
        purpose:
          "결과를 의심하려면 자료부터 의심할 수 있어야 합니다. 무엇을 읽었고, 그 파일이 바뀌지 않았다는 건 어떻게 아는지 먼저 봅니다.",
      },
      {
        title: "열 이름의 뜻을 정한다",
        purpose:
          "발행처가 쓰는 말과 조사에서 쓰는 말은 다릅니다. 이 사례의 대응은 자료를 들여올 때 사람이 직접 작성하고 검토한 것입니다. 모델이 초안을 내는 경로는 사례 따라가기 쪽이고, 거기서도 모델은 승인하지 못합니다.",
      },
      {
        title: "무엇을 어떤 기준으로 볼지 정한다",
        purpose:
          "기간이나 기준을 넓히면 다른 결과가 나옵니다. 그래서 실행 전에 먼저 못 박고, 승인한 그 내용에만 결과를 묶습니다.",
      },
      {
        title: "정해진 기준으로 다시 계산한다",
        purpose:
          "여기서부터는 사람도 AI도 개입하지 않습니다. 버전이 고정된 코드가 승인된 자료만 읽고 계산합니다.",
      },
      {
        title: "결과를 원본까지 되짚는다",
        purpose:
          "숫자를 믿으라고 하지 않습니다. 각 판단이 어느 행에서 나왔는지 열어서 직접 확인하세요.",
      },
      {
        title: "여기서 멈춥니다",
        purpose:
          "더 말할 수 있는 자료가 없기 때문입니다. 어디까지 말했고 어디부터 말하지 않는지 분명히 합니다.",
      },
    ],
    pathCaption: "2026-09-03 하루의 움직임 · 발행처 공개 값",
    pathNote:
      "띠는 그날 고가와 저가 사이, 즉 하루가 오간 폭입니다. 선은 시가에서 종가까지이고, 이 두 점만 시각이 정해져 있습니다. 고가와 저가가 언제 나왔는지는 일별 자료에 없어서 둘 사이의 순서는 그리지 않았습니다.",
    legShort: ["코스피 200", "코스피200 선물"],
    columnsLede:
      "발행처는 자기 약어를 씁니다. 아래가 그 약어와, 조사에서 쓰는 이름의 대응입니다. 두 자료는 서로 다르게 대응합니다. 지수는 이름으로, 선물은 표준코드로 종목을 가립니다. 이 대응은 이미 검토·기록되어 있고, 이 페이지에서 사용자가 승인하는 것은 다음 단계의 조사 범위입니다.",
    legTableTitles: {
      "spot-index": "현물 지수 · 코스피 200",
      "front-future": "선물 · 코스피200 F 202609",
    },
    awaitingRun: "위에서 분석을 실행하면 결과가 여기에 나옵니다.",
    previousCloseLabel: "현물 전일 종가",
    columnHeaders: ["발행처 열 이름", "무슨 값인가", "조사에서 쓰는 이름"],
    columnGloss: {
      basDt: "거래일",
      idxNm: "지수 이름",
      srtnCd: "선물 단축코드",
      isinCd: "선물 표준코드",
      clpr: "종가",
      vs: "전일 대비 변화",
      mkp: "시가",
      hipr: "장중 고가",
      lopr: "장중 저가",
      trqu: "거래량",
    },
    didTitle: "이 서비스가 한 일",
    did: [
      "공개된 원본 자료를 그대로 읽었고, 파일이 바뀌지 않았음을 해시로 확인했습니다.",
      "열 이름의 뜻을 사람이 검토한 대로만 적용했습니다.",
      "무엇을 어떤 기준으로 볼지 사용자가 승인한 뒤에야 계산했습니다.",
      "판정은 AI가 아니라 버전이 고정된 코드가 했고, 같은 입력이면 같은 해시가 나옵니다.",
      "관측값은 그 값이 나온 공개 원본 행까지 열어서 확인할 수 있습니다. 기준값은 사람이 정한 것이고, 규칙·엔진 버전과 결과 해시는 실행 전체를 가리키며, 순위는 승인된 기준선 전체를 가로질러 계산한 값입니다.",
    ],
    closing:
      "이상거래를 찾아내는 일은 이 서비스가 하지 않습니다. 이미 지목된 사례를 두고, 그 근거를 처음부터 다시 밟아 확인할 수 있게 하는 것까지가 여기서 보여 드리는 범위입니다.",
    heading: "2026년 9월 3일, 코스피200에 무슨 일이 있었나",
    lede: "종가만 보면 평범한 하루입니다. 그런데 그날 안에서는 시가보다 낮게 끝났고, 선물도 같은 모양이었습니다. 아래는 그 하루를 처음부터 다시 확인하는 절차입니다. 여섯 단계를 순서대로 따라가면 됩니다.",
    meta: [
      "여섯 단계",
      "금융위원회 공개 데이터",
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
      "다른 기간이나 다른 기준을 골랐다면 다른 순위가 나옵니다. 그 기간과 기준은 이 사례를 만들 때 사람이 정한 것이고, 위에서 그대로 확인한 뒤 승인해 실행하게 됩니다.",
      "기준값은 이 날의 관측값을 이미 본 상태에서 정해졌습니다. 결과가 기준을 넘었다는 사실 자체는, 넘도록 고른 기준이라는 점과 함께 읽어야 합니다.",
      "이 결과는 선언된 패턴 가설을 승인된 범위 안에서 얼마나 뒷받침하는지만 말합니다.",
    ],
    dayCaptionSpot: "코스피 200 · 2026-09-03 · 발행처 공개 값",
    dayCaptionFuture: "코스피200 F 202609 · 2026-09-03 · 발행처 공개 값",
    baselineCaption:
      "코스피 200 · 기준선 45거래일의 고가–저가 구간과 종가 · 발행처 공개 값",
    thresholdOrigin:
      "이 기준값은 표준이 아닙니다. 이 사례를 만들면서 사람이 정한 값이고, 그때 이미 이 날의 관측값을 보고 있었습니다. 그래서 아래 결과에서는 관측값과 기준을 나란히 보여 줍니다. 둘의 간격이 얼마나 좁은지 직접 확인하세요.",
    artifactHash: "자료 해시",
  },
  en: {
    chapters: [
      {
        title: "Where this data came from",
        purpose:
          "Doubting a result means being able to doubt the data first. What was read, and how you know the file has not changed.",
      },
      {
        title: "Deciding what the column names mean",
        purpose:
          "The publisher's words and an investigation's words are not the same. For this case the join was written and reviewed by a person when the data was brought in. The path where a model drafts one is the guided walkthrough, and even there it cannot approve.",
      },
      {
        title: "Settling what is examined, and against what",
        purpose:
          "A wider range or a looser threshold gives a different result, so the scope is fixed before the run and the result binds to what was approved.",
      },
      {
        title: "Recomputing it under fixed rules",
        purpose:
          "From here neither a person nor a model intervenes. Versioned code reads only the approved data and computes.",
      },
      {
        title: "Tracing the result back to the source",
        purpose:
          "You are not asked to trust the numbers. Open each check and see the row it came from.",
      },
      {
        title: "Where this stops",
        purpose:
          "Because the data runs out. What was said, and what is deliberately not said.",
      },
    ],
    pathCaption: "The session of 2026-09-03 · published values",
    pathNote:
      "The band is the range between the session's high and low — how far the day travelled. The line runs from the open to the close, the only two points the record fixes in time. A daily record does not say when either extreme happened, so no order between them is drawn.",
    legShort: ["KOSPI 200", "KOSPI 200 future"],
    columnsLede:
      "The publisher uses its own abbreviations. Below is each one, what it holds, and the name an investigation gives it. The two artifacts do not map the same way: the index identifies its instrument by name, the future by standard code. This join was reviewed and recorded already; what you approve on this page is the scope in the next chapter.",
    legTableTitles: {
      "spot-index": "Spot index · KOSPI 200",
      "front-future": "Future · KOSPI 200 F 202609",
    },
    awaitingRun: "Run the analysis above and the result appears here.",
    previousCloseLabel: "spot previous close",
    columnHeaders: ["Publisher column", "What it holds", "Investigation name"],
    columnGloss: {
      basDt: "Trading date",
      idxNm: "Index name",
      srtnCd: "Future short code",
      isinCd: "Future standard code",
      clpr: "Closing price",
      vs: "Change against the previous close",
      mkp: "Opening price",
      hipr: "Session high",
      lopr: "Session low",
      trqu: "Traded volume",
    },
    didTitle: "What this service did",
    did: [
      "Read the published artifacts as distributed, and checked by hash that the files had not changed.",
      "Applied the column meanings only as a person had reviewed them.",
      "Computed nothing until you approved what would be examined and against what.",
      "Let versioned code decide rather than a model, and returned the same hash for the same input.",
      "Let each observed value open onto the published row it was derived from. The thresholds are a person's, the rule and engine versions and the result hash cover the run itself, and the rank is computed across the whole approved baseline.",
    ],
    closing:
      "Finding unusual trading is not this service's job. Taking a session someone has already named, and letting you walk its evidence from the beginning, is the whole of what is shown here.",
    heading: "What happened to the KOSPI 200 on 3 September 2026",
    lede: "On the close alone it is an ordinary session. Inside that same day it finished below its own open, and the front-month future did the same thing. What follows is the procedure for checking that day from the beginning, in six steps.",
    meta: [
      "Six steps",
      "Published FSC data",
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
      "A different range or different thresholds would give a different position. That range and those thresholds were set when this case was authored, and you read them above before approving and running them.",
      "The thresholds were chosen with this session's observations already known. That the result clears them has to be read together with the fact that they were picked to be cleared.",
      "The result states support for a declared pattern hypothesis under the approved scope, and nothing wider.",
    ],
    dayCaptionSpot: "KOSPI 200 · 2026-09-03 · published values",
    dayCaptionFuture: "KOSPI 200 F 202609 · 2026-09-03 · published values",
    baselineCaption:
      "KOSPI 200 · high-to-low span and close for 45 baseline trading days · published values",
    thresholdOrigin:
      "These thresholds are not a standard. A person set them while authoring this case, with this session's observations already in view. The result below therefore prints each observed value beside its threshold, so you can see how narrow the margin is.",
    artifactHash: "Artifact hash",
  },
};
