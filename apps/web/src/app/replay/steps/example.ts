import { GUIDE_TARGET_EXAMPLE, reveal, type GuideStep } from "./step";

interface ExamplePanel {
  readonly heading: string;
  readonly scope: string;
  readonly requestFirst: string;
  readonly reasonKeepsUnmapped: string;
  readonly goToExample: string;
}

/**
 * After the worked case: a separate source whose proposal cannot be approved
 * as it stands. Its approval never authorizes the worked case.
 */
export const exampleStep: GuideStep<ExamplePanel> = {
  stage: "approve",
  afterMainFlow: true,
  actor: "A person approved it",
  narration: {
    en: {
      title: "Review the separate example",
      purpose:
        "This approval does not authorize the worked case. The H0STCNT0 example is a different source with no participant field and no rule manifest, shown after the case so you can see a proposal that cannot be approved as it stands.",
      action:
        "Give each flagged field of the separate example a reviewer reason, then approve the example's mapping.",
      actorDetail:
        "The fixture provider proposed the example's mapping. Only your reviewer reason and your approval move it past REVIEW_REQUIRED.",
      blocker:
        "Give every flagged field of the separate example a reviewer reason and approve its mapping to continue.",
      refusal:
        "A refusal stays on this path: the review example holds at REVIEW_REQUIRED until every flagged field has a nonblank reviewer reason.",
    },
    ko: {
      title: "별도 검토 예시 확인",
      purpose:
        "여기서 한 승인은 지금 따라온 사례에 적용되지 않습니다. H0STCNT0 예시는 참여자 항목도 판단 기준도 없는 다른 자료이며, 지금 상태로는 승인할 수 없는 제안이 어떻게 멈추는지 보여 주려고 사례 뒤에 둡니다.",
      action:
        "별도 예시에서 표시된 항목마다 확인 이유를 적은 뒤, 예시의 연결 제안을 승인하세요.",
      actorDetail:
        "예시의 연결 제안은 미리 준비된 제안입니다. 확인 이유와 사용자의 승인이 있어야만 REVIEW_REQUIRED를 벗어납니다.",
      blocker:
        "별도 예시에서 표시된 항목마다 확인 이유를 적고 예시의 연결 제안을 승인해야 계속할 수 있습니다.",
      refusal:
        "확인이 필요한 항목에 이유를 적기 전까지, 예시는 REVIEW_REQUIRED에서 멈춘 채 진행되지 않습니다.",
    },
  },
  panel: {
    en: {
      heading: "Separate mapping review example · H0STCNT0",
      scope:
        "This approval does not authorize the worked case. It is a different source without a rule manifest, and nothing approved here enters the case request.",
      requestFirst:
        "Request a validated proposal before approval. A rejected response cannot be approved.",
      reasonKeepsUnmapped:
        "A reason keeps the field unmapped. Removing it revokes this approval.",
      goToExample: "Go to the review example",
    },
    ko: {
      heading: "별도 연결 검토 예시 · H0STCNT0",
      scope:
        "여기서 한 승인은 지금 따라온 사례에 적용되지 않습니다. 판단 기준이 없는 다른 자료이며, 여기서 승인한 것은 사례 요청에 들어가지 않습니다.",
      requestFirst:
        "승인 전에 검증된 제안을 요청하세요. 거부된 응답은 승인할 수 없습니다.",
      reasonKeepsUnmapped:
        "이유를 적으면 해당 항목을 연결하지 않은 채 그대로 둡니다. 이유를 지우면 승인이 취소됩니다.",
      goToExample: "검토 예시로 이동",
    },
  },
  satisfied: (view) => view.exampleApproved || !view.exampleScenario,
  railAction: (view, language) =>
    view.exampleScenario
      ? {
          kind: "locate",
          label: exampleStep.panel[language].goToExample,
          disabled: false,
          run: revealExampleWork,
        }
      : null,
  // Where the example's proposal has to be requested first, the step says so.
  narrationFor: (view, language) =>
    view.exampleScenario?.mappingRequestRequired
      ? configuredNarration[language]
      : null,
};

const configuredNarration = {
  en: {
    purpose:
      "This approval does not authorize the worked case. The separate H0STCNT0 example has no participant field and stops until a reviewer acknowledges that absence. Review the proposal's displayed provider and evidence before approval.",
    action:
      "Request the separate example's mapping proposal, give each flagged field a reviewer reason, then approve it.",
  },
  ko: {
    purpose:
      "여기서 한 승인은 지금 따라온 사례에 적용되지 않습니다. 별도의 H0STCNT0 예시에는 참여자 항목이 없으며, 검토자가 그 부재를 확인하기 전까지 멈춥니다. 승인하기 전에 표시된 제공자와 근거를 확인하세요.",
    action:
      "별도 예시의 연결 제안을 요청하고, 표시된 항목마다 확인 이유를 적은 뒤 승인하세요.",
  },
} as const;

/**
 * The step is performed at an input inside the review example, so the control
 * goes to what the step is waiting for, in order: a field without a reason,
 * then the request that has to produce a proposal at all, then the approval.
 * A disabled control cannot take focus, so one is offered only when it can be
 * acted on. The request control stays rendered after a proposal arrives, so
 * it is a candidate only while the example has none.
 */
function revealExampleWork() {
  if (typeof document === "undefined") return;
  const example = document.querySelector(".mapping-example");
  if (!example) return;
  const proposalShown = example.querySelector(".mapping-preview") !== null;
  const next = [
    example.querySelector<HTMLElement>('[data-review-unresolved="true"]'),
    proposalShown
      ? null
      : example.querySelector<HTMLElement>(".request-mapping"),
    document.getElementById(GUIDE_TARGET_EXAMPLE),
  ].find(
    (candidate): candidate is HTMLElement =>
      candidate !== null && !candidate.matches(":disabled"),
  );
  reveal(next ?? null);
}
