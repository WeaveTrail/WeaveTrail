import type { WorkflowState } from "@weavetrail/contracts";

import type { Bilingual } from "../i18n/language";
import type { Mutation } from "./types";

/**
 * The copy the replay surface shares across its steps: the heading, the step
 * rail, the source table, receipts, workflow states, machine values and the
 * finding trace. Each step's own narration and panel copy sit in its module
 * under `steps/`. Korean follows the fixed product vocabulary: 원본 거래자료,
 * 데이터 항목 연결, 조사 범위, 분석 실행, 판단 항목, 판단 근거, 확인 이유.
 */

/** Who acted in a step. The English value is the discriminant behaviour keys on. */
export type Actor =
  | "Committed input"
  | "A model proposed it"
  | "A person approved it"
  | "Versioned code decided it";

export type HashScope =
  "sourceArtifact" | "approvedArtifact" | "canonicalResult" | "rawRow";

export type GateName =
  | "PRICE_CHANGE"
  | "AGGRESSIVE_BUY_SHARE"
  | "ACTOR_CONCENTRATION"
  | "REPEATED_EXECUTION"
  | "REMOVAL_SENSITIVITY";

interface ReplayCopy {
  readonly heading: {
    readonly title: string;
    readonly workingLede: string;
    readonly guidedMeta: string;
    readonly modesLabel: string;
    readonly guidedMode: string;
    readonly workingMode: string;
  };
  readonly rail: {
    readonly hashesDiffer: string;
    readonly readyToContinue: string;
    readonly toContinue: (reason: string) => string;
    readonly readingAhead: (step: number, title: string) => string;
    readonly stepHeading: (step: number, title: string) => string;
    readonly stepOf: (step: number, total: number) => string;
    readonly stageOf: (stage: number, total: number) => string;
    readonly afterMainFlow: string;
    readonly whatThisShows: string;
    readonly whoActed: string;
    readonly completed: string;
    readonly currentStep: string;
    readonly back: string;
    readonly continueLabel: string;
    readonly navigationInRail: string;
    readonly navigationAtEnd: string;
    readonly progressLabel: string;
    readonly stepListLabel: string;
    readonly whyThisStep: string;
  };
  readonly actors: Readonly<Record<Actor, string>>;
  readonly working: {
    readonly heading: string;
    readonly withCase: string;
    readonly withoutCase: string;
    readonly variationsNote: string;
    readonly variationsSummary: string;
    readonly variationsDetail: string;
    readonly mutations: Readonly<Record<Mutation, readonly [string, string]>>;
    readonly submittedOrderLabel: string;
    readonly submittedOrderDetail: string;
    readonly reviewerFacing: string;
    readonly engineRegression: string;
    readonly synthetic: string;
  };
  readonly source: {
    readonly region: string;
    readonly artifact: string;
    readonly rows: string;
    readonly columns: string;
    readonly synthetic: string;
    readonly summary: string;
    readonly tableLabel: string;
    readonly rowHeader: string;
    readonly provenanceSummary: string;
    readonly provenanceLabel: string;
    readonly attribution: string;
    readonly recordLink: string;
  };
  readonly receipt: {
    readonly hash: string;
    readonly reviewer: string;
    readonly decision: string;
    readonly approvedAt: string;
  };
  readonly workflow: {
    readonly label: string;
    readonly meaning: Readonly<Record<WorkflowState, string>>;
  };
  readonly errors: {
    readonly label: string;
    readonly approvalHash: string;
    readonly mappingUnavailable: string;
    readonly failed: string;
  };
  readonly machine: {
    readonly hashScopes: Readonly<
      Record<HashScope, { label: string; covers: string; proves: string }>
    >;
    readonly covers: (covers: string) => string;
    readonly showFull: (name: string) => string;
    readonly copy: string;
    readonly copied: string;
    readonly gates: Readonly<
      Record<GateName, { label: string; tests: string }>
    >;
    readonly reportedValueNote: string;
    readonly observed: string;
    readonly passesAt: string;
    readonly orMore: string;
    readonly bps: string;
    readonly eventFields: Readonly<Record<string, string>>;
  };
  readonly trace: {
    readonly notMapped: string;
    readonly reviewerReason: string;
    readonly sourceAbsent: string;
    readonly absentInRow: string;
    readonly noCanonicalValue: string;
    readonly notInTrace: string;
    readonly lineChecks: string;
    readonly rowChecks: string;
    readonly none: string;
    readonly goToRow: string;
    readonly approvedMapping: string;
    readonly approvedMappingNote: string;
    readonly proposalEvidence: string;
  };
}

