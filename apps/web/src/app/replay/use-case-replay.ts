"use client";

import { useEffect, useRef, useState } from "react";

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

/** The worked case the walkthrough follows, and its separate review example. */
export const WORKED_CASE = "published-execution-fix44.csv";
export const REVIEW_EXAMPLE = "published-execution-h0stcnt0.jsonl";

/**
 * Everything the replay surface knows and can do. One hook owns the state, so
 * each step reads the same values and calls the same handlers; the steps
 * themselves only describe what they show and when they are satisfied.
 */
export function useCaseReplay({
  proposals,
  providerMode,
  scenarios,
  guided = false,
  mappingExample = false,
  onMappingApprovalChange,
  onGuideComplete,
}: CaseReplayProps) {
  const requestGeneration = useRef(0);
  const [focusPending, setFocusPending] = useState(false);
  const previousGuided = useRef(guided);
  const lastSubmittedRows = useRef<ReplayRequest["rows"] | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<string[] | null>(null);
  const [chapter, setChapter] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [exampleApproved, setExampleApproved] = useState(false);
  const [evidenceOpened, setEvidenceOpened] = useState(false);
  const [previousHash, setPreviousHash] = useState<string | null>(null);
  const guidedScenario =
    scenarios.find(({ value }) => value === WORKED_CASE)?.value ??
    scenarios[0]!.value;
  const [scenario, setScenario] = useState<ReplayScenario>(guidedScenario);
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
  const exampleScenario =
    scenarios.find(({ value }) => value === REVIEW_EXAMPLE) ??
    scenarios.find(({ value }) => value === "concentrated-buy-dialect-b.jsonl");
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

  useEffect(() => {
    if (guided && !previousGuided.current) {
      requestGeneration.current += 1;
      setChapter(0);
      setCompletedSteps([]);
      setExampleApproved(false);
      setEvidenceOpened(false);
      setPreviousHash(null);
      lastSubmittedRows.current = null;
      setSubmittedOrder(null);
      setScenario(guidedScenario);
      setMutation("baseline");
      setResult(null);
      setRunning(false);
      setError(null);
      setWorkflowState(null);
      setApproval(null);
      setCaseApproval(null);
      setReviewReasons({});
      setRequestedMapping(null);
      setRequestingMapping(false);
    }
    previousGuided.current = guided;
  }, [guided, guidedScenario]);

  function goToChapter(next: number) {
    setFocusPending(true);
    setChapter(next);
  }

  function completeChapter(step: number) {
    setCompletedSteps((current) =>
      current.includes(step) ? current : [...current, step],
    );
  }

  function focusChapterTitle(node: HTMLHeadingElement | null) {
    if (node && focusPending) {
      node.focus();
      setFocusPending(false);
    }
  }

  function invalidateResult() {
    requestGeneration.current += 1;
    setResult(null);
    setError(null);
    setWorkflowState(null);
    setRunning(false);
    setRequestingMapping(false);
    setEvidenceOpened(false);
    setPreviousHash(null);
    setSubmittedOrder(null);
    return requestGeneration.current;
  }

  async function approveMapping() {
    if (approveMappingBlocked) return;
    const generation = invalidateResult();
    setCaseApproval(null);
    setApproval(null);
    onMappingApprovalChange?.(false);
    const attempt = await attemptApproval(
      proposal,
      mappingOverrides(proposal, reviewReasons),
    );
    if (generation !== requestGeneration.current) return;
    setApproval(attempt.approval);
    onMappingApprovalChange?.(attempt.approval !== null);
    setError(attempt.error === null ? null : { kind: "approval-hash" });
  }

  /** A reviewer reason changed: whatever was approved no longer holds. */
  function setReviewReason(fieldPath: string, reason: string) {
    invalidateResult();
    setCaseApproval(null);
    setReviewReasons((current) => ({ ...current, [fieldPath]: reason }));
    setApproval(null);
    onMappingApprovalChange?.(false);
  }

  async function requestMapping() {
    const generation = invalidateResult();
    setApproval(null);
    setCaseApproval(null);
    setReviewReasons({});
    setRequestedMapping(null);
    onMappingApprovalChange?.(false);
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
    guided,
    mappingExample,
    providerMode,
    proposals,
    scenarios,
    chapter,
    completedSteps,
    exampleApproved,
    evidenceOpened,
    previousHash,
    scenario,
    selectedScenario,
    exampleScenario,
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
    goToChapter,
    completeChapter,
    focusChapterTitle,
    setFocusPending,
    approveMapping,
    setReviewReason,
    requestMapping,
    approveCase,
    runReplay,
    chooseScenario,
    chooseMutation,
    setExampleApproved,
    openEvidence: () => setEvidenceOpened(true),
    onGuideComplete,
  };
}

export type ReplayView = ReturnType<typeof useCaseReplay>;
