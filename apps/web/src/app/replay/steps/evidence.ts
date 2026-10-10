import { GUIDE_TARGET_EVIDENCE, reveal, type GuideStep } from "./step";

interface EvidencePanel {
  readonly panelLabel: string;
  readonly normalizedOnly: string;
  readonly outcome: string;
  readonly underCase: string;
  readonly tally: (passed: number, total: number) => string;
  readonly boundary: string;
  readonly technical: string;
  readonly engineVersion: string;
  readonly input: string;
  readonly canonical: string;
  readonly duplicates: string;
  readonly order: string;
  readonly bundle: string;
  readonly fixtureMode: string;
  readonly readyToReplay: string;
  readonly readyToNormalize: string;
  readonly readyWithCase: string;
  readonly readyWithoutCase: string;
  readonly goToEvidence: string;
  readonly resultLabel: string;
  readonly reason: string;
  readonly noEvidence: string;
  readonly passed: string;
  readonly failed: string;
  readonly eventsCounted: (count: number) => string;
  readonly inspect: (gate: string, label: string) => string;
  readonly inspectNote: string;
  readonly evidenceFor: (eventId: string) => string;
  readonly sourceRow: string;
  readonly machineValues: string;
  readonly canonicalEvent: string;
  readonly committedRow: string;
  readonly artifact: string;
  readonly rowNumber: string;
  readonly rawValues: string;
  readonly sensitivity: string;
  readonly sensitivityLink: string;
  readonly priceChange: string;
  readonly withoutActors: string;
  readonly difference: string;
  readonly nonComparable: string;
}

/**
 * Step 6: the result describes support for one versioned pattern hypothesis,
 * and every check opens to the canonical events it counted and the committed
 * source row behind each. The visitor satisfies the step by opening one.
 */
