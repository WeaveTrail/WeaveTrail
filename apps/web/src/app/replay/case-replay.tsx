"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

import type {
  ReplayResultResponse,
  ReplayReviewResponse,
  ReplayScenario,
  ReplayRequest,
  ApprovalRecord,
  CaseManifest,
  CaseManifestProposal,
  RapidPriceLiftResult,
  SchemaMappingProposal,
  SourceTrace,
  WorkflowState,
} from "@weavetrail/contracts";
import { requiresMappingOverride } from "@weavetrail/contracts";
import {
  canonicalJson,
  type CanonicalJsonInput,
} from "@weavetrail/replay-engine/canonical-json";
import { shuffleSourceRows } from "./shuffle-source-rows";

type Mutation = "baseline" | "shuffle" | "duplicate";

export type ReplayScenarioOption = {
  value: ReplayScenario;
  label: string;
  sourceArtifactHash: string;
  rows: ReplayRequest["rows"];
  manifest?: CaseManifestProposal;
};

export type CaseReplayProps = {
  providerMode: "fixture";
  proposals: Record<string, SchemaMappingProposal>;
  scenarios: ReplayScenarioOption[];
  guided?: boolean;
  mappingExample?: boolean;
  onMappingApprovalChange?: (approved: boolean) => void;
  onGuideComplete?: () => void;
};

const workedCase = "rapid-price-lift-supported.csv";
const reviewExample = "concentrated-buy-dialect-b.jsonl";
const chapters = [
  "Read the source",
  "Review the mapping",
  "Approve the case",
  "Run the replay",
  "Inspect the finding",
  "Repeat the case",
  "Take the controls",
] as const;

const gateDescriptions = {
  PRICE_CHANGE:
    "Peak price rise from the first eligible trade, in basis points (100 bps = 1%).",
  AGGRESSIVE_BUY_SHARE:
    "Share of eligible trade value (price × quantity) from BUY events, in basis points.",
  ACTOR_CONCENTRATION:
    "Share of BUY trade value from the approved actor group, in basis points.",
  REPEATED_EXECUTION:
    "Number of approved-actor aggressive buys above the reference price.",
  REMOVAL_SENSITIVITY:
    "Difference in price-rise basis points when the approved actor group's trades are removed; a mechanical comparison.",
} as const;

