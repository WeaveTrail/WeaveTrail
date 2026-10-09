import type { Language } from "../../i18n/language";
import type { ReplayView } from "../use-case-replay";
import type { GuideStep } from "./step";

interface CasePanel {
  readonly panelLabel: string;
  readonly instrument: string;
  readonly actors: string;
  readonly window: string;
  readonly pattern: string;
  readonly authored: string;
  readonly proposedThresholds: string;
  readonly approvedThresholds: string;
  readonly thresholdNote: string;
  readonly inspect: string;
  readonly inspectNote: string;
  readonly inspectLabel: string;
  readonly mappingFirst: string;
  readonly binding: string;
  readonly approve: string;
  readonly approved: string;
}

/**
 * Step 3: the visitor approves how far the case is scoped. Versioned code
 * fixes which parameters, formulas and comparisons exist; the visitor approves
 * the values for this case.
 */
export const caseApprovalStep: GuideStep<CasePanel> = {
  stage: "approve",
  actor: "A person approved it",
  narration: {
    en: {
      title: "Approve the case",
      purpose:
        "You decide how far this case is scoped. Versioned code defines the allowed parameter schema, formulas and comparisons; live case proposal is planned.",
      action:
        "Read the instrument, window and threshold values, then approve this exact case manifest.",
      actorDetail:
        "You approve the scope. An approval binds to one exact artifact hash.",
      blocker: "Approve the mapping, then this exact case manifest.",
    },
    ko: {
      title: "조사 범위 승인",
      purpose:
        "이 사례를 어떤 범위로 조사할지는 사람이 정합니다. 계산에 쓰는 항목과 수식, 비교 방식은 버전이 고정된 코드가 미리 정해 둔 것입니다.",
      action:
        "종목과 기간, 판단 기준 값을 확인한 뒤 이 조사 범위를 그대로 승인하세요.",
      actorDetail:
        "범위를 승인하는 것은 사용자입니다. 승인은 지금 보고 있는 내용 하나에만 묶입니다.",
      blocker: "연결 제안을 먼저 승인하고, 이어서 이 조사 범위를 승인하세요.",
    },
  },
  panel: {
    en: {
      panelLabel: "Case manifest proposal",
      instrument: "Instrument",
      actors: "Proposed actor group",
      window: "Window",
      pattern: "Pattern",
      authored: "Authored case proposal. Live case proposal is planned.",
      proposedThresholds: "Threshold values proposed in this authored case.",
      approvedThresholds: "Threshold values approved with this case.",
      thresholdNote:
        "Versioned code defines the allowed parameter schema, formulas and comparisons. All values remain exact strings; shares and price changes use basis points (100 bps = 1%).",
      inspect: "Inspect the exact case proposal",
      inspectNote:
        "The exact artifact this approval binds to. The canonicalDatasetHash inside it belongs to the artifact: it names the ordered canonical event projection the replay must reproduce, and the replay boundary refuses a request whose dataset does not match it. The source artifact hash belongs to the separately approved mapping.",
      inspectLabel: "Exact case manifest proposal",
      mappingFirst: "Approve the mapping before approving the case.",
      binding:
        "Approving binds to this exact case manifest in full — every field of it, not only the values listed above.",
      approve: "Approve case manifest",
      approved: "Case approved locally",
    },
    ko: {
      panelLabel: "조사 범위 제안",
      instrument: "종목",
      actors: "제안된 행위자 그룹",
      window: "구간",
      pattern: "패턴",
      authored:
        "직접 작성한 사례 제안입니다. 실시간 사례 제안은 계획 단계입니다.",
      proposedThresholds: "이 사례에 제안된 판단 기준 값입니다.",
      approvedThresholds: "이 사례와 함께 승인된 판단 기준 값입니다.",
      thresholdNote:
        "쓸 수 있는 항목과 수식, 비교 방식은 버전이 고정된 코드가 정합니다. 모든 값은 반올림 없는 문자열이며, 비중과 가격 변화는 bp 단위를 씁니다. 100bp가 1%입니다.",
      inspect: "정확한 사례 제안 보기",
      inspectNote:
        "이 승인이 묶이는 내용 그 자체입니다. 안에 있는 canonicalDatasetHash는 이 내용에 속하며, 분석이 그대로 되살려야 할 정리된 거래 기록의 순서를 가리킵니다. 자료가 이 값과 맞지 않으면 요청을 거부합니다. 원본 자료 해시는 따로 승인한 항목 연결 쪽에 속합니다.",
      inspectLabel: "정확한 조사 범위 제안",
      mappingFirst:
        "조사 범위를 승인하기 전에 데이터 항목 연결을 먼저 승인하세요.",
      binding:
        "승인은 이 조사 범위 전체에 그대로 묶입니다. 위에 나열한 값에만 묶이는 것이 아니라 모든 항목이 포함됩니다.",
      approve: "조사 범위 승인",
      approved: "조사 범위를 승인했습니다",
    },
  },
  satisfied: (view) => view.approval !== null && view.caseApproval !== null,
  railAction: (view, language) => ({
    kind: "perform",
    label: approveCaseLabel(view, language),
    disabled: !view.approval,
    done: view.caseApproval !== null,
    run: view.approveCase,
  }),
};

export function approveCaseLabel(view: ReplayView, language: Language) {
  const text = caseApprovalStep.panel[language];
  return view.caseApproval ? text.approved : text.approve;
}
