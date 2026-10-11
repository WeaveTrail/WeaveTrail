/**
 * Why a reviewer would use WeaveTrail, kept as data so the page and its tests
 * read the same statements. The page opens from two published facts about
 * the reviewer's situation, each carrying its source, then says what the
 * reviewer gains. Sentences about WeaveTrail itself describe implemented
 * behaviour.
 *
 * Every string here is explanatory prose, so the two languages say the same
 * things with the same scope and the same hedging. Korean is written from the
 * meaning rather than from the English sentence, but it may not narrow, widen
 * or firm up a claim the English makes, and neither may the English.
 */

import type { Bilingual } from "../i18n/language";

/** One string per language. */
export type Localized = Bilingual<string>;

export type SourceId = "fss-surveillance-automation" | "financial-ai-guideline";

export interface Source {
  readonly id: SourceId;
  readonly marker: string;
  readonly publisher: Localized;
  readonly title: Localized;
  readonly published: Localized;
  readonly href: string;
}

/** A sentence about something outside this repository, with its source. */
export interface Statement {
  readonly text: Localized;
  readonly source: SourceId;
}

/** Historical policy/publication references; these links contain no quotation artifacts. */
export const sources: readonly Source[] = [
  {
    id: "fss-surveillance-automation",
    marker: "1",
    publisher: {
      en: "Financial Supervisory Service (금융감독원)",
      ko: "금융감독원",
    },
    title: {
      en: "Automating the market surveillance process for virtual asset unfair trading with AI (AI기반 가상자산 불공정거래 시장감시 프로세스 자동화)",
      ko: "AI기반 가상자산 불공정거래 시장감시 프로세스 자동화",
    },
    published: { en: "20 August 2026", ko: "2026년 8월 20일" },
    href: "https://www.fss.or.kr/fss/bbs/B0000188/view.do?nttId=223852&menuNo=200218",
  },
  {
    id: "financial-ai-guideline",
    marker: "2",
    publisher: {
      en: "Financial Services Commission (금융위원회)",
      ko: "금융위원회",
    },
    title: {
      en: "Financial sector AI guideline (금융분야 인공지능 가이드라인)",
      ko: "금융분야 인공지능 가이드라인",
    },
    published: {
      en: "announced 18 June 2026, in force 22 June 2026",
      ko: "2026년 6월 18일 발표, 2026년 6월 22일 시행",
    },
    href: "https://www.fsc.go.kr/no010101/87142",
  },
];

/** The reviewer's situation, in the two published facts it rests on. */
export const situation: readonly Statement[] = [
  {
    text: {
      en: "Korea's financial supervisor has set out AI from detection to a draft report.",
      ko: "금융감독원은 이상거래 탐지부터 보고서 초안까지 AI로 잇는 과정을 발표했습니다.",
    },
    source: "fss-surveillance-automation",
  },
  {
    text: {
      en: "The final decision, and the responsibility for it, still rest with people.",
      ko: "최종 판단과 그 책임은 여전히 사람에게 있습니다.",
    },
    source: "financial-ai-guideline",
  },
];

interface WhyCopy {
  readonly eyebrow: string;
  readonly title: string;
  /** What the service does about the situation, after the two facts. */
  readonly answer: string;
  readonly sections: Readonly<
    Record<"benefits" | "limits" | "sources", string>
  >;
  readonly benefitsLine: string;
  /** Each gain: a title, then one or two sentences. */
  readonly benefits: readonly (readonly [title: string, text: string])[];
  readonly limitsLine: string;
  readonly limits: readonly string[];
  readonly sourcesLine: string;
  readonly walkThrough: string;
  readonly next: string;
}

export const whyCopy: Bilingual<WhyCopy> = {
  en: {
    eyebrow: "Why WeaveTrail",
    title: "AI may find the case.|Explaining the decision|is still yours.",
    answer:
      "So a reviewer needs evidence they can check and explain themselves. Finding that evidence, down to the source trades, is this service's job.",
    sections: {
      benefits: "What a reviewer gains",
      limits: "What it does not do",
      sources: "Sources",
    },
    benefitsLine: "Four things change when you review with it.",
    benefits: [
      [
        "Unfamiliar files are ready to review",
        "Every venue and system names its columns differently. The AI finds which column holds which field first, and you only confirm it.",
      ],
      [
        "Only what you checked is computed",
        "An AI suggestion reaches the calculation only after you approve it. A malformed or unclear one stops before any calculation and asks you to check it.",
      ],
      [
        "Rerunning gives the same result",
        "The same data approved the same way always gives the same result. Another reviewer, or you later, can get that result again.",
      ],
      [
        "Evidence goes back to the source trades",
        "Every result links to the source trades behind it. When you explain a decision, you can show those trades directly.",
      ],
    ],
    limitsLine: "It helps a reviewer decide. It does not decide for them.",
    limits: [
      "It does not search for abnormal trading. You use it to review a case.",
      "It does not judge guilt or cause, and it gives no investment advice.",
      "It runs on synthetic data only, and its thresholds are examples.",
      "It has no affiliation with any body or system named on this page.",
    ],
    sourcesLine: "The two facts above come from these publications.",
    walkThrough: "Try an example",
    next: "See how it runs",
  },
  ko: {
    eyebrow: "왜 WeaveTrail인가",
    title: "AI가 찾아도,|판단을 설명하는 일은|검토자의 몫입니다.",
    answer:
      "그래서 검토자에게는 직접 확인하고 설명할 수 있는 근거가 필요합니다. 그 근거를 원본 거래까지 찾아 보여 주는 일을 이 서비스가 맡습니다.",
    sections: {
      benefits: "검토자가 얻는 것",
      limits: "하지 않는 일",
      sources: "출처",
    },
    benefitsLine: "이 서비스로 검토하면 네 가지가 달라집니다.",
    benefits: [
      [
        "처음 보는 자료도 바로 검토합니다",
        "거래소와 시스템마다 열 이름이 다릅니다. AI가 열마다 어떤 항목인지 먼저 찾아 두고, 검토자는 확인만 합니다.",
      ],
      [
        "확인한 내용만 계산에 씁니다",
        "AI 제안은 검토자가 승인해야 계산에 쓰입니다. 형식이 틀리거나 애매한 제안이 있으면 계산하지 않고 검토자에게 확인을 요청합니다.",
      ],
      [
        "다시 계산해도 결과가 같습니다",
        "자료와 승인 내용이 같으면 결과도 늘 같습니다. 다른 검토자도, 나중의 나도 같은 결과를 다시 얻을 수 있습니다.",
      ],
      [
        "근거를 원본 거래까지 보여 줍니다",
        "결과마다 근거가 된 원본 거래를 바로 열어 볼 수 있습니다. 판단을 설명할 때 그 거래를 그대로 보여 주면 됩니다.",
      ],
    ],
    limitsLine: "판단을 돕되, 대신 판단하지는 않습니다.",
    limits: [
      "이상거래를 직접 찾지 않습니다. 이미 찾아낸 사례를 검토할 때 씁니다.",
      "위법 여부나 원인을 판단하지 않으며, 투자 조언을 하지 않습니다.",
      "지금은 합성 자료로만 동작하며, 판단 기준은 예시로 정한 값입니다.",
      "이 페이지에 나오는 기관이나 시스템과는 아무 관계가 없습니다.",
    ],
    sourcesLine: "위의 두 사실은 아래 자료에서 가져왔습니다.",
    walkThrough: "예시로 체험하기",
    next: "작동 원리 보기",
  },
};
