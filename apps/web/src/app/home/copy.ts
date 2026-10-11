import type { Bilingual } from "../i18n/language";
import type { GuideStage } from "../guide-stages";

/**
 * Voice copy is written in each language rather than translated. The first
 * screen says what a reviewer gains and offers the walkthrough, with the four
 * stages beside it; below it, what changes for the reviewer and how the AI is
 * chosen. Stage names come from the guided walkthrough, so the two never name
 * a stage differently.
 *
 * A multi-sentence string is set one sentence per line, so each sentence
 * stays short enough for the column it sits in.
 */
interface HomeCopy {
  readonly intro: {
    readonly eyebrow: string;
    readonly title: string;
    /** Two sentences that back the title with what the reviewer gains. */
    readonly lede: readonly string[];
    readonly walkThrough: string;
    readonly walkMeta: string;
    /** The walkthrough's data and suggestion are prepared; said plainly. */
    readonly demoNote: string;
  };
  readonly flowLabel: string;
  /** What the visitor does at each stage, and what it gives them. */
  readonly stages: Readonly<Record<GuideStage, string>>;
  readonly benefitsKicker: string;
  readonly benefitsHeading: string;
  readonly benefits: readonly (readonly [title: string, text: string])[];
  readonly modelKicker: string;
  readonly modelHeading: string;
  readonly modelLines: readonly string[];
  readonly comparisonLink: string;
  readonly failureLogLink: (entries: number) => string;
  readonly boundary: readonly string[];
  readonly whyLink: string;
}

export const homeCopy: Bilingual<HomeCopy> = {
  en: {
    intro: {
      eyebrow: "Trade surveillance review",
      title: "Review an unfamiliar trading file|right away.",
      lede: [
        "AI works out which column is the price and which the quantity.",
        "Confirm it to see whether the pattern holds, and the trades behind it.",
      ],
      walkThrough: "Try an example",
      walkMeta: "5 steps · no sign-in",
      demoNote:
        "The walkthrough uses synthetic data and a prepared AI suggestion.",
    },
    flowLabel: "How it goes",
    stages: {
      propose: "Check the columns the AI matched, then approve them.",
      approve:
        "Choose which account and time window to examine, and approve it.",
      verify: "See whether the pattern holds, beside each threshold.",
      trace: "Open the source trades behind every result.",
    },
    benefitsKicker: "What changes",
    benefitsHeading: "Less preparation,|clearer evidence.",
    benefits: [
      [
        "No more matching columns by hand",
        "The AI reads each file's column names first. You only confirm them.",
      ],
      [
        "Nothing unchecked is computed",
        "An AI suggestion is used only after you approve it. An unclear one stops before any calculation.",
      ],
      [
        "Anyone who reruns it gets the same result",
        "The same data and the same approval always give the same result. Another reviewer can check it as it stands.",
      ],
      [
        "The evidence is ready to show",
        "Every result opens to the source trades behind it. Explaining why is easier.",
      ],
    ],
    modelKicker: "Choosing the AI",
    modelHeading: "The AI that matches columns|is chosen by test.",
    modelLines: [
      "Every candidate model takes the same test.",
      "Only a model that clears the bar set in advance is used.",
    ],
    comparisonLink: "See the model comparison",
    failureLogLink: (entries) => `AI failure log · ${entries} entries`,
    boundary: [
      "A result says only whether a declared pattern appears in the data.",
      "It does not judge guilt or cause, and it is not investment advice.",
    ],
    whyLink: "Why WeaveTrail",
  },
  ko: {
    intro: {
      eyebrow: "이상거래 검토",
      title: "처음 보는 거래 자료도|바로 검토할 수 있습니다.",
      lede: [
        "열마다 가격인지 수량인지는 AI가 먼저 찾아 둡니다.",
        "확인만 하면 의심 패턴이 있는지 알려 주고, 근거가 된 거래까지 보여 줍니다.",
      ],
      walkThrough: "예시로 체험하기",
      walkMeta: "5단계 · 회원가입 없음",
      demoNote: "체험에는 합성 자료와 미리 준비한 AI 제안을 씁니다.",
    },
    flowLabel: "이렇게 진행합니다",
    stages: {
      propose: "AI가 맞춰 둔 열을 확인하고 승인합니다.",
      approve: "어느 계좌의 어느 시간대 거래를 볼지 정하고 승인합니다.",
      verify: "의심 패턴이 있는지 기준값과 함께 확인합니다.",
      trace: "결과의 근거가 된 원본 거래를 열어 봅니다.",
    },
    benefitsKicker: "달라지는 점",
    benefitsHeading: "검토 준비는 줄고,|근거는 분명해집니다.",
    benefits: [
      [
        "열을 하나하나 맞추지 않아도 됩니다",
        "자료마다 다른 열 이름을 AI가 먼저 읽습니다. 검토자는 맞는지 확인만 합니다.",
      ],
      [
        "확인하지 않은 내용은 계산하지 않습니다",
        "AI 제안은 승인을 거쳐야 쓰입니다. 애매한 제안이 있으면 계산 전에 멈춥니다.",
      ],
      [
        "누가 다시 계산해도 결과가 같습니다",
        "자료와 승인 내용이 같으면 결과도 늘 같습니다. 다른 검토자가 그대로 확인할 수 있습니다.",
      ],
      [
        "근거를 바로 보여 줄 수 있습니다",
        "결과마다 근거가 된 원본 거래를 바로 열어 볼 수 있습니다. 왜 그런 결과인지 설명하기 쉽습니다.",
      ],
    ],
    modelKicker: "AI 모델 선택",
    modelHeading: "열을 맞출 AI는|시험을 거쳐 고릅니다.",
    modelLines: [
      "후보 모델마다 같은 시험 문제를 풉니다.",
      "미리 정해 둔 기준을 넘은 모델만 씁니다.",
    ],
    comparisonLink: "모델 비교 보기",
    failureLogLink: (entries) => `AI 실패 기록 · ${entries}건`,
    boundary: [
      "결과는 정해 둔 패턴이 자료에 나타나는지만 알려 줍니다.",
      "위법 여부나 원인을 판단한 것이 아니며, 투자 조언도 아닙니다.",
    ],
    whyLink: "왜 WeaveTrail인가",
  },
};
