"use client";

import { useLanguage } from "../i18n/language";

import { CaseReplay } from "./case-replay";
import type { CaseReplayProps } from "./types";

/** Working mode in the reader's language. */
export function ReplayModeBoundary(props: CaseReplayProps) {
  const { language } = useLanguage();
  return <CaseReplay {...props} language={language} />;
}
