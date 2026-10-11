import type { Bilingual } from "../../i18n/language";
import type { GateName } from "../copy";

/** The five scenes of the guided walkthrough, in order. */
export const SCENES = [
  "source",
  "mapping",
  "scope",
  "result",
  "evidence",
] as const;
export type Scene = (typeof SCENES)[number];

type Verdict = "SUPPORTED" | "NOT_SUPPORTED" | "INCONCLUSIVE";

interface SceneText {
  /** The short name on the progress bar. */
  readonly short: string;
  readonly title: string;
  /** What the visitor is looking at and why it matters, one line each. */
  readonly lines: readonly string[];
}

interface TourCopy {
  readonly progressLabel: string;
  readonly sceneOf: (scene: number, total: number) => string;
  readonly back: string;
  readonly next: string;
  readonly scenes: Readonly<Record<Scene, SceneText>>;
  readonly source: {
    readonly rowsLabel: (rows: number) => string;
    readonly goalLabel: string;
    readonly goal: string;
    readonly action: string;
  };
  readonly mapping: {
    readonly columnHeader: string;
    readonly fieldHeader: string;
    readonly sampleHeader: string;
    /** What each canonical field is called on screen. */
    readonly fields: Readonly<Record<string, string>>;
    /** How a transform reads a value, where it does more than copy it. */
    readonly transforms: Readonly<Record<string, string>>;
    readonly reasons: string;
    readonly reasonsNote: string;
    readonly prepared: string;
    readonly action: string;
    readonly done: string;
  };
  readonly scope: {
    readonly sentence: (
      instrument: string,
      account: string,
      start: string,
      seconds: number,
    ) => string;
    readonly criteriaLabel: string;
    readonly criteria: Readonly<
      Record<GateName, (threshold: string) => string>
    >;
    readonly prepared: string;
    readonly action: string;
    readonly done: string;
  };
  readonly result: {
    readonly run: string;
    readonly running: string;
    readonly verdicts: Readonly<Record<Verdict, string>>;
    readonly tally: (passed: number, total: number) => string;
    readonly criterionHeader: string;
    readonly observedHeader: string;
    readonly thresholdHeader: string;
    readonly metHeader: string;
    readonly met: string;
    readonly notMet: string;
    readonly percent: (value: string) => string;
    readonly percentPoints: (value: string) => string;
    readonly count: (value: string) => string;
    readonly orMore: (value: string) => string;
    readonly reason: string;
    readonly repeat: string;
    readonly repeatSame: string;
    readonly repeatDifferent: string;
    readonly meaning: string;
    readonly action: string;
  };
  readonly evidence: {
    readonly pickLabel: string;
    readonly usedRows: (rows: number) => string;
    readonly rowHeader: string;
    readonly none: string;
    readonly finishTitle: string;
    readonly finishLines: readonly string[];
    readonly working: string;
    readonly howItRuns: string;
  };
  readonly errors: {
    readonly approval: string;
    readonly failed: string;
    readonly refused: string;
  };
}

/**
 * The guided walkthrough's words. Each scene says what the visitor is looking
 * at and why it matters before it asks for anything, and offers one action.
 */
