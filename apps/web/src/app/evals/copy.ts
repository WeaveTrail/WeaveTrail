import type { Bilingual } from "../i18n/language";
import type { checks } from "./checks";

type CheckName = (typeof checks)[number]["name"];

interface LedgerCopy {
  readonly eyebrow: string;
  readonly title: string;
  readonly counts: (implemented: number, planned: number) => string;
  readonly lede: string;
  readonly history: string;
  readonly protocolLink: string;
  /** Names the list of committed tests under an implemented check. */
  readonly testsLabel: string;
  readonly status: Readonly<Record<"Implemented" | "Planned", string>>;
  /** Each check's name and what it holds, as a reader meets them. */
  readonly checks: Readonly<
    Record<CheckName, readonly [name: string, detail: string]>
  >;
}

/**
 * The engine-check ledger under the model comparison. The comparison's own
 * copy is in `model-comparison-copy.ts`.
 */
export const ledgerCopy: Bilingual<LedgerCopy> = {
  en: {
    eyebrow: "Evaluation ledger",
    title: "The engine checks behind every result",
    counts: (implemented, planned) =>
      `${implemented} implemented · ${planned} planned`,
    lede: "Each implemented check names the committed tests that hold it. A planned measurement becomes a result only once its cases, command, environment and limits are committed.",
    history:
      "The current evaluation uses synthetic cases only. Earlier published-data evaluations are historical captures with withdrawn sources.",
    protocolLink:
      "Evaluation cases, reproduction command, environment and raw results",
    testsLabel: "Committed tests",
    status: { Implemented: "Implemented", Planned: "Planned" },
    checks: {
      "Row-order invariance": [
        "Row-order invariance",
        "Shuffle the same events; expect one canonical hash.",
      ],
      "Literal golden hash": [
        "Literal golden hash",
        "Pin a committed fixture to its literal canonical result hash.",
      ],
      "Exact duplicate tolerance": [
        "Exact duplicate tolerance",
        "Insert an identical source row; expect unchanged canonical events.",
      ],
      "Identity-conflict rejection": [
        "Identity-conflict rejection",
        "Reject conflicting reuse of an event or source identity, including the committed FIX case that stops at INPUT_REVIEW_REQUIRED with no result hash.",
      ],
      "Time-format equivalence": [
        "Time-format equivalence",
        "Normalize equivalent offset and Z timestamps to the same instant.",
      ],
      "Sub-millisecond order": [
        "Sub-millisecond order",
        "Preserve supported precision and reject timestamps beyond it.",
      ],
      "Locale-independent order": [
        "Locale-independent order",
        "Order canonical keys by UTF-16 code units without locale data.",
      ],
      "Volatile-metadata exclusion": [
        "Volatile-metadata exclusion",
        "Exclude collection metadata from the canonical result hash.",
      ],
      "Mixed-sequence policy": [
        "Mixed-sequence policy",
        "Fail closed on mixed sequence presence and define the all-absent order.",
      ],
      "Dialect convergence": [
        "Dialect convergence",
        "Replay equivalent committed source dialects to one canonical result.",
      ],
      "Dataset-profile determinism": [
        "Dataset-profile determinism",
        "Keep dataset profiles stable across shuffling and source dialects.",
      ],
      "Mapping-approval binding": [
        "Mapping-approval binding",
        "Bind approval to the validated proposal and its executed transforms.",
      ],
      "Record-set completeness": [
        "Record-set completeness",
        "Reject omitted declared rows or approved columns before result hashing.",
      ],
      "Mapping agreement reporting": [
        "Mapping agreement reporting",
        "Report per-field agreement between mapped canonical events and each mapping application's review outcome.",
      ],
      "Reachable mapping review": [
        "Reachable mapping review",
        "Require a justified override for a flagged field while preserving a fully resolvable path.",
      ],
      "Scenario classification": [
        "Scenario classification",
        "Published-schema synthetic cases reach SUPPORTED, NOT_SUPPORTED and INCONCLUSIVE. The FIX broad-participation case has six comparable executions, fails ACTOR_CONCENTRATION and REMOVAL_SENSITIVITY, and passes the other three gates.",
      ],
      "Evidence completeness": [
        "Evidence completeness",
        "Resolve each baseline finding reference through eventId and rawRowHash to a hash-verified committed source row.",
      ],
      "Versioned fixture evaluation": [
        "Versioned fixture evaluation",
        "Reproduce committed mapping, review, mutation, scenario and trace counts with a separate environment receipt. These authored cases do not estimate accuracy.",
      ],
      "Independent provider accuracy": [
        "Independent provider accuracy",
        "Evaluate configured providers on independent mappings under a separately declared protocol.",
      ],
    },
  },
  ko: {
    eyebrow: "평가 목록",
    title: "모든 결과를 받치는 엔진 검증",
    counts: (implemented, planned) => `구현됨 ${implemented} · 계획 ${planned}`,
    lede: "구현된 검증마다 그것을 지키는 커밋된 테스트를 밝힙니다. 계획된 측정은 사례, 명령, 실행 환경, 한계를 커밋해야 결과가 됩니다.",
    history:
      "현재 평가는 합성 사례만 사용합니다. 이전 공개자료 평가는 출처가 철회된 과거 캡처입니다.",
    protocolLink: "평가 정의, 재현 명령, 실행 환경과 원시 결과",
    testsLabel: "커밋된 테스트",
    status: { Implemented: "구현됨", Planned: "계획" },
    checks: {
      "Row-order invariance": [
        "행 순서 불변성",
        "같은 이벤트의 순서를 섞어도 정본 해시는 하나여야 합니다.",
      ],
      "Literal golden hash": [
        "리터럴 골든 해시",
        "커밋된 fixture를 정해진 정본 결과 해시에 고정합니다.",
      ],
      "Exact duplicate tolerance": [
        "완전히 같은 중복 행 허용",
        "동일한 소스 행을 넣어도 정본 이벤트는 바뀌지 않아야 합니다.",
      ],
      "Identity-conflict rejection": [
        "식별자 충돌 거부",
        "event 또는 소스 식별자가 충돌한 채 재사용되면 거부합니다. 커밋된 FIX 충돌 사례는 결과 해시 없이 INPUT_REVIEW_REQUIRED에서 멈춥니다.",
      ],
      "Time-format equivalence": [
        "시각 형식 동등성",
        "동등한 offset과 Z 시각을 같은 순간으로 정규화합니다.",
      ],
      "Sub-millisecond order": [
        "밀리초 미만 순서",
        "지원하는 정밀도는 보존하고 그보다 세밀한 시각은 거부합니다.",
      ],
      "Locale-independent order": [
        "로캘과 무관한 순서",
        "로캘 데이터 없이 UTF-16 코드 단위로 정본 키를 정렬합니다.",
      ],
      "Volatile-metadata exclusion": [
        "변동 메타데이터 제외",
        "수집 메타데이터는 정본 결과 해시에서 제외합니다.",
      ],
      "Mixed-sequence policy": [
        "혼합 sequence 정책",
        "sequence 유무가 섞이면 실패로 처리하고, 모두 없을 때의 순서를 정합니다.",
      ],
      "Dialect convergence": [
        "방언 수렴",
        "동등한 커밋 소스 방언은 하나의 정본 결과에 이릅니다.",
      ],
      "Dataset-profile determinism": [
        "데이터셋 프로파일 결정성",
        "행 순서와 소스 방언이 바뀌어도 데이터셋 프로파일을 일정하게 유지합니다.",
      ],
      "Mapping-approval binding": [
        "매핑 승인 결속",
        "승인을 검증된 제안과 실제 적용된 변환에 묶습니다.",
      ],
      "Record-set completeness": [
        "레코드 집합 완전성",
        "결과 해시 전에 선언된 행이나 승인된 열이 빠졌으면 거부합니다.",
      ],
      "Mapping agreement reporting": [
        "매핑 일치 보고",
        "매핑된 정본 이벤트와 각 매핑 적용의 검토 결과가 필드별로 일치하는지 보고합니다.",
      ],
      "Reachable mapping review": [
        "도달 가능한 매핑 검토",
        "표시된 필드는 사유가 있는 override를 요구하되, 끝까지 처리할 수 있는 경로는 남깁니다.",
      ],
      "Scenario classification": [
        "사례 분류",
        "공개 스키마 기반 합성 사례로 SUPPORTED, NOT_SUPPORTED, INCONCLUSIVE에 도달합니다. FIX 참여자 분산 사례는 비교 가능한 체결 여섯 건으로 ACTOR_CONCENTRATION과 REMOVAL_SENSITIVITY를 통과하지 못하고 나머지 세 기준은 통과합니다.",
      ],
      "Evidence completeness": [
        "증거 완전성",
        "기준 사례의 각 발견 참조를 eventId와 rawRowHash를 거쳐 해시를 검증한 커밋 원본 행까지 연결합니다.",
      ],
      "Versioned fixture evaluation": [
        "버전별 픽스처 평가",
        "커밋된 연결, 검토, 변형, 시나리오와 추적 건수를 재현하고 실행 환경을 별도로 기록합니다. 직접 작성한 사례로 정확도를 추정하지 않습니다.",
      ],
      "Independent provider accuracy": [
        "독립 자료의 제공자 정확도",
        "별도로 선언한 측정 방식 아래 독립된 연결 자료로 설정된 제공자를 평가할 계획입니다.",
      ],
    },
  },
};
