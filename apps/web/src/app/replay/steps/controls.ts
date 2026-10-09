import type { GuideStep } from "./step";

interface ControlsPanel {
  readonly heading: string;
  readonly runs: string;
  readonly notBuilt: string;
  readonly toWorkingMode: string;
  readonly nextHeading: string;
  readonly nextComparison: string;
}

/** The last step hands the case, with its approvals, to working mode. */
export const controlsStep: GuideStep<ControlsPanel> = {
  stage: "approve",
  afterMainFlow: true,
  actor: "A person approved it",
  narration: {
    en: {
      title: "Take the controls",
      purpose:
        "From here you choose the source and the variations yourself, and replay the synthetic records. A refresh starts unapproved.",
      action:
        "Carry this case into working mode, where you choose the source and the variations yourself.",
      actorDetail:
        "The approvals you made stay loaded. No approval is persisted beyond this browser session.",
      blocker: "",
    },
    ko: {
      title: "직접 조작으로 이동",
      purpose:
        "여기서부터는 원본 자료를 직접 고르고 거래 순서를 바꾸는 등 입력을 바꿔 결과가 어떻게 달라지는지 볼 수 있습니다. 합성 기록을 같은 화면에서 재현합니다.",
      action:
        "이 사례와 승인 내용을 그대로 가지고 직접 조작 화면으로 넘어가세요.",
      actorDetail:
        "지금까지 한 승인은 그대로 남습니다. 다만 어떤 승인도 이 브라우저 세션을 넘어 저장되지는 않습니다.",
      blocker: "",
    },
  },
  panel: {
    en: {
      heading: "What runs today",
      runs: "Published-schema synthetic sources run with explicit mapping approval; sources with a manifest also run one versioned rule.",
      notBuilt:
        "Production data ingestion, access controls and durable approval records are not implemented. Live case proposals and bundle export are planned.",
      toWorkingMode: "Continue in working mode",
      nextHeading: "Where to go next",
      nextComparison: "See how the model was chosen",
    },
    ko: {
      heading: "현재 실행 범위",
      runs: "공개 스키마 기반 합성 자료를 명시적인 항목 연결 승인과 함께 실행합니다. 조사 범위가 있는 자료에는 버전이 고정된 규칙 하나도 실행합니다.",
      notBuilt:
        "운영용 데이터 수집, 접근 제어, 영구 승인 기록은 구현되지 않았습니다. 실시간 사례 제안과 번들 내보내기는 계획 단계입니다.",
      toWorkingMode: "직접 조작으로 이동",
      nextHeading: "다음에 볼 것",
      nextComparison: "모델을 어떻게 골랐는지 보기",
    },
  },
  satisfied: () => true,
  railAction: (view, language) => ({
    kind: "perform",
    label: controlsStep.panel[language].toWorkingMode,
    disabled: !view.guideSatisfied,
    run: view.completeGuide,
  }),
};
