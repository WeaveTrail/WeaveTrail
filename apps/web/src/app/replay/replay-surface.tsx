"use client";

import React, { useEffect, useRef } from "react";

import { useLanguage } from "../i18n/language";
import { CaseReplayView } from "./case-replay";
import { GuidedTourView } from "./tour/guided-tour";
import type { CaseReplayProps } from "./types";
import { useCaseReplay } from "./use-case-replay";

/**
 * One owner for the replay state across both modes (ADR 0019). Moving from
 * the walkthrough to working mode keeps the approved case and its result;
 * coming back to the walkthrough restores the worked case at its baseline.
 * The query decides the mode and carries no approval or result.
 */
export function ReplaySurface({
  guided,
  ...props
}: CaseReplayProps & { guided: boolean }) {
  const { language } = useLanguage();
  const view = useCaseReplay(props);
  const wasGuided = useRef(guided);
  const { restoreWorkedCase } = view;

  useEffect(() => {
    if (guided && !wasGuided.current) restoreWorkedCase();
    wasGuided.current = guided;
  }, [guided, restoreWorkedCase]);

  return guided ? (
    <GuidedTourView view={view} />
  ) : (
    <CaseReplayView language={language} view={view} />
  );
}
