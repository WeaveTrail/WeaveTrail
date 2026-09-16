import React from "react";

import { EVIDENCE_GRADES, type EvidenceGrade } from "@weavetrail/contracts";

import type { Language } from "./i18n/language";

type GradeCopy = {
  label: string;
  tallyLabel: string;
  explanation: string;
};

type EvidenceGradeCopy = {
  relation: string;
  grades: Readonly<Record<EvidenceGrade, GradeCopy>>;
  differenceNote: string;
  unconfirmableReason: (missing: string, wouldSettle: string) => string;
};

/** Product copy for the complete evidence-grade surface. */
export const evidenceGradeCopy: Readonly<Record<Language, EvidenceGradeCopy>> =
  {
    ko: {
      relation: "근거",
      grades: {
        QUOTED: {
          label: "원문 인용",
          tallyLabel: "원문 인용",
          explanation: "원문 해당 구간과 글자 그대로 같습니다.",
        },
        COMPUTED: {
          label: "계산 확인",
          tallyLabel: "계산 확인",
          explanation: "공개 데이터로 다시 계산한 값과 같습니다.",
        },
        DIFFERS: {
          label: "불일치",
          tallyLabel: "불일치",
          explanation:
            "다시 계산하면 다른 값이 나옵니다. 계산한 값을 함께 표시합니다.",
        },
        UNCONFIRMABLE: {
          label: "확인 불가",
          tallyLabel: "확인 불가",
          explanation:
            "공개 자료로는 확인할 수 없습니다. 이유와 필요한 자료를 함께 표시합니다.",
        },
        INTERPRETATION: {
          label: "AI 해석",
          tallyLabel: "AI 해석",
          explanation:
            "모델이 요약·분류했거나, 데이터로 판단할 문장이 아닙니다.",
        },
      },
      differenceNote: "정의나 기준(종가·고가)의 차이일 수 있습니다.",
      unconfirmableReason: (missing, wouldSettle) =>
        `${missing}. ${wouldSettle}가 연결되면 확인할 수 있습니다.`,
    },
    en: {
      relation: "Evidence",
      grades: {
        QUOTED: {
          label: "Quoted",
          tallyLabel: "quoted",
          explanation: "Matches the source text exactly.",
        },
        COMPUTED: {
          label: "Recomputed",
          tallyLabel: "recomputed",
          explanation: "Equals the value recomputed from public data.",
        },
        DIFFERS: {
          label: "Differs",
          tallyLabel: "differs",
          explanation:
            "Recomputing gives a different value. The computed value is shown with it.",
        },
        UNCONFIRMABLE: {
          label: "Not confirmable",
          tallyLabel: "not confirmable",
          explanation:
            "Public data cannot confirm this. The reason and what would settle it are shown with it.",
        },
        INTERPRETATION: {
          label: "AI interpretation",
          tallyLabel: "AI interpretation",
          explanation:
            "A model summarized or classified this, or it is not a data question.",
        },
      },
      differenceNote:
        "The difference can come from a different definition or reference price (close, high).",
      unconfirmableReason: (missing, wouldSettle) =>
        `${missing}. ${wouldSettle} would let us confirm it.`,
    },
  };

const gradeClass: Readonly<Record<EvidenceGrade, string>> = {
  QUOTED: "evidence-badge--outline",
  COMPUTED: "evidence-badge--filled",
  DIFFERS: "evidence-badge--inverse",
  UNCONFIRMABLE: "evidence-badge--bordered",
  INTERPRETATION: "evidence-badge--dashed",
};

type BadgeBaseProps = {
  language: Language;
};

export type EvidenceBadgeProps = BadgeBaseProps &
  (
    | {
        grade: "UNCONFIRMABLE";
        reason: { missing: string; wouldSettle: string };
      }
    | {
        grade: "DIFFERS";
        computedValue: string;
        reason?: never;
      }
    | {
        grade: Exclude<EvidenceGrade, "DIFFERS" | "UNCONFIRMABLE">;
        reason?: never;
        computedValue?: never;
      }
  );

