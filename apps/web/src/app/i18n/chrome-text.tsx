"use client";

import React from "react";

import { useCopy, type Language } from "./language";

type ChromeKey =
  | "skipToContent"
  | "headerContext"
  | "roleProposals"
  | "roleApprovals"
  | "roleCode"
  | "footerTagline"
  | "footerStatus";

const chrome: Readonly<Record<Language, Record<ChromeKey, string>>> = {
  en: {
    skipToContent: "Skip to content",
    headerContext: "Deterministic fixture mode · recorded source provenance",
    roleProposals: "AI proposals",
    roleApprovals: "Human approvals",
    roleCode: "Versioned code",
    footerTagline: "Weave signals into replayable evidence.",
    footerStatus: "Synthetic cases and published quotes · fixture provider",
  },
  ko: {
    skipToContent: "본문으로 건너뛰기",
    headerContext: "결정론적 fixture 모드 · 기록된 소스 출처",
    roleProposals: "AI 제안",
    roleApprovals: "사람의 승인",
    roleCode: "버전이 찍힌 코드",
    footerTagline: "신호를 다시 돌려볼 수 있는 증거로.",
    footerStatus: "합성 사례와 공표 시세 · fixture provider",
  },
};

/** One chrome string in the active language. English outside a provider. */
export function ChromeText({ id }: { readonly id: ChromeKey }) {
  return <>{useCopy(chrome)[id]}</>;
}
