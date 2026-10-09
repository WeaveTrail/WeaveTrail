import type { Bilingual } from "../i18n/language";

type Item = readonly [title: string, line: string];

interface ArchitectureCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly answer: string;
  readonly sections: Readonly<
    Record<
      "layers" | "authority" | "boundary" | "chain" | "hash" | "packages",
      string
    >
  >;
  readonly diagramLabel: string;
  readonly layersLine: string;
  readonly layers: readonly Item[];
  readonly authorityLine: string;
  readonly authorityMore: string;
  readonly authorityLink: string;
  readonly boundaryLine: string;
  readonly boundaryMore: readonly string[];
  readonly chainLine: string;
  /** Each component, what it is, and whether it is planned. */
  readonly chain: readonly (readonly [
    title: string,
    line: string,
    planned: boolean,
  ])[];
  readonly hashLine: string;
  readonly hashMore: readonly string[];
  readonly packagesLine: string;
  readonly packages: readonly Item[];
  readonly document: string;
}

/**
 * Who may do what, and where each part of the code lives. The figure's own
 * words are in `how-it-works-diagram.ts`, which also writes the committed
 * figure files.
 */
export const architectureCopy: Bilingual<ArchitectureCopy> = {
  en: {
    eyebrow: "Architecture",
    title: "A model proposes. Versioned code decides.",
    answer:
      "Four layers hold one authority each. A model may only propose, a person approves the exact proposal, versioned code computes the result, and every finding resolves to its source rows.",
    sections: {
      layers: "The four layers",
      authority: "Where a model's authority ends.",
      boundary: "The trust boundary.",
      chain: "From source rows to evidence",
      hash: "What the canonical hash covers.",
      packages: "Where each part lives",
    },
    diagramLabel: "Layer separation diagram",
    layersLine:
      "One authority per layer. The figure and the chain below mark what is planned.",
    layers: [
      [
        "L1 · Interpret",
        "A model proposes fields and transforms, with evidence.",
      ],
      ["L2 · Approve", "A person approves that exact proposal by its hash."],
      ["L3 · Decide", "Versioned code orders, computes, evaluates and hashes."],
      [
        "L4 · Evidence",
        "Every finding resolves to its eventId and rawRowHash.",
      ],
    ],
    authorityLine:
      "A model proposes a field mapping; a bounded case proposer is planned. It never computes a value, edits a row or decides a result.",
    authorityMore:
      "The walkthrough uses a deterministic fixture proposal. A configured model can propose mappings through one adapter for eligible synthetic sources, and its output is untrusted until the contract validator and a person clear it.",
    authorityLink: "See how the mapping model is measured",
    boundaryLine:
      "It runs between L2 and L3: nothing reaches versioned code without an approval bound to the exact proposal's hash.",
    boundaryMore: [
      "A validation or approval that cannot be satisfied returns a review state such as REVIEW_REQUIRED, never a result, and carries no result hash.",
      "The engine's five rule gates sit inside the boundary: a gate that does not pass produces NOT_SUPPORTED, and insufficient declared inputs produce INCONCLUSIVE. Both are results.",
    ],
    chainLine:
      "Each component, in order. Only the case proposer is planned; the case scope is authored today.",
    chain: [
      ["Committed source rows", "Untrusted input", false],
      ["Schema mapper", "Fixture proposal", false],
      ["Mapping approval", "Person · exact proposal hash", false],
      [
        "Canonical event set",
        "Code · re-derived from the approved mapping",
        false,
      ],
      ["Dataset profile", "Code · bounded facts", false],
      ["Bounded case proposer", "Planned · authored manifests today", true],
      ["Case approval", "Person · exact scope hash", false],
      ["Replay engine", "Code · five rule gates", false],
      ["Finding source trace", "Code · original rows", false],
      ["Evidence Bundle", "Code · byte-backed verification", false],
    ],
    hashLine:
      "canonicalReplayResultHash covers the engine version, the canonical event projection and the evaluation when present. Volatile run metadata is excluded.",
    hashMore: [
      "Complete approval records and every mapping and manifest field are protected by the separate bundle hash. The engine verifies that declaration from source bytes; browser export is planned.",
      "The walkthrough's progress is presentation state. Each replay request has its own workflow; durable audit history is not implemented.",
    ],
    packagesLine:
      "Each package owns one part, and dependencies point one way: the web app depends on the packages, never the reverse.",
    packages: [
      ["apps/web", "These pages and Guided Case Replay"],
      ["packages/contracts", "Versioned contracts every boundary validates"],
      [
        "packages/canonical-kernel",
        "Canonical JSON, hashing and exact decimals",
      ],
      ["packages/replay-engine", "Ordering, rules and evidence hash scopes"],
      ["packages/ai-harness", "Constrained model adapters and fixtures"],
      ["packages/scenarios", "Synthetic datasets and controlled mutations"],
      ["packages/evals", "Evaluation cases, runs and scoring"],
    ],
    document: "Read the full architecture document",
  },
  ko: {
    eyebrow: "아키텍처",
    title: "모델은 제안하고, 판정은 버전이 고정된 코드가 합니다.",
    answer:
      "네 계층이 권한을 하나씩 가집니다. 모델은 제안만 하고, 사람이 그 제안을 그대로 승인하며, 버전이 고정된 코드가 결과를 계산하고, 판단 근거마다 원본 행까지 되짚습니다.",
    sections: {
      layers: "네 계층",
      authority: "모델의 권한이 끝나는 지점.",
      boundary: "신뢰 경계.",
      chain: "원본 행에서 근거까지",
      hash: "분석 결과 해시가 담는 범위.",
      packages: "각 부분이 있는 곳",
    },
    diagramLabel: "계층 분리 다이어그램",
    layersLine:
      "계층마다 권한은 하나입니다. 계획 중인 부분은 그림과 아래 순서에 표시했습니다.",
    layers: [
      ["L1 · 해석", "모델이 항목과 변환을 근거와 함께 제안합니다."],
      ["L2 · 승인", "사람이 그 제안을 해시 그대로 승인합니다."],
      ["L3 · 판정", "버전이 고정된 코드가 정렬, 계산, 평가, 해시를 맡습니다."],
      ["L4 · 증거", "판단 근거마다 eventId와 rawRowHash까지 되짚습니다."],
    ],
    authorityLine:
      "모델은 항목 연결을 제안합니다. 한정된 사례 제안기는 계획입니다. 값을 계산하거나, 행을 고치거나, 결과를 정하지 않습니다.",
    authorityMore:
      "사례 따라가기는 결정론적 fixture 제안을 씁니다. 설정한 모델은 어댑터 하나로 허용된 합성 자료의 항목 연결을 제안할 수 있고, 그 출력은 계약 검증기와 사람이 통과시키기 전까지 신뢰하지 않습니다.",
    authorityLink: "항목 연결 모델을 어떻게 재는지 보기",
    boundaryLine:
      "경계는 L2와 L3 사이입니다. 제안의 해시에 그대로 묶인 승인 없이는 아무것도 버전이 고정된 코드에 닿지 않습니다.",
    boundaryMore: [
      "검증이나 승인을 통과하지 못하면 REVIEW_REQUIRED 같은 검토 상태가 돌아옵니다. 결과가 아니며 결과 해시도 없습니다.",
      "엔진의 다섯 판단 항목은 경계 안에 있습니다. 통과하지 못한 판단 항목이 있으면 NOT_SUPPORTED가, 선언된 입력이 부족하면 INCONCLUSIVE가 나옵니다. 둘 다 결과입니다.",
    ],
    chainLine:
      "구성 요소를 순서대로 놓았습니다. 계획인 것은 사례 제안기 하나이며, 지금은 조사 범위를 직접 작성합니다.",
    chain: [
      ["커밋된 원본 행", "신뢰하지 않는 입력", false],
      ["항목 연결 제안기", "fixture 제안", false],
      ["항목 연결 승인", "사람 · 제안 해시와 정확히 일치", false],
      ["정리된 거래 기록", "코드 · 승인된 연결에서 다시 도출", false],
      ["데이터셋 프로파일", "코드 · 한정된 사실", false],
      ["한정된 사례 제안기", "계획 · 지금은 직접 작성한 조사 범위", true],
      ["조사 범위 승인", "사람 · 범위 해시와 정확히 일치", false],
      ["분석 엔진", "코드 · 다섯 판단 항목", false],
      ["판단 근거 추적", "코드 · 원본 행", false],
      ["증거 번들", "코드 · 원본 바이트 기반 검증", false],
    ],
    hashLine:
      "canonicalReplayResultHash는 엔진 버전과 정리된 거래 기록, 평가가 있을 때는 그 평가까지 담습니다. 실행 메타데이터는 제외합니다.",
    hashMore: [
      "승인 기록 전체와 모든 연결·조사 범위 항목은 별도 번들 해시로 보호합니다. 엔진은 원본 바이트에서 그 선언을 검증하며, 브라우저 내보내기는 계획 단계입니다.",
      "사례 따라가기의 진행 상황은 화면 상태입니다. 분석 실행 요청마다 워크플로가 따로 있으며, 지속되는 감사 이력은 아직 없습니다.",
    ],
    packagesLine:
      "패키지마다 맡은 부분이 하나이며, 의존은 한 방향입니다. 웹 앱이 패키지에 의존하고 그 반대는 없습니다.",
    packages: [
      ["apps/web", "이 페이지들과 사례 따라가기"],
      ["packages/contracts", "모든 경계가 검증하는 버전이 붙은 계약"],
      ["packages/canonical-kernel", "정본 JSON, 해시, 정확한 소수 계산"],
      ["packages/replay-engine", "정렬, 규칙, 근거 해시 범위"],
      ["packages/ai-harness", "제한된 모델 어댑터와 fixture"],
      ["packages/scenarios", "합성 자료와 통제된 입력 변경"],
      ["packages/evals", "평가 사례, 실행, 채점"],
    ],
    document: "아키텍처 문서 전체 읽기",
  },
};
