"use client";

import React from "react";

import { useCopy, type Language } from "./language";

/**
 * The chrome carries the disclosures that have to reach a reader on every
 * page, and nothing else. The header's context line, the rail's authorship
 * legend and the footer tagline were removed: none of them was a step of the
 * flow, and the fixture-mode and synthetic-source statements they shared now
 * sit here once, where every page shows them.
 */
type ChromeKey = "skipToContent" | "footerStatus" | "footerPlanned";

export const chromeCopy: Readonly<Record<Language, Record<ChromeKey, string>>> =
  {
    en: {
      skipToContent: "Skip to content",
      footerStatus:
        "Fixture mode · synthetic cases and licensed published quotes, provenance recorded",
      footerPlanned:
        "Live AI proposals and independent Evidence Bundle export are planned.",
    },
    ko: {
      skipToContent: "본문으로 건너뛰기",
      footerStatus:
        "fixture 모드 · 합성 사례와 이용이 허락된 공표 시세, 출처 기록 있음",
      footerPlanned:
        "실시간 AI 제안과 독립적인 증거 번들 내보내기는 아직 계획입니다.",
    },
  };

/** One chrome string in the active language. English outside a provider. */
export function ChromeText({ id }: { readonly id: ChromeKey }) {
  return <>{useCopy(chromeCopy)[id]}</>;
}