export const evidenceStep: GuideStep<EvidencePanel> = {
  stage: "trace",
  actor: "Versioned code decided it",
  narration: {
    en: {
      title: "Inspect the finding",
      purpose:
        "This result describes support for one versioned pattern hypothesis under the approved scope. Five checks are reported, each with the value observed and the threshold it is compared against.",
      action:
        "Open the source evidence under a gate to reach its canonical events and committed source rows.",
      actorDetail:
        "Gates, observed values and the source trace are server-derived, not model output.",
      blocker: "Open a finding's source evidence to continue.",
    },
    ko: {
      title: "판단 근거 확인",
      purpose:
        "결과는 하나의 패턴 가설을 승인된 범위 안에서 얼마나 뒷받침하는지만 말합니다. 다섯 개 판단 항목마다 관측값과 기준 충족 여부가 함께 나옵니다.",
      action:
        "판단 항목 하나의 근거를 열어, 그 값이 나온 원본 거래자료까지 따라가 보세요.",
      actorDetail:
        "판단 항목과 관측값, 근거 추적은 모두 서버가 계산한 값이며 모델이 지어낸 문장이 아닙니다.",
      blocker: "판단 근거를 하나 열어야 계속할 수 있습니다.",
    },
  },
  panel: {
    en: {
      panelLabel: "Canonical result",
      normalizedOnly:
        "Mapping and normalization only. No case has been approved or evaluated.",
      outcome: "Pattern outcome",
      underCase: "under the approved case and",
      tally: (passed, total) => `${passed} of ${total} checks pass.`,
      boundary:
        "Pattern support is not a legal or causal conclusion. Actor removal is a mechanical sensitivity comparison.",
      technical:
        "Technical details: engine version, canonical order and result hash",
      engineVersion: "Engine version",
      input: "Input",
      canonical: "Canonical",
      duplicates: "Duplicates",
      order: "Canonical order",
      bundle:
        "The engine can independently assemble and verify an Evidence Bundle from source bytes; browser export is planned. Each displayed hash states what it covers where it is shown.",
      fixtureMode: "Fixture mode",
      readyToReplay: "Ready to replay",
      readyToNormalize: "Ready to normalize",
      readyWithCase:
        "Review the source and explicitly approve its mapping and case.",
      readyWithoutCase:
        "Review the source and explicitly approve its mapping, including any required interpretation reasons. Normalization has no case evaluation.",
      goToEvidence: "Go to the finding evidence",
      resultLabel: "Pattern hypothesis result",
      reason: "Reason",
      noEvidence: "No evaluated finding evidence is available.",
      passed: "PASS",
      failed: "FAIL",
      eventsCounted: (count) =>
        `${count} canonical ${count === 1 ? "event" : "events"} counted`,
      inspect: (gate) => `Inspect source evidence for ${gate}`,
      inspectNote:
        "The canonical events this check counted, and the committed source row behind each one.",
      evidenceFor: (eventId) => `Source evidence for ${eventId}`,
      sourceRow: "Source row",
      machineValues:
        "Machine values: the canonical event and its committed source row",
      canonicalEvent: "Canonical event",
      committedRow: "Committed source row",
      artifact: "Artifact",
      rowNumber: "Source row number",
      rawValues: "Raw column values",
      sensitivity: "Mechanical sensitivity comparison",
      sensitivityLink: "Inspect removal sensitivity evidence",
      priceChange: "Price change",
      withoutActors: "Without approved actor group",
      difference: "Metric difference",
      nonComparable: "Non-comparable events",
    },
    ko: {
      panelLabel: "분석 결과",
      normalizedOnly:
        "항목 연결과 자료 정리까지만 마쳤습니다. 조사 범위를 승인하거나 평가하지는 않았습니다.",
      outcome: "패턴 결과",
      underCase: "승인된 사례와",
      tally: (passed, total) => `판단 항목 ${total}개 중 ${passed}개 충족.`,
      boundary:
        "패턴을 뒷받침한다는 결과는 법적 판단도, 인과관계에 대한 결론도 아닙니다. 특정 거래 주체를 빼고 비교한 값은 기계적인 대조일 뿐입니다.",
      technical: "기술 정보: 엔진 버전, 정리된 기록 순서, 결과 해시",
      engineVersion: "엔진 버전",
      input: "입력",
      canonical: "정리 후",
      duplicates: "중복",
      order: "정리된 기록 순서",
      bundle:
        "엔진은 원본 바이트에서 증거 묶음을 독립적으로 조립하고 검증할 수 있으며, 브라우저 내보내기는 계획 단계입니다. 화면에 나오는 해시는 저마다 어디까지를 덮는지 그 자리에서 밝힙니다.",
      fixtureMode: "Fixture 모드",
      readyToReplay: "분석 실행 준비 완료",
      readyToNormalize: "자료 정리 준비 완료",
      readyWithCase:
        "원본 자료를 검토하고, 데이터 항목 연결과 조사 범위를 직접 승인하세요.",
      readyWithoutCase:
        "원본 자료를 검토하고 항목 연결을 직접 승인하세요. 확인이 필요한 항목에는 이유를 함께 적어야 합니다. 자료 정리에는 사례 평가가 없습니다.",
      goToEvidence: "판단 근거로 이동",
      resultLabel: "패턴 가설 결과",
      reason: "사유",
      noEvidence: "평가된 발견 증거가 없습니다.",
      passed: "충족",
      failed: "미충족",
      eventsCounted: (count) => `정리된 거래 기록 ${count}건을 셈`,
      inspect: (_gate, label) => `판단 근거 열기: ${label}`,
      inspectNote:
        "이 판단이 센 거래 기록과, 그 기록이 나온 원본 행을 그대로 펼쳐 봅니다.",
      evidenceFor: (eventId) => `${eventId}의 판단 근거`,
      sourceRow: "원본 행",
      machineValues: "기계 값: 정리된 거래 기록과 커밋된 원본 행",
      canonicalEvent: "정리된 거래 기록",
      committedRow: "커밋된 원본 행",
      artifact: "아티팩트",
      rowNumber: "원본 행 번호",
      rawValues: "원본 열 값",
      sensitivity: "기계적 민감도 비교",
      sensitivityLink: "제거 민감도 증거 보기",
      priceChange: "가격 변화",
      withoutActors: "승인된 행위자 그룹 제외",
      difference: "지표 차이",
      nonComparable: "비교할 수 없는 이벤트",
    },
  },
  satisfied: (view) => view.completeResult && view.evidenceOpened,
  // Nothing to reach until a result exists; then the control goes to the
  // first finding's evidence rather than opening it for the visitor.
  railAction: (view, language) =>
    view.completeResult
      ? {
          kind: "locate",
          label: evidenceStep.panel[language].goToEvidence,
          disabled: false,
          run: () =>
            typeof document !== "undefined" &&
            reveal(document.getElementById(GUIDE_TARGET_EVIDENCE)),
        }
      : null,
};