export const tourCopy: Bilingual<TourCopy> = {
  en: {
    progressLabel: "Walkthrough progress",
    sceneOf: (scene, total) => `Step ${scene} of ${total}`,
    back: "Back",
    next: "Next",
    scenes: {
      source: {
        short: "Data",
        title: "You received a trading file",
        lines: [
          "These are trade records from one venue, exactly as received.",
          "Column names like ‘LastPx(31)’ do not say which one is the price.",
        ],
      },
      mapping: {
        short: "Columns",
        title: "The AI has worked out each column",
        lines: [
          "From the names and values, the AI says what each column holds.",
          "Check them and approve. Nothing is computed before you approve.",
        ],
      },
      scope: {
        short: "Scope",
        title: "Decide what to check",
        lines: [
          "Choose the instrument, the account and the time to examine.",
          "Nothing outside the approved scope is computed.",
        ],
      },
      result: {
        short: "Result",
        title: "Compute the result",
        lines: [
          "The approved data and scope are computed with fixed rules.",
          "The rules compute the result, not the AI.",
        ],
      },
      evidence: {
        short: "Evidence",
        title: "Find the evidence in the source trades",
        lines: [
          "Pick a criterion to mark the trades it used in the original file.",
          "Those are the trades you can show when you explain the result.",
        ],
      },
    },
    source: {
      rowsLabel: (rows) => `${rows} trades, as received`,
      goalLabel: "What this walkthrough checks",
      goal: "Whether the data shows a rapid price rise concentrated in one account's buying.",
      action: "See the AI's suggestion",
    },
    mapping: {
      columnHeader: "Column as received",
      fieldHeader: "What the AI says it is",
      sampleHeader: "First row",
      fields: {
        sourceEventId: "Trade ID",
        eventTime: "Trade time",
        instrumentId: "Instrument",
        side: "Buy or sell",
        price: "Price",
        quantity: "Quantity",
        actorId: "Account",
      },
      transforms: {
        FIX_UTC_TIMESTAMP_TO_ISO: "Read as a UTC time",
        FIX_SIDE_CODE: "1 means buy, 2 means sell",
        DECIMAL_STRING: "Read as an exact number",
      },
      reasons: "Show the AI's reasons",
      reasonsNote: "Shown in the AI's own words.",
      prepared: "This walkthrough uses a prepared AI suggestion.",
      action: "Approve as matched",
      done: "Approved",
    },
    scope: {
      sentence: (instrument, account, start, seconds) =>
        `For ${instrument}, in the ${seconds} seconds from ${start}: does the data show a rapid price rise concentrated in account ${account}'s buying?`,
      criteriaLabel:
        "The data supports the pattern when all five of these hold.",
      criteria: {
        PRICE_CHANGE: (value) => `The price rose by ${value}% or more`,
        AGGRESSIVE_BUY_SHARE: (value) =>
          `Buys made up ${value}% or more of the traded value`,
        ACTOR_CONCENTRATION: (value) =>
          `This account made ${value}% or more of the buying`,
        REPEATED_EXECUTION: (value) =>
          `This account bought above the reference price ${value} times or more`,
        REMOVAL_SENSITIVITY: (value) =>
          `Without this account, the rise shrinks by ${value} points or more`,
      },
      prepared:
        "The scope and criteria were set in advance for this walkthrough. The thresholds are examples.",
      action: "Approve this scope",
      done: "Approved",
    },
    result: {
      run: "Compute the result",
      running: "Computing…",
      verdicts: {
        SUPPORTED: "The data supports the pattern",
        NOT_SUPPORTED: "The data does not support the pattern",
        INCONCLUSIVE: "There is not enough data to decide",
      },
      tally: (passed, total) => `${passed} of ${total} criteria met.`,
      criterionHeader: "What was checked",
      observedHeader: "In this data",
      thresholdHeader: "Needed",
      metHeader: "Met?",
      met: "Met",
      notMet: "Not met",
      percent: (value) => `${value}%`,
      percentPoints: (value) => `${value} points`,
      count: (value) => `${value} times`,
      orMore: (value) => `${value} or more`,
      reason: "Why",
      repeat: "Compute it again",
      repeatSame: "Computed again: the same result.",
      repeatDifferent: "The second result differs. Compute it again.",
      meaning:
        "A result says only whether the declared pattern appears in the data. It is not a finding of wrongdoing or intent.",
      action: "See the evidence",
    },
    evidence: {
      pickLabel: "Pick a criterion",
      usedRows: (rows) =>
        rows === 1
          ? "1 trade used by this criterion"
          : `${rows} trades used by this criterion`,
      rowHeader: "Row",
      none: "This result has no criterion evidence to show.",
      finishTitle: "You have finished the walkthrough",
      finishLines: [
        "In hands-on mode you can pick other data or reorder the trades.",
        "Pick the ‘H0STCNT0’ data to see a case stop before any calculation.",
      ],
      working: "Try hands-on mode",
      howItRuns: "See how it runs",
    },
    errors: {
      approval: "The approval could not be recorded. Please try again.",
      failed: "The request did not finish. Nothing was computed.",
      refused: "The server refused the request:",
    },
  },
  ko: {
    progressLabel: "체험 진행 상황",
    sceneOf: (scene, total) => `${total}단계 중 ${scene}단계`,
    back: "이전",
    next: "다음",
    scenes: {
      source: {
        short: "자료",
        title: "거래 자료를 받았습니다",
        lines: [
          "한 거래소에서 받은 체결 기록을 받은 그대로 보여 줍니다.",
          "열 이름이 ‘LastPx(31)’ 같은 식이라 어느 열이 가격인지 알기 어렵습니다.",
        ],
      },
      mapping: {
        short: "항목",
        title: "AI가 열마다 뜻을 찾아 두었습니다",
        lines: [
          "열 이름과 값을 보고 AI가 각 열이 무엇인지 맞춰 두었습니다.",
          "맞는지 확인하고 승인하세요. 승인하기 전에는 아무것도 계산하지 않습니다.",
        ],
      },
      scope: {
        short: "범위",
        title: "무엇을 확인할지 정합니다",
        lines: [
          "어느 종목에서 어느 계좌의 거래를, 어느 시간대에 볼지 정합니다.",
          "승인한 범위 밖은 계산하지 않습니다.",
        ],
      },
      result: {
        short: "결과",
        title: "결과를 계산합니다",
        lines: [
          "승인한 자료와 범위를 정해진 규칙으로 계산합니다.",
          "계산은 AI가 아니라 규칙이 맡습니다.",
        ],
      },
      evidence: {
        short: "근거",
        title: "근거를 원본 거래에서 확인합니다",
        lines: [
          "기준을 하나 고르면 그 판단에 쓰인 거래가 원본 자료에 표시됩니다.",
          "결과를 설명할 때 이 거래를 그대로 보여 줄 수 있습니다.",
        ],
      },
    },
    source: {
      rowsLabel: (rows) => `받은 그대로의 체결 기록 ${rows}건`,
      goalLabel: "이번 체험에서 확인할 것",
      goal: "몇 초 사이에 한 계좌의 매수가 몰리며 가격이 빠르게 오른 패턴이 있는지 확인합니다.",
      action: "AI 제안 보기",
    },
    mapping: {
      columnHeader: "원래 열 이름",
      fieldHeader: "AI가 찾은 뜻",
      sampleHeader: "첫 행의 값",
      fields: {
        sourceEventId: "체결 번호",
        eventTime: "체결 시각",
        instrumentId: "종목",
        side: "매수·매도 구분",
        price: "체결 가격",
        quantity: "체결 수량",
        actorId: "계좌",
      },
      transforms: {
        FIX_UTC_TIMESTAMP_TO_ISO: "UTC 시각으로 읽음",
        FIX_SIDE_CODE: "1은 매수, 2는 매도로 읽음",
        DECIMAL_STRING: "반올림 없이 숫자로 읽음",
      },
      reasons: "AI가 든 근거 보기",
      reasonsNote: "AI가 쓴 원문 그대로입니다.",
      prepared: "이번 체험에서는 미리 준비한 AI 제안을 씁니다.",
      action: "이대로 승인",
      done: "승인했습니다",
    },
    scope: {
      sentence: (instrument, account, start, seconds) =>
        `${instrument} 종목의 ${start}부터 ${seconds}초 동안의 거래에서, ${account} 계좌의 매수가 몰리며 가격이 빠르게 오른 패턴이 나타나는지 봅니다.`,
      criteriaLabel:
        "아래 다섯 가지를 모두 충족하면 패턴을 뒷받침한다고 봅니다.",
      criteria: {
        PRICE_CHANGE: (value) => `가격이 ${value}% 이상 올랐는가`,
        AGGRESSIVE_BUY_SHARE: (value) =>
          `전체 거래대금 가운데 매수가 ${value}% 이상인가`,
        ACTOR_CONCENTRATION: (value) =>
          `매수 거래대금 가운데 이 계좌의 몫이 ${value}% 이상인가`,
        REPEATED_EXECUTION: (value) =>
          `이 계좌가 기준 가격보다 비싸게 ${value}번 이상 샀는가`,
        REMOVAL_SENSITIVITY: (value) =>
          `이 계좌의 거래를 빼면 상승 폭이 ${value}%p 이상 줄어드는가`,
      },
      prepared:
        "이번 체험의 조사 범위와 기준은 미리 정해 두었습니다. 기준값은 예시입니다.",
      action: "이 범위로 승인",
      done: "승인했습니다",
    },
    result: {
      run: "결과 계산하기",
      running: "계산 중…",
      verdicts: {
        SUPPORTED: "자료가 패턴을 뒷받침합니다",
        NOT_SUPPORTED: "자료가 패턴을 뒷받침하지 않습니다",
        INCONCLUSIVE: "판단할 자료가 부족합니다",
      },
      tally: (passed, total) =>
        `기준 ${total}개 가운데 ${passed}개를 충족했습니다.`,
      criterionHeader: "확인한 것",
      observedHeader: "이 자료의 값",
      thresholdHeader: "기준",
      metHeader: "충족 여부",
      met: "충족",
      notMet: "미충족",
      percent: (value) => `${value}%`,
      percentPoints: (value) => `${value}%p`,
      count: (value) => `${value}번`,
      orMore: (value) => `${value} 이상`,
      reason: "이유",
      repeat: "한 번 더 계산하기",
      repeatSame: "다시 계산해도 같은 결과가 나왔습니다.",
      repeatDifferent: "두 결과가 다릅니다. 다시 계산해 보세요.",
      meaning:
        "결과는 정해 둔 패턴이 자료에 나타나는지만 말해 줍니다. 위법이나 의도를 판단한 것은 아닙니다.",
      action: "근거 보기",
    },
    evidence: {
      pickLabel: "기준 고르기",
      usedRows: (rows) => `이 기준에 쓰인 거래 ${rows}건`,
      rowHeader: "행",
      none: "이 결과에는 보여 줄 근거가 없습니다.",
      finishTitle: "체험을 마쳤습니다",
      finishLines: [
        "직접 조작에서는 다른 자료를 고르거나 거래 순서를 바꿔 볼 수 있습니다.",
        "‘H0STCNT0 형식’ 자료를 고르면 계산 전에 멈추는 경우도 볼 수 있습니다.",
      ],
      working: "직접 조작해 보기",
      howItRuns: "작동 원리 보기",
    },
    errors: {
      approval: "승인을 기록하지 못했습니다. 다시 시도해 주세요.",
      failed: "요청을 마치지 못했습니다. 아무것도 계산하지 않았습니다.",
      refused: "서버가 요청을 거부했습니다:",
    },
  },
};
