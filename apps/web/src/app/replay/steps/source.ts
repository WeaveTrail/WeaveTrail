import type { GuideStep } from "./step";

interface SourcePanel {
  readonly panelLabel: string;
  readonly selectLabel: string;
}

/**
 * Step 1: read the committed case, untouched. Nothing gates it; the rail's
 * Continue is its control.
 */
export const sourceStep: GuideStep<SourcePanel> = {
  stage: "propose",
  actor: "Committed input",
  narration: {
    en: {
      title: "Read the source",
      purpose:
        "The committed case, untouched. These column names are the source's own dialect and carry no agreed meaning yet; establishing what they denote is the next step.",
      action:
        "Read the committed source rows and their original values, then continue.",
      actorDetail:
        "Nothing has been proposed, approved or decided at this point.",
      blocker: "",
    },
    ko: {
      title: "원본 거래자료 확인",
      purpose:
        "조사 대상이 된 거래자료를 손대지 않은 그대로 봅니다. 열 이름은 자료를 만든 쪽이 쓰던 말이라, 어떤 항목이 무엇을 뜻하는지는 아직 정해지지 않았습니다.",
      action: "아래 원본 거래자료의 열 이름과 값을 훑어본 뒤 계속하세요.",
      actorDetail:
        "이 시점에는 제안된 것도, 승인된 것도, 판정된 것도 없습니다.",
      blocker: "",
    },
  },
  panel: {
    en: {
      panelLabel: "Committed source",
      selectLabel: "Committed source artifact",
    },
    ko: { panelLabel: "원본 거래자료", selectLabel: "커밋된 원본 거래자료" },
  },
  satisfied: () => true,
  railAction: () => null,
};