export function ApprovalReceipt({ approval }: { approval: ApprovalRecord }) {
  return (
    <dl className="approval-receipt">
      <div>
        <dt>Approved artifact hash</dt>
        <dd>
          <code>{approval.approvedArtifactHash}</code>
        </dd>
      </div>
      <div>
        <dt>Reviewer</dt>
        <dd>{approval.reviewerRef}</dd>
      </div>
      <div>
        <dt>Decision</dt>
        <dd>{approval.decision}</dd>
      </div>
      <div>
        <dt>Approved at</dt>
        <dd>{approval.approvedAt}</dd>
      </div>
      {approval.overrides.map(({ fieldPath, reason }) => (
        <div key={fieldPath}>
          <dt>{fieldPath}</dt>
          <dd>{reason}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SourceRows({ scenario }: { scenario: ReplayScenarioOption }) {
  return (
    <section className="source-preview" aria-label="Committed source rows">
      <p>
        Artifact: <code>{scenario.value}</code>
      </p>
      <p>
        sourceArtifactHash: <code>{scenario.sourceArtifactHash}</code>
      </p>
      <p>
        These synthetic source records are fixed. Values below are the original
        strings, before mapping, shown in committed order.
      </p>
      {scenario.rows.map((row) => (
        <details
          key={row.coordinate.rowNumber}
          open={
            row.coordinate.rowNumber === scenario.rows[0]?.coordinate.rowNumber
          }
        >
          <summary>Source row {row.coordinate.rowNumber}</summary>
          <dl className="source-values">
            {Object.entries(row.values).map(([column, value]) => (
              <div key={column}>
                <dt>{column}</dt>
                <dd>
                  <code>{value}</code>
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </section>
  );
}

export const APPROVAL_HASH_ERROR =
  "Approval hash could not be computed. Approval and replay remain blocked.";

type ApprovalHashCrypto = {
  subtle?: Pick<SubtleCrypto, "digest">;
};

export function mappingOverrides(
  proposal: SchemaMappingProposal,
  reasons: Readonly<Record<string, string>>,
): ApprovalRecord["overrides"] {
  return proposal.fields.flatMap((field, index) => {
    if (!requiresMappingOverride(field)) return [];
    const reason = reasons[`fields.${index}`]?.trim();
    return reason ? [{ fieldPath: `fields.${index}`, reason }] : [];
  });
}

export function hasUnresolvedMappingReview(
  proposal: SchemaMappingProposal,
  reasons: Readonly<Record<string, string>>,
): boolean {
  return proposal.fields.some(
    (field, index) =>
      requiresMappingOverride(field) && !reasons[`fields.${index}`]?.trim(),
  );
}

export function resetReplayForScenarioChange(scenario: ReplayScenario) {
  return {
    scenario,
    approval: null,
    caseApproval: null,
    result: null,
    error: null,
  } satisfies {
    scenario: ReplayScenario;
    approval: ApprovalRecord | null;
    caseApproval: ApprovalRecord | null;
    result: ReplayResultResponse | null;
    error: string | null;
  };
}

export async function approvalFor(
  artifact: CanonicalJsonInput,
  overrides: ApprovalRecord["overrides"] = [],
  cryptoProvider: ApprovalHashCrypto | undefined = globalThis.crypto,
): Promise<ApprovalRecord> {
  try {
    if (cryptoProvider?.subtle === undefined) {
      throw new Error("Web Crypto is unavailable");
    }
    const bytes = new TextEncoder().encode(canonicalJson(artifact));
    const digest = await cryptoProvider.subtle.digest("SHA-256", bytes);
    const approvedArtifactHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return {
      approvedArtifactHash,
      reviewerRef: "reviewer:local-lab",
      decision: "APPROVED",
      overrides,
      approvedAt: new Date().toISOString(),
    };
  } catch {
    throw new Error(APPROVAL_HASH_ERROR);
  }
}

export async function attemptApproval(
  artifact: CanonicalJsonInput,
  overrides: ApprovalRecord["overrides"] = [],
  cryptoProvider: ApprovalHashCrypto | undefined = globalThis.crypto,
): Promise<{ approval: ApprovalRecord | null; error: string | null }> {
  try {
    return {
      approval: await approvalFor(artifact, overrides, cryptoProvider),
      error: null,
    };
  } catch {
    return { approval: null, error: APPROVAL_HASH_ERROR };
  }
}

export function RapidPriceLiftEvaluation({
  evaluation,
  sourceTrace,
  scenario,
  onEvidenceOpen,
}: {
  evaluation: RapidPriceLiftResult;
  sourceTrace: SourceTrace;
  scenario: ReplayScenario;
  onEvidenceOpen?: () => void;
}) {
  return (
    <section className="result-summary" aria-label="Pattern hypothesis result">
      <div className="evaluation-heading">
        <strong data-result={evaluation.result}>{evaluation.result}</strong>
        <code>
          {evaluation.ruleId}@{evaluation.ruleVersion}
        </code>
      </div>
      <div className="evaluation-block">
        {evaluation.result === "INCONCLUSIVE" ? (
          <>
            <p>Reason: {evaluation.reason}</p>
            <p>No evaluated finding evidence is available.</p>
          </>
        ) : (
          <div className="gate-list">
            {evaluation.findings.map((finding) => (
              <div
                className="gate-row"
                key={finding.gate}
                id={`gate-${finding.gate}`}
              >
                <strong>{finding.gate}</strong>
                <span>
                  {finding.observedValue} / threshold {finding.threshold}
                </span>
                <b data-passed={finding.passed}>
                  {finding.passed ? "PASS" : "FAIL"}
                </b>
                <p className="gate-description">
                  {gateDescriptions[finding.gate]}
                </p>
                <small>{finding.referencedEventIds.join(" · ")}</small>
                <details
                  className="source-evidence"
                  onToggle={(event) => {
                    if (event.currentTarget.open) onEvidenceOpen?.();
                  }}
                >
                  <summary>Inspect source evidence for {finding.gate}</summary>
                  {sourceTrace.entries
                    .filter(({ event }) =>
                      finding.referencedEventIds.includes(event.eventId),
                    )
                    .map(({ event, sourceRow }) => (
                      <article
                        key={event.eventId}
                        aria-label={`Source evidence for ${event.eventId}`}
                      >
                        <h3>Canonical event</h3>
                        <dl>
                          {Object.entries(event).map(([field, value]) => (
                            <div key={field}>
                              <dt>{field}</dt>
                              <dd>
                                <code>{value}</code>
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <h3>Committed source row</h3>
                        <dl>
                          <div>
                            <dt>Artifact</dt>
                            <dd>{scenario}</dd>
                          </div>
                          <div>
                            <dt>sourceArtifactHash</dt>
                            <dd>
                              <code>
                                {sourceRow.coordinate.sourceArtifactHash}
                              </code>
                            </dd>
                          </div>
                          <div>
                            <dt>Source row number</dt>
                            <dd>{sourceRow.coordinate.rowNumber}</dd>
                          </div>
                        </dl>
                        <h3>Raw column values</h3>
                        <dl className="source-values">
                          {Object.entries(sourceRow.values).map(
                            ([column, value]) => (
                              <div key={column}>
                                <dt>{column}</dt>
                                <dd>
                                  <code>{value}</code>
                                </dd>
                              </div>
                            ),
                          )}
                        </dl>
                      </article>
                    ))}
                </details>
              </div>
            ))}
          </div>
        )}
        {evaluation.sensitivity ? (
          <div className="sensitivity-block">
            <strong>Mechanical sensitivity comparison</strong>
            <a href="#gate-REMOVAL_SENSITIVITY">
              Inspect removal sensitivity evidence
            </a>
            <span>
              Price change: {evaluation.sensitivity.priceChangeBps} bps
            </span>
            <span>
              Without approved actor group:{" "}
              {evaluation.sensitivity.priceChangeBpsWithoutApprovedActors} bps
            </span>
            <span>
              Metric difference: {evaluation.sensitivity.removalSensitivityBps}{" "}
              bps
            </span>
          </div>
        ) : null}
        <small>
          Non-comparable events: {evaluation.nonComparableEventCount}
        </small>
      </div>
    </section>
  );
}

export function WorkflowStateBadge({ state }: { state: WorkflowState }) {
  return (
    <div className="workflow-state" data-state={state}>
      <strong>Workflow state</strong>
      <code>{state}</code>
    </div>
  );
}

const options: Array<{ value: Mutation; label: string; detail: string }> = [
  { value: "baseline", label: "Baseline", detail: "Original fixture order" },
  {
    value: "shuffle",
    label: "Shuffle source rows",
    detail:
      "Change submitted order before mapping; coordinates and values stay fixed",
  },
  {
    value: "duplicate",
    label: "Duplicate a derived event",
    detail: "Repeat one event after mapping; source rows stay fixed",
  },
];

export function CaseReplay({
  proposals,
  providerMode,
  scenarios,
  guided = false,
  mappingExample = false,
  onMappingApprovalChange,
  onGuideComplete,
}: CaseReplayProps) {
  const requestGeneration = useRef(0);
  const focusPending = useRef(false);
  const previousGuided = useRef(guided);
  const lastSubmittedRows = useRef<ReplayRequest["rows"] | null>(null);
  const [submittedOrder, setSubmittedOrder] = useState<string[] | null>(null);
  const [chapter, setChapter] = useState(0);
  const [exampleApproved, setExampleApproved] = useState(false);
  const [evidenceOpened, setEvidenceOpened] = useState(false);
  const [previousHash, setPreviousHash] = useState<string | null>(null);
  const guidedScenario =
    scenarios.find(({ value }) => value === workedCase)?.value ??
    scenarios[0]!.value;
  const [scenario, setScenario] = useState<ReplayScenario>(guidedScenario);
  const [mutation, setMutation] = useState<Mutation>("baseline");
  const [result, setResult] = useState<ReplayResultResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(
    null,
  );
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [caseApproval, setCaseApproval] = useState<ApprovalRecord | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const selectedScenario = scenarios.find(({ value }) => value === scenario)!;
  const proposal = proposals[selectedScenario.sourceArtifactHash]!;
  const unresolvedReview = hasUnresolvedMappingReview(proposal, reviewReasons);
  const exampleScenario = scenarios.find(
    ({ value }) => value === reviewExample,
  );
  const completeResult =
    result?.workflowState === "REPLAYED" &&
    "evaluation" in result &&
    "sourceTrace" in result;
  const repeatMatches =
    completeResult &&
    previousHash !== null &&
    previousHash === result.replay.canonicalResultHash;
  const canContinue = [
    true,
    approval !== null && exampleApproved,
    approval !== null && caseApproval !== null,
    completeResult,
    completeResult && evidenceOpened,
    repeatMatches,
    true,
  ][chapter];
  const blockedReason = [
    "",
    "Approve the separate mapping review example and this case's mapping to continue.",
    "Approve the mapping, then this exact case manifest.",
    "Run the approved case and wait for its evaluation and source trace.",
    "Open a finding's source evidence to continue.",
    previousHash && completeResult
      ? "The returned hashes differ. Retry the same approved case or inspect the results."
      : "Repeat the same approved case to compare returned hashes.",
    "",
  ][chapter];
  const show = (step: number) => !guided || chapter === step;

  useEffect(() => {
    if (guided && !previousGuided.current) {
      requestGeneration.current += 1;
      setChapter(0);
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
    }
    previousGuided.current = guided;
  }, [guided, guidedScenario]);

  function goToChapter(next: number) {
    focusPending.current = true;
    setChapter(next);
  }

  function focusChapterTitle(node: HTMLHeadingElement | null) {
    if (node && focusPending.current) {
      node.focus();
      focusPending.current = false;
    }
  }

  function invalidateResult() {
    requestGeneration.current += 1;
    setResult(null);
    setError(null);
    setWorkflowState(null);
    setRunning(false);
    setEvidenceOpened(false);
    setPreviousHash(null);
    setSubmittedOrder(null);
    return requestGeneration.current;
  }

  async function approveMapping() {
    if (unresolvedReview) return;
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
    setError(attempt.error);
  }

  async function approveCase() {
    if (approval === null || selectedScenario.manifest === undefined) return;
    const generation = invalidateResult();
    setCaseApproval(null);
    const attempt = await attemptApproval(selectedScenario.manifest);
    if (generation !== requestGeneration.current) return;
    setCaseApproval(attempt.approval);
    setError(attempt.error);
  }

  async function runReplay(repeat = false) {
    if (
      running ||
      !approval ||
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
        throw new Error(review.issues.map(({ message }) => message).join(" "));
      }
      const replayResult = (await response.json()) as ReplayResultResponse;
      if (generation !== requestGeneration.current) return;
      setWorkflowState(replayResult.workflowState);
      setResult(replayResult);
    } catch (cause) {
      if (generation !== requestGeneration.current) return;
      setError(cause instanceof Error ? cause.message : "Replay failed");
    } finally {
      if (generation === requestGeneration.current) setRunning(false);
    }
  }

  return (
    <section
      className={guided || mappingExample ? "replay-journey" : "replay-grid"}
    >
      {!mappingExample && (
        <header className="journey-header panel">
          <div className="journey-links">
            <span className="panel-label">
              {guided ? "Worked case · guided" : "Working mode"} · synthetic
              data · fixture provider
            </span>
            <Link href="/architecture">How it is built</Link>
          </div>
          {guided ? (
            <>
              <ol
                className="journey-progress"
                aria-label="Case walkthrough progress"
              >
                {chapters.map((title, index) => (
                  <li
                    key={title}
                    aria-current={chapter === index ? "step" : undefined}
                  >
                    {index + 1}. {title}
                  </li>
                ))}
              </ol>
              <h2 ref={focusChapterTitle} tabIndex={-1}>
                Step {chapter + 1} · {chapters[chapter]}
              </h2>
              <p>
                {
                  [
                    "Start with the committed supported case. No approval has been supplied. Read its columns and original values.",
                    "A deterministic fixture supplies the proposal shown below. No live model call occurred. First review a separate example that stops on an unmapped field, then approve the worked case's own mapping.",
                    "Review and approve the exact scope and threshold values proposed in this committed, authored case. Versioned code defines the allowed parameter schema, formulas and comparisons. Live case proposal is planned.",
                    "The server validates the exact approvals and source rows, then versioned code decides. Each request has its own workflow state.",
                    "This result describes support for one versioned pattern hypothesis under the approved scope. Inspect all five gates, then open a finding to trace it to the original rows.",
                    "Execute the same approved input again. Comparing two returned hashes checks same-input repeatability only.",
                    "Continue with this case, its approvals and result still loaded. A refresh starts unapproved.",
                  ][chapter]
                }
              </p>
            </>
          ) : (
            <>
              <h2 ref={focusChapterTitle} tabIndex={-1}>
                Case Replay controls
              </h2>
              <p>
                Select a committed source, review its mapping and approve its
                case before replay. Advanced controls change submitted source
                order or duplicate one derived event after mapping.
              </p>
            </>
          )}
        </header>
      )}
      <div
        className="replay-control panel"
        hidden={guided && chapter >= 4 && !error}
      >
        <div hidden={!show(0) || mappingExample}>
          <span className="panel-label">Committed source</span>
          <label className="scenario-select">
            <span>Committed source artifact</span>
            <select
              disabled={guided}
              onChange={(event) => {
                invalidateResult();
                lastSubmittedRows.current = null;
                const reset = resetReplayForScenarioChange(
                  event.target.value as ReplayScenario,
                );
                setScenario(reset.scenario);
                setApproval(reset.approval);
                setCaseApproval(reset.caseApproval);
                setResult(reset.result);
                setError(reset.error);
                setWorkflowState(null);
                setReviewReasons({});
              }}
              value={scenario}
            >
              {scenarios.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div hidden={!show(0) && !mappingExample}>
          <SourceRows scenario={selectedScenario} />
        </div>
        {!guided && !mappingExample && (
          <details className="advanced-controls">
            <summary>Advanced replay variations</summary>
            <p>
              Shuffle changes the submitted source-row order before mapping.
              Duplicate repeats one derived event after mapping. Original
              coordinates and values stay fixed in both cases.
            </p>
            <div className="option-list">
              {options.map((option) => (
                <label
                  className={
                    mutation === option.value ? "option selected" : "option"
                  }
                  key={option.value}
                >
                  <input
                    checked={mutation === option.value}
                    name="mutation"
                    onChange={() => {
                      invalidateResult();
                      setMutation(option.value);
                    }}
                    type="radio"
                    value={option.value}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                </label>
              ))}
            </div>
          </details>
        )}
        {submittedOrder && (
          <section aria-label="Submitted source row order">
            <h3>Submitted source row order</h3>
            <p>
              Request order for the current or last run, before canonical event
              ordering.
            </p>
            <p>
              <code>{submittedOrder.join(" → ")}</code>
            </p>
          </section>
        )}
        <div hidden={!show(1)}>
          {guided && exampleScenario && (
            <details className="mapping-example" open>
              <summary>Separate mapping review example · Dialect B</summary>
              <p>
                This is a different source with no rule manifest. Its approval
                cannot authorize the worked case. A reason retains the unmapped
                field without inventing a transform. Clearing it revokes this
                example&apos;s approval.
              </p>
              <CaseReplay
                proposals={proposals}
                providerMode={providerMode}
                scenarios={[exampleScenario]}
                mappingExample
                onMappingApprovalChange={setExampleApproved}
              />
            </details>
          )}
          <div className="mapping-preview">
            <span className="panel-label">
              Executed mapping proposal · {providerMode} ·{" "}
              {selectedScenario.value}
            </span>
            <p>
              Proposed targets and allowlisted transforms, with confidence,
              evidence and review status. You approve this exact proposal.
            </p>
            {proposal.fields.map((field, index) => (
              <div className="mapping-row" key={field.sourceColumn}>
                <code>{field.sourceColumn}</code>
                <span>→</span>
                <code>{field.targetField ?? "unmapped"}</code>
                <span>
                  Transform: <code>{field.transform ?? "none"}</code>
                </span>
                <span>
                  Confidence: {field.confidence.toFixed(2)} (fixture score, not
                  a calibrated probability)
                </span>
                <span>Evidence: {field.evidence}</span>
                <b data-status={field.status}>{field.status}</b>
                {requiresMappingOverride(field) ? (
                  <label>
                    <span>Reviewer reason for {field.sourceColumn}</span>
                    <input
                      aria-label={`Reviewer reason for ${field.sourceColumn}`}
                      onChange={(event) => {
                        invalidateResult();
                        setCaseApproval(null);
                        setReviewReasons((current) => ({
                          ...current,
                          [`fields.${index}`]: event.target.value,
                        }));
                        setApproval(null);
                        onMappingApprovalChange?.(false);
                      }}
                      required
                      type="text"
                      value={reviewReasons[`fields.${index}`] ?? ""}
                    />
                  </label>
                ) : null}
              </div>
            ))}
            {unresolvedReview ? (
              <div className="review-message" data-status="REVIEW_REQUIRED">
                <strong>REVIEW_REQUIRED</strong>
                <span>
                  Replay is blocked until every flagged field has a reviewer
                  reason.
                </span>
              </div>
            ) : null}
          </div>
          <button
            className="button"
            disabled={unresolvedReview}
            onClick={approveMapping}
            type="button"
          >
            {approval ? "Mapping approved locally" : "Approve executed mapping"}
          </button>
          {approval && <ApprovalReceipt approval={approval} />}
        </div>
        <div hidden={!show(2) || mappingExample}>
          {selectedScenario.manifest ? (
            <div className="case-preview">
              <span className="panel-label">03 · Case manifest proposal</span>
              <dl>
                <div>
                  <dt>Instrument</dt>
                  <dd>{selectedScenario.manifest.hypothesis.instrumentId}</dd>
                </div>
                <div>
                  <dt>Proposed actor group</dt>
                  <dd>
                    {selectedScenario.manifest.hypothesis.actorIds.join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>Window</dt>
                  <dd>
                    {selectedScenario.manifest.hypothesis.startTime} —{" "}
                    {selectedScenario.manifest.hypothesis.endTime}
                  </dd>
                </div>
              </dl>
              <p>
                Pattern:{" "}
                <code>{selectedScenario.manifest.hypothesis.pattern}</code>
              </p>
              <p>Authored case proposal. Live case proposal is planned.</p>
              {selectedScenario.manifest.rules.map((rule) => (
                <div key={rule.ruleId} className="case-rules">
                  <h3>
                    <code>
                      {rule.ruleId}@{rule.ruleVersion}
                    </code>
                  </h3>
                  <p>
                    {caseApproval
                      ? "Threshold values approved with this case."
                      : "Threshold values proposed in this authored case."}{" "}
                    Versioned code defines the allowed parameter schema,
                    formulas and comparisons. All values remain exact strings;
                    shares and price changes use basis points (100 bps = 1%).
                  </p>
                  <dl>
                    {Object.entries(rule.parameters).map(([name, value]) => (
                      <div key={name}>
                        <dt>{name}</dt>
                        <dd>
                          <code>{value}</code>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
              <details>
                <summary>Inspect the exact case proposal</summary>
                <pre
                  className="artifact-json"
                  aria-label="Exact case manifest proposal"
                >
                  {JSON.stringify(selectedScenario.manifest, null, 2)}
                </pre>
              </details>
              {!approval && (
                <p>Approve the mapping before approving the case.</p>
              )}
              <button
                className="button"
                disabled={!approval}
                onClick={approveCase}
                type="button"
              >
                {caseApproval
                  ? "Case approved locally"
                  : "Approve case manifest"}
              </button>
              {caseApproval && <ApprovalReceipt approval={caseApproval} />}
            </div>
          ) : null}
        </div>
        <div hidden={!show(3) || mappingExample}>
          <button
            className="button primary run-button"
            disabled={
              running ||
              approval === null ||
              (selectedScenario.manifest !== undefined && caseApproval === null)
            }
            onClick={() => runReplay()}
            type="button"
          >
            {running ? "Replaying…" : "Run deterministic replay"}
          </button>
          {guided && completeResult && (
            <WorkflowStateBadge state={result.workflowState} />
          )}
        </div>
        {error ? (
          <p className="error-message" role="alert">
            <strong>REPLAY_REFUSED</strong> {error}
          </p>
        ) : null}
        {error && workflowState ? (
          <WorkflowStateBadge state={workflowState} />
        ) : null}
      </div>

      <div
        hidden={
          mappingExample ||
          (guided && chapter !== 4 && chapter !== 5 && chapter !== 6)
        }
        className="panel result-panel"
        aria-live="polite"
      >
        <span className="panel-label">04 · Canonical result</span>
        {result ? (
          <>
            <WorkflowStateBadge state={result.workflowState} />
            <p>
              Engine version: <code>{result.replay.engineVersion}</code>
            </p>
            {"evaluation" in result && (
              <p>
                Pattern outcome: <strong>{result.evaluation.result}</strong>{" "}
                under the approved case and{" "}
                <code>
                  {result.evaluation.ruleId}@{result.evaluation.ruleVersion}
                </code>
                .
              </p>
            )}
            <div className="metric-grid">
              <div>
                <span>Input</span>
                <strong>{result.replay.inputEventCount}</strong>
              </div>
              <div>
                <span>Canonical</span>
                <strong>{result.replay.canonicalEventCount}</strong>
              </div>
              <div>
                <span>Duplicates</span>
                <strong>{result.replay.duplicateCount}</strong>
              </div>
            </div>
            <div className="trace-block">
              <span>Canonical order</span>
              <div className="event-chain">
                {result.replay.orderedEventIds.map((eventId) => (
                  <code key={eventId}>{eventId}</code>
                ))}
              </div>
            </div>
            <div className="hash-block">
              <span>Canonical result hash</span>
              <code>{result.replay.canonicalResultHash}</code>
            </div>
            {"evaluation" in result ? (
              <RapidPriceLiftEvaluation
                evaluation={result.evaluation}
                sourceTrace={result.sourceTrace}
                scenario={result.scenario}
                onEvidenceOpen={() => setEvidenceOpened(true)}
              />
            ) : null}
            <p>
              The canonical hash covers the engine version, semantic event
              projection and evaluation when present. It does not protect
              complete approvals, every mapping or manifest field, or the source
              trace. Independent Evidence Bundle assembly and verification are
              planned.
            </p>
            <p>
              Pattern support is not a legal or causal conclusion. Actor removal
              is a mechanical sensitivity comparison.
            </p>
            <div className="boundary-note">
              <strong>Fixture mode</strong>
              <p>{result.boundary}</p>
            </div>
          </>
        ) : (
          <div className="empty-result">
            <span className="empty-mark" aria-hidden="true">
              WT
            </span>
            <h2>Ready to replay</h2>
            <p>
              Review the source and explicitly approve its mapping and case. A
              foundation-only replay has no case evaluation.
            </p>
          </div>
        )}
      </div>
      {!mappingExample && (!guided || chapter === 5) && (
        <section className="panel repeat-panel">
          <h3>Same-input repeatability</h3>
          <p>
            Repeat the same approved case and compare the two server-returned
            hashes as strings. This does not establish authenticity, real-market
            accuracy or general mutation tolerance.
          </p>
          <button
            className="button"
            disabled={
              running ||
              !approval ||
              !caseApproval ||
              (!completeResult && !previousHash)
            }
            onClick={() => runReplay(true)}
            type="button"
          >
            {running ? "Replaying…" : "Repeat the same approved case"}
          </button>
          {previousHash && (
            <div className="hash-block">
              <span>Previous returned hash</span>
              <code>{previousHash}</code>
              {completeResult && (
                <>
                  <span>Repeated returned hash</span>
                  <code>{result.replay.canonicalResultHash}</code>
                  <strong>
                    {previousHash === result.replay.canonicalResultHash
                      ? "MATCH · same-input repeatability"
                      : "MISMATCH · retry or inspect the returned results"}
                  </strong>
                </>
              )}
            </div>
          )}
        </section>
      )}
      {!mappingExample && (
        <section className="panel" hidden={guided && chapter !== 6}>
          <h3>What runs today</h3>
          <p>
            Synthetic committed sources, a deterministic fixture mapping
            provider, explicit human approvals, one versioned rule and
            server-resolved finding evidence.
          </p>
          <p>
            A real deployment would additionally need governed data ingestion,
            identity and access controls, durable approval records, validated
            live provider adapters and domain evaluation. Live mapping and case
            proposals, independent bundle export and aggregate evaluation are
            planned.
          </p>
          {guided && (
            <button
              className="button primary"
              type="button"
              disabled={!repeatMatches}
              onClick={() => {
                if (!repeatMatches) return;
                focusPending.current = true;
                onGuideComplete?.();
              }}
            >
              Continue in Case Replay
            </button>
          )}
        </section>
      )}
      {guided && (
        <footer className="journey-footer panel">
          <button
            className="button"
            disabled={chapter === 0}
            onClick={() => goToChapter(chapter - 1)}
            type="button"
          >
            Back
          </button>
          {chapter < chapters.length - 1 && (
            <button
              className="button primary"
              disabled={!canContinue}
              onClick={() => {
                if (canContinue) goToChapter(chapter + 1);
              }}
              type="button"
            >
              Continue
            </button>
          )}
          {!canContinue && <p role="status">{blockedReason}</p>}
        </footer>
      )}
    </section>
  );
}
