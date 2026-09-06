import type { ReplayScenario } from "@weavetrail/contracts";

import { type Language } from "../i18n/language";

/**
 * Korean display names for the committed sources. The committed `label` in
 * `@weavetrail/scenarios` stays the artifact's own identity and is what the
 * English surface shows; this table only names the same artifact the way a
 * Korean reader meets it on screen, so the source they are told to pick is the
 * source they can find in the list.
 */
const SCENARIO_LABELS_KO: Readonly<Partial<Record<ReplayScenario, string>>> = {
  "actorless-multi-instrument-quotes.jsonl":
    "거래 주체 없는 다종목 시세 · JSON Lines",
  "concentrated-buy-dialect-a.csv": "매수 집중 · 형식 A · CSV",
  "concentrated-buy-dialect-b.jsonl": "매수 집중 · 형식 B · JSON Lines",
  "rapid-price-lift-supported.csv": "단기 급등 · 기준을 충족한 사례 · CSV",
  "rapid-price-lift-broad-participation.csv":
    "단기 급등 · 참여자가 분산된 사례 · CSV",
  "rapid-price-lift-insufficient-evidence.csv":
    "단기 급등 · 근거가 부족한 사례 · CSV",
  "real/fsc-stock-quotes-20260903.jsonl":
    "금융위원회 공개 · 코스피 일별 시세 · 2026-09-03",
  "real/fsc-kospi-index-family-20260903/source.jsonl":
    "금융위원회 공개 · 코스피 지수군 · 2026-09-03",
  "real/fsc-kospi-200-baseline-20260701-20260903/source.jsonl":
    "금융위원회 공개 · 코스피200 기준선 · 2026-07-01~2026-09-03",
  "real/fsc-kospi-200-futures-20260903/source.jsonl":
    "금융위원회 공개 · 코스피200 선물 · 2026-09-03",
  "real/fsc-weekly-options-20260903/source.jsonl":
    "금융위원회 공개 · 주간 옵션 · 2026-09-03",
};

const SOURCE_KIND_KO: Readonly<Record<string, string>> = {
  synthetic: "시연용 가상자료",
  real: "공개 실제 자료",
};

/** One list entry: what the source is, and whether it is real or synthetic. */
export function scenarioOptionLabel(
  scenario: ReplayScenario,
  committedLabel: string,
  kind: string,
  language: Language,
): string {
  if (language !== "ko") return `${committedLabel} · ${kind}`;
  return `${SCENARIO_LABELS_KO[scenario] ?? committedLabel} · ${
    SOURCE_KIND_KO[kind] ?? kind
  }`;
}
