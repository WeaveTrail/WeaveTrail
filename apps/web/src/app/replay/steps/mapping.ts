import type { Language } from "../../i18n/language";
import type { ReplayView } from "../use-case-replay";
import type { GuideStep } from "./step";

interface MappingPanel {
  readonly requestNote: string;
  readonly request: string;
  readonly requesting: string;
  readonly pending: string;
  readonly proposedLabel: string;
  readonly executedLabel: string;
  readonly configuredProvider: string;
  readonly fixtureProvider: string;
  readonly reviewNote: string;
  readonly evidenceNote: string;
  readonly waitingTitle: string;
  readonly waitingNote: string;
  readonly compositeEventId: string;
  readonly compositeEventTime: string;
  readonly orderedColumns: string;
  readonly transform: string;
  readonly confidence: string;
  readonly uncalibrated: string;
  readonly evidence: string;
  readonly unmapped: string;
  readonly noTransform: string;
  readonly sourceAbsent: string;
  readonly reasonFor: string;
  readonly blocked: string;
  readonly approve: string;
  readonly approved: string;
  /**
   * What a mapping approval covers, in one sentence a reviewer reads before
   * the hash that proves it. Editing a reason or requesting a new proposal
   * revokes the approval in this surface, so the sentence promises no more.
   */
  readonly coverage: string;
}

/**
 * Step 2: a model proposes what each column means, and the visitor approves
 * this case's own mapping. A flagged field needs a reviewer reason first.
 */
export const mappingStep: GuideStep<MappingPanel> = {
  stage: "propose",
  actor: "A model proposed it",
  narration: {
    en: {
      title: "Review the mapping",
      purpose:
        "A model proposes which columns mean the same thing; it cannot approve them. The proposal below comes from a deterministic fixture, so no live model call occurred.",
      action:
        "Review this case's proposed fields, transforms and evidence, then approve this case's own mapping.",
      actorDetail:
        "The fixture mapping provider proposes targets, transforms and evidence. It cannot approve them.",
      blocker: "Approve this case's mapping to continue.",
    },
    ko: {
      title: "데이터 항목 연결 검토",
      purpose:
        "어떤 항목끼리 같은 뜻인지는 AI가 초안만 제안합니다. 아래 제안은 미리 준비된 예시 제안이며, 실시간 모델 호출은 일어나지 않았습니다.",
      action:
        "이 사례에 제안된 항목과 변환, 근거를 검토한 뒤 이 사례의 연결 제안을 승인하세요.",
      actorDetail:
        "제안까지가 AI의 몫입니다. 대상 항목과 변환, 근거를 내놓을 뿐 승인은 하지 못합니다.",
      blocker: "이 사례의 연결 제안을 승인해야 계속할 수 있습니다.",
    },
  },
  panel: {
    en: {
      requestNote:
        "Request, review and approve a mapping proposal. A failed request blocks replay.",
      request: "Request mapping proposal",
      requesting: "Requesting mapping…",
      pending: "A validated mapping proposal is required before approval.",
      proposedLabel: "Proposed mapping",
      executedLabel: "Executed mapping proposal",
      configuredProvider: "Configured provider",
      fixtureProvider: "Fixture provider",
      reviewNote:
        "Review the proposed fields, transforms and evidence. Approval binds to this exact proposal.",
      evidenceNote:
        "Each field's evidence sentence is the proposal's own text, shown exactly as it was proposed. The approval binds to these bytes, so it is never rewritten.",
      waitingTitle: "These fields are waiting for your reason",
      waitingNote:
        "The proposal below is shown in full. These are the fields that block approval; each one goes to its own input.",
      compositeEventId: "Composite source event identity",
      compositeEventTime: "Composite execution time",
      orderedColumns: "Ordered columns",
      transform: "Transform",
      confidence: "Confidence",
      uncalibrated: "not a calibrated probability",
      evidence: "Evidence",
      unmapped: "unmapped",
      noTransform: "none",
      sourceAbsent: "source field absent",
      reasonFor: "Reviewer reason for",
      blocked:
        "Replay is blocked until every flagged field has a reviewer reason.",
      approve: "Approve executed mapping",
      approved: "Mapping approved locally",
      coverage:
        "This approval covers exactly the mapping shown above — every source column, target field and transform, with the reviewer reasons recorded beside it — and any change to it needs a new approval before anything runs.",
    },
    ko: {
      requestNote:
        "연결 제안을 요청해 검토하고 승인하세요. 요청이 실패하면 분석을 실행할 수 없습니다.",
      request: "연결 제안 요청",
      requesting: "연결 제안 요청 중…",
      pending: "승인하려면 검증을 통과한 연결 제안이 먼저 있어야 합니다.",
      proposedLabel: "데이터 항목 연결 제안",
      executedLabel: "실행에 쓰인 연결 제안",
      configuredProvider: "설정된 모델 제공자",
      fixtureProvider: "미리 준비된 fixture 제안",
      reviewNote:
        "제안된 항목과 변환, 근거를 검토하세요. 승인은 지금 보고 있는 이 제안 하나에만 묶입니다.",
      evidenceNote:
        "항목마다 붙은 근거 문장은 제안이 스스로 적어 둔 원문이며, 제안된 그대로 보여 줍니다. 승인이 이 내용에 그대로 묶이기 때문에 다시 쓰지 않습니다.",
      waitingTitle: "확인 이유를 기다리는 항목",
      waitingNote:
        "아래 제안은 전부 그대로 보여 줍니다. 그중 승인을 막고 있는 항목은 다음과 같으며, 누르면 그 입력칸으로 갑니다.",
      compositeEventId: "여러 열을 합친 기록 식별자",
      compositeEventTime: "여러 열을 합친 체결 시각",
      orderedColumns: "순서가 있는 열",
      transform: "변환",
      confidence: "확신도",
      uncalibrated: "보정된 확률이 아닙니다",
      evidence: "근거",
      unmapped: "연결하지 않음",
      noTransform: "없음",
      sourceAbsent: "원본 항목 없음",
      reasonFor: "확인 이유",
      blocked:
        "표시된 항목마다 확인 이유를 적기 전까지 분석을 실행할 수 없습니다.",
      approve: "연결 제안 승인",
      approved: "연결 제안을 승인했습니다",
      coverage:
        "이 승인은 위 연결 제안의 원본 열과 대상 항목, 변환 하나하나와 함께 적은 확인 이유에 그대로 적용되며, 무엇이든 바뀌면 다시 승인해야 실행할 수 있습니다.",
    },
  },
  satisfied: (view) => view.approval !== null,
  railAction: (view, language) => ({
    kind: "perform",
    label: approveMappingLabel(view, language),
    disabled: view.approveMappingBlocked,
    done: view.approval !== null,
    run: view.approveMapping,
  }),
};

export function approveMappingLabel(view: ReplayView, language: Language) {
  const text = mappingStep.panel[language];
  return view.approval ? text.approved : text.approve;
}
