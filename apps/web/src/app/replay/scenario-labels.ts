import type { ReplayScenario } from "@weavetrail/contracts";

import type { Language } from "../i18n/language";
import { replayCopy } from "./copy";

/**
 * Korean display names for the committed sources. The committed `label` in
 * `@weavetrail/scenarios` stays the artifact's own identity and is what the
 * English surface shows; this table only names the same artifact the way a
 * Korean reader meets it on screen, so the source they are told to pick is the
 * source they can find in the list.
 */
export const SCENARIO_LABELS_KO: Readonly<Record<ReplayScenario, string>> = {
  "actorless-multi-instrument-quotes.jsonl":
    "거래 주체 없는 다종목 시세 · JSON Lines",
  "concentrated-buy-dialect-a.csv": "매수 집중 · 형식 A · CSV",
  "concentrated-buy-dialect-b.jsonl": "매수 집중 · 형식 B · JSON Lines",
  "published-execution-fix44.csv": "합성 · 공개 FIX 4.4 체결 항목 · CSV",
  "published-execution-fix44-broad-participation.csv":
    "합성 · 공개 FIX 4.4 참여자가 분산된 사례 · CSV",
  "published-execution-fix44-conflicting-evidence.csv":
    "합성 · 공개 FIX 4.4 체결 식별자 충돌 · CSV",
  "published-execution-h0stcnt0.jsonl":
    "합성 · 공개 H0STCNT0 체결 항목 · JSON Lines",
  "rapid-price-lift-supported.csv": "단기 급등 · 기준을 충족한 사례 · CSV",
  "rapid-price-lift-broad-participation.csv":
    "단기 급등 · 참여자가 분산된 사례 · CSV",
  "rapid-price-lift-insufficient-evidence.csv":
    "단기 급등 · 근거가 부족한 사례 · CSV",
};

/** One list entry: what the source is, that it is synthetic, and its role. */
export function scenarioOptionLabel(
  scenario: ReplayScenario,
  committedLabel: string,
  purpose: "REVIEWER_FACING" | "ENGINE_REGRESSION",
  language: Language,
): string {
  const text = replayCopy[language].working;
  const name =
    language === "ko" ? SCENARIO_LABELS_KO[scenario] : committedLabel;
  const role =
    purpose === "REVIEWER_FACING" ? text.reviewerFacing : text.engineRegression;
  return `${name} · ${text.synthetic} · ${role}`;
}
