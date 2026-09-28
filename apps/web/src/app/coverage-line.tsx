"use client";

import React from "react";
import type { CoverageCopy } from "../lib/coverage-copy";
import { useLanguage, type Language } from "./i18n/language";

export function CoverageLine({
  summary,
  language,
}: {
  summary: CoverageCopy;
  language?: Language;
}) {
  const selected = useLanguage().language;
  const active = language ?? selected;
  return (
    <p
      className="machine-note coverage-line"
      data-coverage="published-coverage-v1"
    >
      {summary[active]}
      {" · "}
      <a href="/api/coverage">
        {active === "ko" ? "범위 상세" : "Coverage details"}
      </a>
    </p>
  );
}
