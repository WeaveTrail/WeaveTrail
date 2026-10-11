import type {
  MappingBudgetDenialReason,
  ReplayReviewResponse,
} from "@weavetrail/contracts";
import type { Language } from "../i18n/language";

export type MappingReviewResponse = Extract<
  ReplayReviewResponse,
  { workflowState: "MAPPING_REVIEW_REQUIRED" }
>;

const budgetDenialCopy: Record<
  MappingBudgetDenialReason,
  Record<Language, string>
> = {
  VISITOR_DAILY_LIMIT: {
    en: "Your daily live model request limit has been reached. No model was called. Try after 00:00 KST or use recorded runs.",
    ko: "오늘의 실제 모델 요청 한도에 도달했습니다. 모델을 호출하지 않았습니다. 00:00 KST 이후 다시 시도하거나 기록된 실행을 이용하세요.",
  },
  GLOBAL_DAILY_LIMIT: {
    en: "The daily shared live model call limit has been reached. No model was called. Try after 00:00 KST or use recorded runs.",
    ko: "오늘의 전체 실제 모델 호출 한도에 도달했습니다. 모델을 호출하지 않았습니다. 00:00 KST 이후 다시 시도하거나 기록된 실행을 이용하세요.",
  },
  BUDGET_UNAVAILABLE: {
    en: "Live model budget checks are unavailable. No model was called. Use recorded runs or retry later.",
    ko: "실제 모델 호출 예산을 확인할 수 없습니다. 모델을 호출하지 않았습니다. 기록된 실행을 이용하거나 나중에 다시 시도하세요.",
  },
};

/** The caller validates the whole review contract before retaining this data.
 * Select copy at render time so language changes also update pending denials.
 */
export function mappingReviewMessage(
  review: MappingReviewResponse,
  language: Language,
): string {
  return `REVIEW_REQUIRED: ${review.issues
    .map((issue) =>
      issue.budgetReason
        ? budgetDenialCopy[issue.budgetReason][language]
        : issue.message,
    )
    .join(" ")}`;
}
