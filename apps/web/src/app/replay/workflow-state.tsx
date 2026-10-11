"use client";

import React from "react";

import type { WorkflowState } from "@weavetrail/contracts";

import { replayCopy } from "./copy";
import { useReplayLanguage } from "./replay-language";

/**
 * A workflow state and what it means, in one line. The code is the contract's
 * own value and stays exactly as returned.
 */
export function WorkflowStateBadge({ state }: { state: WorkflowState }) {
  const text = replayCopy[useReplayLanguage()].workflow;
  return (
    <div className="workflow-state" data-state={state}>
      <strong>{text.label}</strong>
      <code>{state}</code>
      <small>{text.meaning[state]}</small>
    </div>
  );
}