/**
 * A non-interactive evidence mark. Required companion copy is rendered with
 * DIFFERS and UNCONFIRMABLE so consumers cannot hide it in a tooltip.
 */
export function EvidenceBadge(props: EvidenceBadgeProps) {
  const text = evidenceGradeCopy[props.language];
  const grade = text.grades[props.grade];
  return (
    <span className="evidence-mark">
      <span className={`evidence-badge ${gradeClass[props.grade]}`}>
        <span className="visually-hidden">{text.relation}: </span>
        {grade.label}
      </span>
      {props.grade === "DIFFERS" && (
        <>
          <code className="evidence-computed-value">{props.computedValue}</code>
          <span className="evidence-companion">{text.differenceNote}</span>
        </>
      )}
      {props.grade === "UNCONFIRMABLE" && (
        <span className="evidence-companion">
          {text.unconfirmableReason(
            props.reason.missing,
            props.reason.wouldSettle,
          )}
        </span>
      )}
    </span>
  );
}

export type EvidenceGradeCounts = Readonly<Record<EvidenceGrade, number>>;

export function countEvidenceGrades(
  grades: readonly EvidenceGrade[],
): EvidenceGradeCounts {
  const counts: Record<EvidenceGrade, number> = {
    QUOTED: 0,
    COMPUTED: 0,
    DIFFERS: 0,
    UNCONFIRMABLE: 0,
    INTERPRETATION: 0,
  };
  for (const grade of grades) counts[grade] += 1;
  return counts;
}

function formatCount(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error("Evidence-grade counts must be nonnegative safe integers");
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatEvidenceGradeTally(
  counts: EvidenceGradeCounts,
  language: Language,
): { visible: string; spoken: string } | null {
  for (const grade of EVIDENCE_GRADES) formatCount(counts[grade]);
  const total = EVIDENCE_GRADES.reduce((sum, grade) => sum + counts[grade], 0);
  if (total === 0) return null;
  const text = evidenceGradeCopy[language];
  const included = EVIDENCE_GRADES.filter((grade) => counts[grade] > 0);
  const totalText = formatCount(total);
  if (language === "ko") {
    const details = included
      .map(
        (grade) =>
          `${text.grades[grade].tallyLabel} ${formatCount(counts[grade])}`,
      )
      .join(" · ");
    const spoken = included
      .map(
        (grade) =>
          `${text.grades[grade].tallyLabel} ${formatCount(counts[grade])}개`,
      )
      .join(", ");
    return {
      visible: `문장 ${totalText} — ${details}`,
      spoken: `문장 ${totalText}개 가운데 ${spoken}입니다.`,
    };
  }
  const details = included
    .map(
      (grade) =>
        `${formatCount(counts[grade])} ${text.grades[grade].tallyLabel}`,
    )
    .join(" · ");
  const spoken = included
    .map(
      (grade) =>
        `${formatCount(counts[grade])} ${text.grades[grade].tallyLabel}`,
    )
    .join(", ");
  return {
    visible: `${totalText} ${total === 1 ? "sentence" : "sentences"} — ${details}`,
    spoken: `Of ${totalText} ${total === 1 ? "sentence" : "sentences"}: ${spoken}.`,
  };
}

export function EvidenceGradeTally({
  counts,
  language,
}: {
  counts: EvidenceGradeCounts;
  language: Language;
}) {
  const tally = formatEvidenceGradeTally(counts, language);
  if (tally === null) return null;
  return (
    <p aria-label={tally.spoken} className="evidence-tally">
      <span aria-hidden="true">{tally.visible}</span>
    </p>
  );
}

/** Existing result values remain internal and map to the three code grades. */
export function evidenceGradeForResult(
  result: "SUPPORTED" | "NOT_SUPPORTED" | "INCONCLUSIVE",
): EvidenceGrade {
  switch (result) {
    case "SUPPORTED":
      return "COMPUTED";
    case "NOT_SUPPORTED":
      return "DIFFERS";
    case "INCONCLUSIVE":
      return "UNCONFIRMABLE";
  }
}
