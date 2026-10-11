"use client";

import { useRef, useState } from "react";

import type {
  ApprovalRecord,
  CaseManifest,
  MappingResponse,
  ReplayRequest,
  ReplayResultResponse,
  ReplayReviewResponse,
  ReplayScenario,
  WorkflowState,
} from "@weavetrail/contracts";
import {
  MappingResponseSchema,
  ReplayReviewResponseSchema,
} from "@weavetrail/contracts";

import {
  attemptApproval,
  mappingOverrides,
  resetReplayForScenarioChange,
  unresolvedMappingFields,
} from "./approval";
import { shuffleSourceRows } from "./shuffle-source-rows";
import type { CaseReplayProps, Mutation, ReplayError } from "./types";

/** The worked case the walkthrough follows, and working mode opens on. */
export const WORKED_CASE = "published-execution-fix44.csv";

/**
 * Everything a replay surface knows and can do. One hook owns the state, so
 * the guided walkthrough and working mode make the same approvals and runs.
 */
export function useCaseReplay({
  proposals,
  providerMode,
  scenarios,
}: CaseReplayProps) {
  const requestGeneration = useRef(0);
  const lastSubmittedRows = useRef<ReplayRequest["rows"] | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<string[] | null>(null);
  const [previousHash, setPreviousHash] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ReplayScenario>(
    scenarios.find(({ value }) => value === WORKED_CASE)?.value ??
      scenarios[0]!.value,
  );
  const [mutation, setMutation] = useState<Mutation>("baseline");
  const [result, setResult] = useState<ReplayResultResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ReplayError | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(
    null,
  );
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [caseApproval, setCaseApproval] = useState<ApprovalRecord | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const [requestedMapping, setRequestedMapping] =
    useState<MappingResponse | null>(null);
  const [requestingMapping, setRequestingMapping] = useState(false);

  const selectedScenario = scenarios.find(({ value }) => value === scenario)!;
  const proposal =
    requestedMapping?.proposal ??
    proposals[selectedScenario.sourceArtifactHash]!;
  const proposalPending =
    selectedScenario.mappingRequestRequired === true &&
    requestedMapping === null;
  const displayedProviderMode = requestedMapping?.mode ?? providerMode;
  const unresolvedFields = unresolvedMappingFields(proposal, reviewReasons);
  const unresolvedReview = unresolvedFields.length > 0;
  const completeResult =
    result?.workflowState === "REPLAYED" &&
    "evaluation" in result &&
    "sourceTrace" in result;
  const repeatMatches =
    completeResult &&
    previousHash !== null &&
    previousHash === result.replay.canonicalResultHash;
  // A source without a case manifest is mapped and normalized, never
  // evaluated, so its run control says so.
  const normalizingOnly =
    selectedScenario.manifest === undefined &&
    "eventType" in proposal.constants;
  const approveMappingBlocked =
    unresolvedReview || proposalPending || requestingMapping;
  const runBlocked =
    running ||
    approval === null ||
    (selectedScenario.manifest !== undefined && caseApproval === null);
  const repeatBlocked =
    running || !approval || !caseApproval || (!completeResult && !previousHash);

  function invalidateResult() {
    requestGeneration.current += 1;
    setResult(null);
    setError(null);
    setWorkflowState(null);
    setRunning(false);
    setRequestingMapping(false);
    setPreviousHash(null);
    setSubmittedOrder(null);
    return requestGeneration.current;
  }

  async function approveMapping() {
    if (approveMappingBlocked) return;
    const generation = invalidateResult();
    setCaseApproval(null);
    setApproval(null);
    const attempt = await attemptApproval(
      proposal,
      mappingOverrides(proposal, reviewReasons),
    );
    if (generation !== requestGeneration.current) return;
    setApproval(attempt.approval);
    setError(attempt.error === null ? null : { kind: "approval-hash" });
  }

  /** A reviewer reason changed: whatever was approved no longer holds. */
  function setReviewReason(fieldPath: string, reason: string) {
    invalidateResult();
    setCaseApproval(null);
    setReviewReasons((current) => ({ ...current, [fieldPath]: reason }));
    setApproval(null);
  }

  async function requestMapping() {
    const generation = invalidateResult();
    setApproval(null);
    setCaseApproval(null);
    setReviewReasons({});
    setRequestedMapping(null);
    setRequestingMapping(true);
    try {
      const response = await fetch("/api/mapping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const review = ReplayReviewResponseSchema.parse(body);
        if (review.workflowState !== "MAPPING_REVIEW_REQUIRED")
          throw new Error("Unexpected mapping review state");
        if (generation !== requestGeneration.current) return;
        setWorkflowState(review.workflowState);
        setError({ kind: "mapping-review", review });
        return;
      }
      const mapping = MappingResponseSchema.parse(body);
      if (generation !== requestGeneration.current) return;
      if (
        mapping.proposal.sourceArtifactHash !==
        selectedScenario.sourceArtifactHash
      )
        throw new Error("Mapping artifact mismatch");
      setRequestedMapping(mapping);
      setWorkflowState("MAPPING_PROPOSED");
    } catch {
      if (generation !== requestGeneration.current) return;
      setWorkflowState("MAPPING_REVIEW_REQUIRED");
      setError({ kind: "mapping-unavailable" });
    } finally {
      if (generation === requestGeneration.current) setRequestingMapping(false);
    }
  }

  async function approveCase() {
    if (approval === null || selectedScenario.manifest === undefined) return;
    const generation = invalidateResult();
    setCaseApproval(null);
    const attempt = await attemptApproval(selectedScenario.manifest);
    if (generation !== requestGeneration.current) return;
    setCaseApproval(attempt.approval);
    setError(attempt.error === null ? null : { kind: "approval-hash" });
  }

  async function runReplay(repeat = false) {
    if (
      running ||
      !approval ||
      proposalPending ||
      requestingMapping ||
      unresolvedReview ||
      (repeat && !completeResult && previousHash === null) ||
      (selectedScenario.manifest && !caseApproval)
    )
      return;
    const comparisonHash = repeat
      ? (previousHash ??
        (completeResult ? result.replay.canonicalResultHash : null))
      : null;
    const generation = invalidateResult();
    setPreviousHash(comparisonHash);
    setRunning(true);
    try {
      const rows =
        repeat && lastSubmittedRows.current
          ? lastSubmittedRows.current
          : mutation === "shuffle"
            ? shuffleSourceRows(
                selectedScenario.rows,
                lastSubmittedRows.current ?? selectedScenario.rows,
              )
            : [...selectedScenario.rows];
      const request: ReplayRequest = {
        scenario,
        mutation,
        rows,
        mappingApproval: approval,
        ...(requestedMapping?.mode === "ai"
          ? { mappingReceipt: requestedMapping.mappingReceipt }
          : {}),
        ...(selectedScenario.manifest && caseApproval
          ? {
              caseManifest: {
                ...selectedScenario.manifest,
                approval: caseApproval,
              } satisfies CaseManifest,
            }
          : {}),
      };
      lastSubmittedRows.current = request.rows;
      setSubmittedOrder(
        request.rows.map(({ coordinate }) => coordinate.rowNumber),
      );
      const response = await fetch("/api/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const review = (await response.json()) as ReplayReviewResponse;
        if (generation !== requestGeneration.current) return;
        setWorkflowState(review.workflowState);
        setError({
          kind: "refused",
          message: review.issues.map(({ message }) => message).join(" "),
        });
        return;
      }
      const replayResult = (await response.json()) as ReplayResultResponse;
      if (generation !== requestGeneration.current) return;
      setWorkflowState(replayResult.workflowState);
      setResult(replayResult);
    } catch {
      if (generation !== requestGeneration.current) return;
      setError({ kind: "failed" });
    } finally {
      if (generation === requestGeneration.current) setRunning(false);
    }
  }

  /**
   * Back to the walkthrough's start: the worked case at its baseline, with no
   * approval, result or evidence that may belong to working-mode inputs.
   */
  function restoreWorkedCase() {
    invalidateResult();
    lastSubmittedRows.current = null;
    setMutation("baseline");
    setScenario(
      scenarios.find(({ value }) => value === WORKED_CASE)?.value ??
        scenarios[0]!.value,
    );
    setApproval(null);
    setCaseApproval(null);
    setReviewReasons({});
    setRequestedMapping(null);
  }

  /** Working mode: another committed source, so every approval starts over. */
  function chooseScenario(next: ReplayScenario) {
    invalidateResult();
    lastSubmittedRows.current = null;
    setMutation("baseline");
    const reset = resetReplayForScenarioChange(next);
    setScenario(reset.scenario);
    setApproval(reset.approval);
    setCaseApproval(reset.caseApproval);
    setResult(reset.result);
    setError(reset.error);
    setWorkflowState(null);
    setReviewReasons({});
    setRequestedMapping(null);
    setRequestingMapping(false);
  }

  function chooseMutation(next: Mutation) {
    invalidateResult();
    setMutation(next);
  }

  return {
    providerMode,
    proposals,
    scenarios,
    previousHash,
    scenario,
    selectedScenario,
    mutation,
    submittedOrder,
    result,
    completeResult,
    repeatMatches,
    running,
    error,
    workflowState,
    approval,
    caseApproval,
    reviewReasons,
    proposal,
    proposalPending,
    displayedProviderMode,
    unresolvedFields,
    unresolvedReview,
    requestingMapping,
    normalizingOnly,
    approveMappingBlocked,
    runBlocked,
    repeatBlocked,
    approveMapping,
    setReviewReason,
    requestMapping,
    approveCase,
    runReplay,
    chooseScenario,
    chooseMutation,
    restoreWorkedCase,
  };
}

export type ReplayView = ReturnType<typeof useCaseReplay>;