export const replayCopy: Bilingual<ReplayCopy> = {
  en: {
    heading: {
      title: "Follow a case from source to finding.",
      workingLede:
        "The same case without the steps: pick a source, approve it, run it.",
      guidedMeta:
        "One synthetic case · 8 steps · about 5–10 minutes · no sign-in, a refresh starts over",
      modesLabel: "Case Replay mode",
      guidedMode: "Guided walkthrough",
      workingMode: "Working mode",
    },
    rail: {
      hashesDiffer:
        "The returned hashes differ. Retry the same approved case or inspect the results.",
      readyToContinue: "Ready to continue.",
      toContinue: (reason) => `To continue: ${reason}`,
      readingAhead: (step, title) =>
        ` You are reading ahead: step ${step}, ${title}, is not completed.`,
      stepHeading: (step, title) => `Step ${step} · ${title}`,
      stepOf: (step, total) => `Step ${step} of ${total}`,
      stageOf: (stage, total) => `Stage ${stage} of ${total}`,
      afterMainFlow: "After the worked case",
      whatThisShows: "What this shows",
      whoActed: "Who acted",
      completed: "Completed",
      currentStep: "Current step",
      back: "Back",
      continueLabel: "Continue",
      navigationInRail: "Step navigation in the step rail",
      navigationAtEnd: "Step navigation at the end of the step",
      progressLabel: "Case walkthrough progress",
      stepListLabel: "All steps",
      whyThisStep: "Why this step",
    },
    actors: {
      "Committed input": "Committed input",
      "A model proposed it": "A model proposed it",
      "A person approved it": "A person approved it",
      "Versioned code decided it": "Versioned code decided it",
    },
    working: {
      heading: "Case Replay controls",
      withCase:
        "Select a committed source, review its mapping and approve its case before running it.",
      withoutCase:
        "Review the source and approve its exact mapping to normalize it. This source has no case manifest or case evaluation.",
      variationsNote:
        "The input-variation controls change submitted source order or repeat one derived event after mapping.",
      variationsSummary: "Advanced replay variations",
      variationsDetail:
        "This artifact offers Baseline, Shuffle, and Duplicate. Original coordinates and values stay fixed.",
      mutations: {
        baseline: ["Baseline", "Original committed order"],
        shuffle: [
          "Shuffle source rows",
          "Change submitted order before mapping; coordinates and values stay fixed",
        ],
        duplicate: [
          "Duplicate a derived event",
          "Repeat one event after mapping; source rows stay fixed",
        ],
      },
      submittedOrderLabel: "Submitted source row order",
      submittedOrderDetail:
        "Request order before canonical event ordering. The engine sorts by eventTime, sequence and eventId, so this order does not decide the result: compare it with the ordering in the result below.",
      reviewerFacing: "reviewer-facing",
      engineRegression: "engine regression fallback",
      synthetic: "synthetic",
    },
    source: {
      region: "Committed source rows",
      artifact: "Artifact",
      rows: "rows",
      columns: "columns",
      synthetic: "Synthetic",
      summary:
        "The synthetic source as committed: original strings, before any mapping.",
      tableLabel: "Source rows as committed",
      rowHeader: "Row",
      provenanceSummary: "Where this source comes from, and its hash",
      provenanceLabel: "Synthetic source provenance",
      attribution: "Attribution",
      recordLink: "Open the complete source record",
    },
    receipt: {
      hash: "Approved artifact hash",
      reviewer: "Reviewer",
      decision: "Decision",
      approvedAt: "Approved at",
    },
    workflow: {
      label: "Workflow state",
      meaning: {
        UPLOADED:
          "The source rows are committed. Nothing has been proposed yet.",
        MAPPING_PROPOSED:
          "A model proposed what the columns mean. Nobody approved it yet.",
        // Reached both by a flagged field without a reason and by a proposal
        // that was rejected or never obtained, so the sentence holds for both.
        MAPPING_REVIEW_REQUIRED:
          "The mapping cannot be approved as it stands: a flagged field is waiting for a reason, or no validated proposal has been accepted.",
        // Also the end state of a source with no case manifest, so it cannot
        // promise a case approval that will never be offered.
        MAPPING_APPROVED:
          "You approved what the columns mean. No case has been approved or evaluated.",
        CASE_PROPOSED: "A case scope is proposed. Nobody approved it yet.",
        CASE_REVIEW_REQUIRED:
          "The server refused the case scope or its approval, so no rule ran.",
        CASE_APPROVED: "You approved the scope. The case has not been run yet.",
        INPUT_REVIEW_REQUIRED:
          "The submitted input did not pass validation, so nothing ran.",
        REPLAYED:
          "Versioned code recomputed the case from the approved input and returned this result.",
        EXPORTED:
          "A result written into an evidence bundle. Bundle export is planned, so this surface does not reach this state.",
      },
    },
    errors: {
      label: "REPLAY_REFUSED",
      approvalHash:
        "Approval hash could not be computed. Approval and replay remain blocked.",
      mappingUnavailable:
        "REVIEW_REQUIRED: Mapping proposal unavailable or rejected. Request a new proposal before approval.",
      failed: "The request did not complete. Nothing was run.",
    },
    machine: {
      hashScopes: {
        sourceArtifact: {
          label: "Source artifact hash",
          covers:
            "the committed bytes of the whole source artifact, before any mapping.",
          proves:
            "A match proves the rows under review come from the artifact this hash names. A mismatch proves the submitted artifact is not the committed one.",
        },
        approvedArtifact: {
          label: "Approved artifact hash",
          covers:
            "the exact artifact a person approved, canonically serialized: the proposal alone. A reviewer's override reasons travel in the approval record beside this hash and are not inside it.",
          proves:
            "A match proves the request carries the artifact that was approved. A mismatch proves the approval does not authorize the request, and the replay boundary refuses it.",
        },
        canonicalResult: {
          label: "Canonical result hash",
          covers:
            "the engine version, the canonical event projection and the evaluation when one is present. It does not cover complete approval records, every mapping or manifest field, or the source trace.",
          proves:
            "A match across two runs proves the covered material is identical: the same engine version, canonical event projection and evaluation. It does not prove the two requests carried the same approval records, mapping or manifest fields. A mismatch proves some of the covered material differed. Neither establishes authenticity or real-market accuracy.",
        },
        rawRow: {
          label: "Raw row hash",
          covers:
            "the canonicalized source coordinate and parsed column values of the row this canonical event came from, not the artifact's original bytes. Those are covered by the source artifact hash.",
          proves:
            "A match proves the canonical event still resolves to that committed row. A mismatch proves the coordinate or a parsed value changed after the event was derived.",
        },
      },
      covers: (covers) => `Covers ${covers}`,
      showFull: (name) => `Show the full ${name.toLowerCase()}`,
      copy: "Copy the full value",
      copied: "Copied the full value",
      gates: {
        PRICE_CHANGE: {
          label: "Price rise",
          tests:
            "Peak price rise from the first eligible trade, in basis points (100 bps = 1%).",
        },
        AGGRESSIVE_BUY_SHARE: {
          label: "Aggressive buy share",
          tests:
            "Share of eligible trade value (price × quantity) from BUY events, in basis points.",
        },
        ACTOR_CONCENTRATION: {
          label: "Actor concentration",
          tests:
            "Share of BUY trade value from the approved actor group, in basis points.",
        },
        REPEATED_EXECUTION: {
          label: "Repeated execution",
          tests:
            "Number of approved-actor aggressive buys above the reference price.",
        },
        REMOVAL_SENSITIVITY: {
          label: "Change without the approved actors",
          tests:
            "Difference in price-rise basis points when the approved actor group's trades are removed; a mechanical comparison.",
        },
      },
      reportedValueNote:
        "Rates are reported truncated to four decimals. Every verdict and difference is computed on the exact value, so a reported value can sit just below a threshold it passes.",
      observed: "Observed",
      passesAt: "passes at",
      orMore: "or more",
      bps: "bps",
      eventFields: {
        eventId:
          "Canonical identity: dataset, venue and source event identity joined. Not a hash.",
        sourceEventId: "The identifier the source assigned to this record.",
        eventTime:
          "The instant the source reported, normalized to UTC by the engine. The source's own offset stays in the committed source row below.",
        price:
          "Executed price per unit, as an exact decimal string. The source carries no currency.",
        quantity: "Executed quantity, in units, as an exact decimal string.",
        sequence:
          "The source's own ordering value, and the canonical secondary sort key: canonical order sorts by event time, then by this value when two events share a time, then by canonical identity.",
      },
    },
    trace: {
      notMapped: "not mapped",
      reviewerReason: "Reviewer reason",
      sourceAbsent: "source field absent",
      absentInRow: "absent in this row",
      noCanonicalValue: "no canonical value",
      notInTrace: "not in the source trace",
      lineChecks: "Checks that used it",
      rowChecks: "Checks that used it",
      none: "none",
      goToRow: "Go to its mapping row",
      approvedMapping: "Approved mapping behind these findings",
      approvedMappingNote:
        "Read from the mapping the approval is bound to. Each row links to the checks that used it.",
      proposalEvidence: "Proposal evidence, as proposed",
    },
  },
  ko: {
    heading: {
      title: "의심 사례의 근거를 직접 확인합니다.",
      workingLede:
        "단계 안내 없이 같은 사례를 다룹니다. 원본을 고르고, 승인하고, 실행하세요.",
      guidedMeta:
        "합성 사례 하나 · 8단계 · 약 5~10분 · 회원가입 없음, 새로고침하면 처음부터",
      modesLabel: "사례를 확인하는 방식",
      guidedMode: "사례 따라가기",
      workingMode: "직접 조작",
    },
    rail: {
      hashesDiffer:
        "두 결과 해시가 서로 다릅니다. 같은 사례를 다시 실행하거나 결과를 확인하세요.",
      readyToContinue: "계속할 수 있습니다.",
      toContinue: (reason) => `계속하려면: ${reason}`,
      readingAhead: (step, title) =>
        ` 앞서 읽고 있습니다. ${step}단계 "${title}"를 아직 완료하지 않았습니다.`,
      stepHeading: (step, title) => `${step}단계 · ${title}`,
      stepOf: (step, total) => `${total}단계 중 ${step}단계`,
      stageOf: (stage, total) => `${total}개 과정 중 ${stage}번째`,
      afterMainFlow: "사례를 마친 뒤",
      whatThisShows: "이 단계가 필요한 이유",
      whoActed: "누가 했는가",
      completed: "완료",
      currentStep: "현재 단계",
      back: "이전",
      continueLabel: "계속",
      navigationInRail: "단계 목록에서 단계 이동하기",
      navigationAtEnd: "단계 끝에서 단계 이동하기",
      progressLabel: "사례 따라가기 진행 상황",
      stepListLabel: "전체 단계",
      whyThisStep: "이 단계를 두는 이유",
    },
    actors: {
      "Committed input": "커밋된 입력",
      "A model proposed it": "모델이 제안했습니다",
      "A person approved it": "사람이 승인했습니다",
      "Versioned code decided it": "버전이 고정된 코드가 판정했습니다",
    },
    working: {
      heading: "직접 조작 컨트롤",
      withCase:
        "원본 거래자료를 고르고, 데이터 항목 연결을 검토해 승인한 다음, 조사 범위를 승인하고 실행하세요.",
      withoutCase:
        "원본 자료를 검토하고 항목 연결을 그대로 승인하면 자료를 정리할 수 있습니다. 이 자료에는 조사 범위와 사례 평가가 없습니다.",
      variationsNote:
        "입력 자료 변경 실험에서는 제출하는 거래 순서를 바꾸거나, 연결 후 만들어진 기록 하나를 반복할 수 있습니다.",
      variationsSummary: "입력 자료 변경 실험",
      variationsDetail:
        "이 자료에서는 원본 그대로, 순서 섞기, 기록 반복을 사용할 수 있습니다. 원본의 위치와 값은 그대로입니다.",
      mutations: {
        baseline: ["원본 그대로", "커밋된 원본 자료의 순서를 그대로 씁니다"],
        shuffle: [
          "거래 순서 바꾸기",
          "제출하는 순서만 바꿉니다. 행의 위치와 값은 그대로입니다",
        ],
        duplicate: [
          "거래 하나 반복하기",
          "정리된 거래 기록 하나를 반복합니다. 원본 행은 그대로입니다",
        ],
      },
      submittedOrderLabel: "제출한 원본 행 순서",
      submittedOrderDetail:
        "기록을 정렬하기 전, 요청에 담아 보낸 순서입니다. 엔진은 시각과 순번, 기록 번호 순으로 다시 정렬하므로 이 순서가 결과를 정하지 않습니다. 아래 결과의 순서와 비교해 보세요.",
      reviewerFacing: "검토용",
      engineRegression: "엔진 회귀 대체 사례",
      synthetic: "시연용 가상자료",
    },
    source: {
      region: "커밋된 원본 거래자료",
      artifact: "아티팩트",
      rows: "행",
      columns: "열",
      synthetic: "합성 자료",
      summary: "커밋된 원본 그대로입니다. 항목을 연결하기 전의 값입니다.",
      tableLabel: "커밋된 그대로의 원본 행",
      rowHeader: "행",
      provenanceSummary: "출처와 해시",
      provenanceLabel: "합성 자료 출처",
      attribution: "출처 표기",
      recordLink: "전체 원본 기록 열기",
    },
    receipt: {
      hash: "승인된 아티팩트 해시",
      reviewer: "검토자",
      decision: "결정",
      approvedAt: "승인 시각",
    },
    workflow: {
      label: "워크플로 상태",
      meaning: {
        UPLOADED:
          "원본 행이 그대로 올라와 있습니다. 아직 제안된 것은 없습니다.",
        MAPPING_PROPOSED:
          "AI가 항목의 뜻을 제안했습니다. 아직 아무도 승인하지 않았습니다.",
        MAPPING_REVIEW_REQUIRED:
          "지금 상태로는 연결 제안을 승인할 수 없습니다. 확인이 필요한 항목이 이유를 기다리고 있거나, 검증을 통과한 제안을 아직 받지 못했습니다.",
        MAPPING_APPROVED:
          "항목의 뜻을 승인했습니다. 승인되거나 평가된 조사 범위는 아직 없습니다.",
        CASE_PROPOSED:
          "조사 범위가 제안되었습니다. 아직 아무도 승인하지 않았습니다.",
        CASE_REVIEW_REQUIRED:
          "서버가 조사 범위나 그 승인을 받아들이지 않아 아무 규칙도 실행되지 않았습니다.",
        CASE_APPROVED: "조사 범위를 승인했습니다. 아직 실행하지는 않았습니다.",
        INPUT_REVIEW_REQUIRED:
          "보낸 입력이 검증을 통과하지 못해 아무것도 실행되지 않았습니다.",
        REPLAYED:
          "버전이 고정된 코드가 승인된 입력으로 다시 계산해 이 결과를 돌려주었습니다.",
        EXPORTED:
          "결과를 증거 묶음으로 내보낸 상태입니다. 증거 묶음 내보내기는 계획 단계라 이 화면은 이 상태에 이르지 않습니다.",
      },
    },
    errors: {
      label: "REPLAY_REFUSED",
      approvalHash:
        "승인 해시를 계산하지 못했습니다. 승인과 분석 실행은 막힌 채로 남습니다.",
      mappingUnavailable:
        "REVIEW_REQUIRED · 연결 제안을 받지 못했거나 거부되었습니다. 승인하기 전에 새 제안을 요청하세요.",
      failed: "요청을 마치지 못했습니다. 아무것도 실행되지 않았습니다.",
    },
    machine: {
      hashScopes: {
        sourceArtifact: {
          label: "원본 자료 해시",
          covers: "연결하기 전, 원본 거래자료 파일 전체의 바이트입니다.",
          proves:
            "값이 같으면 지금 검토하는 행들이 이 해시가 가리키는 파일에서 나왔다는 뜻입니다. 다르면 제출된 파일이 커밋된 그 파일이 아니라는 뜻입니다.",
        },
        approvedArtifact: {
          label: "승인한 내용의 해시",
          covers:
            "사람이 승인한 내용 그 자체를 정해진 방식으로 직렬화한 것, 즉 제안 하나입니다. 검토자가 남긴 이유는 이 해시 안이 아니라 승인 기록에 함께 담깁니다.",
          proves:
            "값이 같으면 이 요청이 승인받은 그 내용을 그대로 담고 있다는 뜻입니다. 다르면 그 승인은 이 요청을 허가하지 않으며, 분석 단계에서 요청을 거부합니다.",
        },
        canonicalResult: {
          label: "분석 결과 해시",
          covers:
            "엔진 버전과 정리된 거래 기록, 그리고 평가가 있을 때는 그 평가까지입니다. 승인 기록 전체나 연결·조사 범위의 모든 항목, 근거 추적은 포함하지 않습니다.",
          proves:
            "두 번 실행한 값이 같으면 위에 적은 범위가 서로 같다는 뜻입니다. 두 요청이 같은 승인 기록이나 같은 연결·범위 항목을 담았다는 뜻은 아닙니다. 값이 다르면 그 범위 안의 무언가가 달랐다는 뜻입니다. 어느 쪽도 자료의 진위나 실제 시장과의 일치를 보증하지는 않습니다.",
        },
        rawRow: {
          label: "원본 행 해시",
          covers:
            "이 거래 기록이 나온 원본 행의 위치 정보와 읽어들인 열 값입니다. 파일 원본 바이트는 원본 자료 해시가 맡습니다.",
          proves:
            "값이 같으면 이 거래 기록이 여전히 그 커밋된 행으로 이어진다는 뜻입니다. 다르면 기록을 만든 뒤에 행 위치나 읽어들인 값이 바뀌었다는 뜻입니다.",
        },
      },
      covers: (covers) => `이 해시가 덮는 범위: ${covers}`,
      showFull: () => "전체 값 보기",
      copy: "전체 값 복사",
      copied: "전체 값을 복사했습니다",
      gates: {
        PRICE_CHANGE: {
          label: "가격 상승 정도",
          tests:
            "조사 구간의 첫 거래 이후 가격이 가장 많이 오른 폭입니다. 단위는 bp이고 100bp가 1%입니다.",
        },
        AGGRESSIVE_BUY_SHARE: {
          label: "매수 집중 정도",
          tests:
            "조사 대상 거래대금(가격 × 수량) 가운데 매수 거래가 차지하는 비중입니다. 단위는 bp입니다.",
        },
        ACTOR_CONCENTRATION: {
          label: "특정 거래 주체의 집중 정도",
          tests:
            "매수 거래대금 가운데 승인된 조사 대상 거래 주체가 차지하는 비중입니다. 단위는 bp입니다.",
        },
        REPEATED_EXECUTION: {
          label: "반복 거래 횟수",
          tests: "조사 대상 거래 주체가 기준 가격 위에서 매수한 횟수입니다.",
        },
        REMOVAL_SENSITIVITY: {
          label: "조사 대상을 뺐을 때의 변화",
          tests:
            "조사 대상 거래 주체의 거래를 빼고 다시 계산했을 때 가격 상승 폭이 얼마나 달라지는지입니다. 원인을 가리는 것이 아니라 기계적인 비교입니다.",
        },
      },
      reportedValueNote:
        "화면에 보이는 비율은 소수점 넷째 자리에서 자른 값입니다. 통과 여부와 차이는 자르지 않은 정확한 값으로 계산하므로, 통과한 항목이라도 표시된 값은 기준선보다 살짝 낮아 보일 수 있습니다.",
      observed: "관측값",
      passesAt: "기준",
      orMore: "이상이면 충족",
      bps: "bps",
      eventFields: {
        eventId:
          "정리된 거래 기록의 고유 이름입니다. 데이터셋과 시장, 원본이 붙인 식별자를 이어 붙인 값이며 해시가 아닙니다.",
        sourceEventId: "원본 자료가 이 기록에 붙여 둔 식별자입니다.",
        eventTime:
          "원본이 알려 온 시각을 UTC로 맞춘 값입니다. 원본이 쓰던 시간대는 아래 커밋된 원본 행에 그대로 남아 있습니다.",
        price:
          "한 단위당 체결 가격이며, 반올림 없는 정확한 문자열입니다. 원본에 통화 표시가 없어 통화는 붙이지 않습니다.",
        quantity: "체결 수량이며, 반올림 없는 정확한 문자열입니다.",
        sequence:
          "원본이 매겨 둔 순서 값이자 정렬의 두 번째 기준입니다. 먼저 체결 시각으로 정렬하고, 시각이 같으면 이 값으로, 그래도 같으면 기록의 고유 이름으로 정렬합니다.",
      },
    },
    trace: {
      notMapped: "연결하지 않음",
      reviewerReason: "확인 이유",
      sourceAbsent: "원본 항목 없음",
      absentInRow: "이 행에 없음",
      noCanonicalValue: "정리된 값 없음",
      notInTrace: "근거 추적에 없음",
      lineChecks: "이 값을 쓴 판단 항목",
      rowChecks: "이 행을 쓴 판단 항목",
      none: "없음",
      goToRow: "연결 행으로 이동",
      approvedMapping: "이 판단 근거에 쓰인 데이터 항목 연결",
      approvedMappingNote:
        "승인이 묶인 연결 제안을 그대로 보여 줍니다. 행마다 그 행을 쓴 판단 항목으로 이동할 수 있습니다.",
      proposalEvidence: "제안 원문 근거",
    },
  },
};
