import type { PanelCopy } from "./step";

interface ControlsPanel {
  readonly heading: string;
  readonly runs: string;
  readonly notBuilt: string;
}

/** What runs today, beside working mode's controls. */
export const controlsStep: PanelCopy<ControlsPanel> = {
  panel: {
    en: {
      heading: "What runs today",
      runs: "Published-schema synthetic sources run with explicit mapping approval; sources with a manifest also run one versioned rule.",
      notBuilt:
        "Production data ingestion, access controls and durable approval records are not implemented. Live case proposals and bundle export are planned.",
    },
    ko: {
      heading: "현재 실행 범위",
      runs: "공개 스키마 기반 합성 자료를 명시적인 항목 연결 승인과 함께 실행합니다. 조사 범위가 있는 자료에는 버전이 고정된 규칙 하나도 실행합니다.",
      notBuilt:
        "운영용 데이터 수집, 접근 제어, 영구 승인 기록은 구현되지 않았습니다. 실시간 사례 제안과 번들 내보내기는 계획 단계입니다.",
    },
  },
};
