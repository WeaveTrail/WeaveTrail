"use client";

import React, { useEffect, useRef, useState } from "react";

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
import type { SourceProvenance } from "@weavetrail/contracts";
import {
  canonicalJson,
  type CanonicalJsonInput,
} from "@weavetrail/replay-engine/canonical-json";
import { shuffleSourceRows } from "./shuffle-source-rows";
import {
  Bps,
  EVENT_FIELD_NOTES,
  GATE_READINGS,
  GateReading,
  HashValue,
  Instant,
  readableCompactDate,
  REPORTED_VALUE_NOTE,
  type GateName,
} from "./machine-values";

type Mutation = "baseline" | "shuffle" | "duplicate";

export type ReplayScenarioOption = {
  value: ReplayScenario;
  label: string;
  sourceArtifactHash: string;
  rows: ReplayRequest["rows"];
  manifest?: CaseManifestProposal;
  provenance?: SourceProvenance;
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
// Each guided step opens with what it demonstrates, what the visitor must do
// to advance it, and which authority acted in it: a model proposed, a person
// approved, or versioned code decided. `Committed input` names the steps where
// none of the three has acted yet.
type GuideStep = {
  title: string;
  purpose: string;
  action: string;
  actor:
    | "Committed input"
    | "A model proposed it"
    | "A person approved it"
    | "Versioned code decided it";
  actorDetail: string;
  refusal?: string;
};

export const guideSteps: readonly GuideStep[] = [
  {
    title: "Read the source",
    purpose:
      "Start with the committed supported case. No approval has been supplied. Read its columns and original values. These column names are the source's own dialect and carry no agreed meaning yet; establishing what they denote is the next step.",
    action:
      "Read the committed source rows, noting that nothing yet states what their columns mean, then continue.",
    actor: "Committed input",
    actorDetail:
      "Nothing has been proposed, approved or decided at this point.",
  },
  {
    title: "Review the mapping",
    purpose:
      "A deterministic fixture supplies the proposal shown below. No live model call occurred. First review a separate example that stops on an unmapped field, then approve the worked case's own mapping.",
    action:
      "Give the example's flagged field a reviewer reason and approve it, then approve this case's own mapping proposal.",
    actor: "A model proposed it",
    actorDetail:
      "The fixture mapping provider proposes targets, transforms and evidence. It cannot approve them.",
    refusal:
      "A refusal stays on this path: the review example holds at REVIEW_REQUIRED until every flagged field has a nonblank reviewer reason.",
  },
  {
    title: "Approve the case",
    purpose:
      "Review and approve the exact scope and threshold values proposed in this committed, authored case. Versioned code defines the allowed parameter schema, formulas and comparisons. Live case proposal is planned.",
    action:
      "Read the instrument, window and threshold values, then approve this exact case manifest.",
    actor: "A person approved it",
    actorDetail:
      "You approve the scope. An approval binds to one exact artifact hash.",
  },
  {
    title: "Run the replay",
    purpose:
      "The server validates the exact approvals and source rows, then versioned code decides. Each request has its own workflow state.",
    action:
      "Run the approved case and wait for its returned evaluation and source trace.",
    actor: "Versioned code decided it",
    actorDetail:
      "The server revalidates both approvals before the versioned rule runs.",
  },
  {
    title: "Inspect the finding",
    purpose:
      "This result describes support for one versioned pattern hypothesis under the approved scope. Inspect all five gates, then open a finding to trace it to the original rows.",
    action:
      "Open the source evidence under a gate to reach its canonical events and committed source rows.",
    actor: "Versioned code decided it",
    actorDetail:
      "Gates, observed values and the source trace are server-derived, not model output.",
  },
  {
    title: "Repeat the case",
    purpose:
      "Execute the same approved input again. Comparing two returned hashes checks same-input repeatability only.",
    action:
      "Repeat the same approved case and compare the two server-returned hashes.",
    actor: "Versioned code decided it",
    actorDetail:
      "Both hashes are returned by the server. The browser compares them as strings.",
  },
  {
    title: "Take the controls",
    purpose:
      "Continue with this case, its approvals and result still loaded. A refresh starts unapproved.",
    action:
      "Carry this case into working mode, where you choose the source and the variations yourself.",
    actor: "A person approved it",
    actorDetail:
      "The approvals you made stay loaded. No approval is persisted beyond this browser session.",
  },
];

export function ApprovalReceipt({ approval }: { approval: ApprovalRecord }) {
  return (
    <dl className="approval-receipt">
      <div>
        <dt>Approved artifact hash</dt>
        <dd>
          <HashValue
            scope="approvedArtifact"
            value={approval.approvedArtifactHash}
          />
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
        <dd>
          <Instant value={approval.approvedAt} />
        </dd>
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
      <HashValue scope="sourceArtifact" value={scenario.sourceArtifactHash} />
      <p>
        These {scenario.provenance?.kind ?? "synthetic"} source records are
        fixed. Values below are the original strings, before mapping, shown in
        committed order.
      </p>
      {scenario.provenance && (
        <SourceProvenanceDetails provenance={scenario.provenance} />
      )}
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

export function SourceProvenanceDetails({
  provenance,
}: {
  provenance: SourceProvenance;
}) {
  if (provenance.kind === "synthetic") return <p>{provenance.attribution}</p>;
  return (
    <section aria-label="Published source provenance">
      <h3>{provenance.title}</h3>
      <p>
        {provenance.titleEnglish} · {provenance.provider}
      </p>
      <dl>
        <div>
          <dt>Trading date (basDt)</dt>
          <dd>
            {readableCompactDate(provenance.basDt)}{" "}
            <code>{provenance.basDt}</code>
          </dd>
        </div>
        <div>
          <dt>Retrieved</dt>
          <dd>
            <Instant value={provenance.retrievedAt} />
          </dd>
        </div>
        <div>
          <dt>Venue scope</dt>
          <dd>
            {provenance.venue.value} · {provenance.venue.basis}
          </dd>
        </div>
        <div>
          <dt>Recorded usage permission</dt>
          <dd>{provenance.licence.label}</dd>
        </div>
        <div>
          <dt>Permission verified</dt>
          <dd>
            <Instant value={provenance.licence.checkedAt} />
          </dd>
        </div>
        <div>
          <dt>Attribution requirements</dt>
          <dd>{provenance.licence.attributionRequirements}</dd>
        </div>
      </dl>
      <p>{provenance.licence.attribution}</p>
      <p>
        <a href={provenance.originUrl}>Official source distribution</a> ·{" "}
        <a href={provenance.licence.termsUrl}>Source terms</a>
      </p>
    </section>
  );
}

export function DailyQuoteSemantics() {
  return (
    <section aria-label="Daily quote interpretation">
      <h3>
        Artifact kind: <code>DAILY_QUOTE</code>
      </h3>
      <p>
        The trading date is interpreted as a day-start anchor at 00:00:00+09:00,
        not an observed execution time or a publisher-returned offset.
      </p>
      <p>
        Price represents the daily closing price. Quantity represents daily
        aggregate volume. Each interpretation requires a nonblank reviewer
        reason before mapping approval.
      </p>
    </section>
  );
}

export function DailyQuoteCaseLimitation({
  normalized,
}: {
  normalized: boolean;
}) {
  return (
    <section aria-label="Daily quote case limitation">
      <h3>Case approval unavailable</h3>
      <p>
        {normalized
          ? "Published daily quotes normalized. "
          : "Mapping approval enables source normalization. "}
        This source supplies no participant identities or execution-side data.
      </p>
      <p>
        The normalized actor profile is empty. Daily quotes supply a
        trading-date anchor and daily aggregates, with no individual execution
        time or detail.
      </p>
      <p>
        A future case requires admissible genuine executions with execution
        time, side, actor identity, price and quantity, followed by separately
        reviewed case approval. Adding an actor alone cannot turn daily quotes
        into trades.
      </p>
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
  advancesStep = false,
}: {
  evaluation: RapidPriceLiftResult;
  sourceTrace: SourceTrace;
  scenario: ReplayScenario;
  onEvidenceOpen?: () => void;
  advancesStep?: boolean;
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
            <p className="machine-note">{REPORTED_VALUE_NOTE}</p>
            {evaluation.findings.map((finding) => (
              <div
                className="gate-row"
                key={finding.gate}
                id={`gate-${finding.gate}`}
              >
                <strong>{finding.gate}</strong>
                <GateReading
                  gate={finding.gate as GateName}
                  observedValue={finding.observedValue}
                  threshold={finding.threshold}
                />
                <b data-passed={finding.passed}>
                  {finding.passed ? "PASS" : "FAIL"}
                </b>
                <p className="gate-description">
                  {GATE_READINGS[finding.gate as GateName].tests}
                </p>
                <small>{finding.referencedEventIds.join(" · ")}</small>
                <details
                  className={
                    advancesStep
                      ? "source-evidence step-action"
                      : "source-evidence"
                  }
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
                                {value !== undefined &&
                                field === "rawRowHash" ? (
                                  <HashValue scope="rawRow" value={value} />
                                ) : value !== undefined &&
                                  (field === "eventTime" ||
                                    field === "receivedAt") ? (
                                  <Instant value={value} />
                                ) : (
                                  <code>{value}</code>
                                )}
                                {EVENT_FIELD_NOTES[field] ? (
                                  <small className="machine-note">
                                    {EVENT_FIELD_NOTES[field]}
                                  </small>
                                ) : null}
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
                              <HashValue
                                scope="sourceArtifact"
                                value={sourceRow.coordinate.sourceArtifactHash}
                              />
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
            <small className="machine-note">{REPORTED_VALUE_NOTE}</small>
            <a href="#gate-REMOVAL_SENSITIVITY">
              Inspect removal sensitivity evidence
            </a>
            <span>
              Price change:{" "}
              <Bps value={evaluation.sensitivity.priceChangeBps} />
            </span>
            <span>
              Without approved actor group:{" "}
              <Bps
                value={
                  evaluation.sensitivity.priceChangeBpsWithoutApprovedActors
                }
              />
            </span>
            <span>
              Metric difference:{" "}
              <Bps value={evaluation.sensitivity.removalSensitivityBps} />
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
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
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
  const stepSatisfied = [
    true,
    approval !== null && exampleApproved,
    approval !== null && caseApproval !== null,
    completeResult,
    completeResult && evidenceOpened,
    repeatMatches,
    true,
  ];
  const stepBlockers = [
    "",
    "Approve the separate mapping review example and this case's mapping to continue.",
    "Approve the mapping, then this exact case manifest.",
    "Run the approved case and wait for its evaluation and source trace.",
    "Open a finding's source evidence to continue.",
    previousHash && completeResult
      ? "The returned hashes differ. Retry the same approved case or inspect the results."
      : "Repeat the same approved case to compare returned hashes.",
    "",
  ];
  const canContinue = stepSatisfied[chapter];
  const blockedReason = stepBlockers[chapter];
  // Read-ahead is allowed, so an earlier step can still be unmet while the
  // visitor reads a later one. Completion means the visitor satisfied the step
  // themselves and it still holds.
  const unmetEarlierStep = stepSatisfied
    .slice(0, chapter)
    .findIndex((satisfied) => !satisfied);
  const stepCompleted = (step: number) =>
    completedSteps.includes(step) && stepSatisfied[step] === true;
  const show = (step: number) => !guided || chapter === step;

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
    }
    previousGuided.current = guided;
  }, [guided, guidedScenario]);

  function goToChapter(next: number) {
    focusPending.current = true;
    setChapter(next);
  }

  function completeChapter(step: number) {
    setCompletedSteps((current) =>
      current.includes(step) ? current : [...current, step],
    );
  }

  function advanceChapter() {
    if (!canContinue) return;
    completeChapter(chapter);
    goToChapter(chapter + 1);
  }

  function focusChapterTitle(node: HTMLHeadingElement | null) {
    if (node && focusPending.current) {
      node.focus();
      focusPending.current = false;
    }
  }

  const guideStep = guideSteps[chapter]!;
  const panelLabel = (order: string, label: string) =>
    guided ? label : `${order} · ${label}`;

  // Rendered inline rather than as a nested component so the same controls open
  // and close the step without duplicating their disabled and blocked state.
  function stepControls(place: "rail" | "end") {
    return (
      <nav
        aria-label={
          place === "rail"
            ? "Step navigation in the step rail"
            : "Step navigation at the end of the step"
        }
        className="journey-controls"
      >
        <button
          className="button"
          disabled={chapter === 0}
          onClick={() => goToChapter(chapter - 1)}
          type="button"
        >
          Back
        </button>
        {chapter < guideSteps.length - 1 && (
          <button
            aria-describedby={canContinue ? undefined : "guide-requirement"}
            className="button primary"
            disabled={!canContinue}
            onClick={advanceChapter}
            type="button"
          >
            Continue
          </button>
        )}
      </nav>
    );
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
      className={
        guided
          ? "replay-journey guided-split"
          : mappingExample
            ? "replay-journey"
            : "replay-grid"
      }
    >
      {!mappingExample && (
        <header className="journey-header panel">
          {guided ? (
            <>
              <div className="rail-scroll">
                <ol
                  className="journey-progress"
                  aria-label="Case walkthrough progress"
                >
                  {guideSteps.map((step, index) => (
                    <li
                      key={step.title}
                      aria-current={chapter === index ? "step" : undefined}
                    >
                      <button
                        className="journey-step"
                        data-complete={stepCompleted(index)}
                        onClick={() => goToChapter(index)}
                        type="button"
                      >
                        <span>
                          {index + 1}. {step.title}
                        </span>
                        {stepCompleted(index) || chapter === index ? (
                          <small>
                            {stepCompleted(index)
                              ? "Completed"
                              : "Current step"}
                          </small>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ol>
                <h2 ref={focusChapterTitle} tabIndex={-1}>
                  Step {chapter + 1} · {guideStep.title}
                </h2>
                <dl className="step-intent">
                  <div>
                    <dt>What this shows</dt>
                    <dd>{guideStep.purpose}</dd>
                  </div>
                  <div>
                    <dt>What you do</dt>
                    <dd>{guideStep.action}</dd>
                  </div>
                  <div>
                    <dt>Who acted</dt>
                    <dd>
                      <strong>{guideStep.actor}</strong> {guideStep.actorDetail}
                    </dd>
                  </div>
                </dl>
                {guideStep.refusal ? (
                  <p className="step-refusal" data-status="REVIEW_REQUIRED">
                    {guideStep.refusal}
                  </p>
                ) : null}
              </div>
              <div className="rail-actions">
                <p
                  className="step-requirement"
                  data-met={canContinue && unmetEarlierStep === -1}
                  id="guide-requirement"
                  role="status"
                >
                  {canContinue
                    ? "Ready to continue."
                    : `To continue: ${blockedReason}`}
                  {unmetEarlierStep === -1
                    ? ""
                    : ` You are reading ahead: step ${
                        unmetEarlierStep + 1
                      }, ${guideSteps[unmetEarlierStep]!.title}, is not
                      completed.`.replace(/\s+/g, " ")}
                </p>
                {stepControls("rail")}
              </div>
            </>
          ) : (
            <>
              <h2 ref={focusChapterTitle} tabIndex={-1}>
                Case Replay controls
              </h2>
              <p>
                {selectedScenario.manifest
                  ? "Select a committed source, review its mapping and approve its case before replay."
                  : "Review the source and approve its exact mapping to normalize it. This source has no case manifest or case evaluation."}{" "}
                Advanced controls change submitted source order or duplicate one
                derived event after mapping.
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
          <span className="panel-label">
            {panelLabel("01", "Committed source")}
          </span>
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
              {scenarios.map(({ label, value, provenance }) => (
                <option key={value} value={value}>
                  {label} · {provenance?.kind ?? "synthetic"}
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
              {guided
                ? "Proposed mapping"
                : `02 · Executed mapping proposal · ${providerMode} · ${selectedScenario.value}`}
            </span>
            <p>
              Proposed targets and allowlisted transforms, with confidence,
              evidence and review status. You approve this exact proposal.
            </p>
            {proposal.mappingVersion === "1.5" && <DailyQuoteSemantics />}
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
            className={
              guided && chapter === 1 ? "button step-action" : "button"
            }
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
              <span className="panel-label">
                {panelLabel("03", "Case manifest proposal")}
              </span>
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
                    <Instant
                      value={selectedScenario.manifest.hypothesis.startTime}
                    />{" "}
                    —{" "}
                    <Instant
                      value={selectedScenario.manifest.hypothesis.endTime}
                    />
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
                <p className="machine-note">
                  The exact artifact this approval binds to. The{" "}
                  <code>canonicalDatasetHash</code> inside it belongs to the
                  artifact: it names the ordered canonical event projection the
                  replay must reproduce, and the replay boundary refuses a
                  request whose dataset does not match it. The source artifact
                  hash belongs to the separately approved mapping.
                </p>
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
                className={
                  guided && chapter === 2 ? "button step-action" : "button"
                }
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
          ) : proposal.mappingVersion === "1.5" ? (
            <DailyQuoteCaseLimitation
              normalized={result?.workflowState === "MAPPING_APPROVED"}
            />
          ) : null}
        </div>
        <div hidden={!show(3) || mappingExample}>
          <button
            className={
              guided && chapter === 3
                ? "button primary run-button step-action"
                : "button primary run-button"
            }
            disabled={
              running ||
              approval === null ||
              (selectedScenario.manifest !== undefined && caseApproval === null)
            }
            onClick={() => runReplay()}
            type="button"
          >
            {proposal.mappingVersion === "1.5"
              ? running
                ? "Normalizing…"
                : "Normalize source"
              : running
                ? "Replaying…"
                : "Run deterministic replay"}
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
        <span className="panel-label">
          {panelLabel("04", "Canonical result")}
        </span>
        {result ? (
          <>
            <WorkflowStateBadge state={result.workflowState} />
            {result.workflowState === "MAPPING_APPROVED" && (
              <p>
                Mapping and normalization only. No case has been approved or
                evaluated.
              </p>
            )}
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
              <small className="machine-note">
                {EVENT_FIELD_NOTES.eventId}
              </small>
              <div className="event-chain">
                {result.replay.orderedEventIds.map((eventId) => (
                  <code key={eventId}>{eventId}</code>
                ))}
              </div>
            </div>
            <div className="hash-block">
              <HashValue
                scope="canonicalResult"
                value={result.replay.canonicalResultHash}
              />
            </div>
            {"evaluation" in result ? (
              <RapidPriceLiftEvaluation
                advancesStep={guided && chapter === 4 && !evidenceOpened}
                evaluation={result.evaluation}
                sourceTrace={result.sourceTrace}
                scenario={result.scenario}
                onEvidenceOpen={() => setEvidenceOpened(true)}
              />
            ) : null}
            <p>
              Independent Evidence Bundle assembly and verification are planned.
              Each displayed hash states what it covers where it is shown.
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
            <h2>
              {selectedScenario.manifest
                ? "Ready to replay"
                : "Ready to normalize"}
            </h2>
            <p>
              {selectedScenario.manifest
                ? "Review the source and explicitly approve its mapping and case."
                : "Review the source and explicitly approve its mapping, including any required interpretation reasons. Normalization has no case evaluation."}
            </p>
          </div>
        )}
      </div>
      {!mappingExample &&
        selectedScenario.manifest &&
        (!guided || chapter === 5) && (
          <section className="panel repeat-panel">
            <h3>{panelLabel("05", "Same-input repeatability")}</h3>
            <p>
              Repeat the same approved case and compare the two server-returned
              hashes as strings. This does not establish authenticity,
              real-market accuracy or general mutation tolerance.
            </p>
            <button
              className={
                guided && chapter === 5 ? "button step-action" : "button"
              }
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
                <HashValue
                  label="Previous returned hash"
                  scope="canonicalResult"
                  value={previousHash}
                />
                {completeResult && (
                  <>
                    <HashValue
                      label="Repeated returned hash"
                      scope="canonicalResult"
                      value={result.replay.canonicalResultHash}
                    />
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
          <h3>{panelLabel("06", "What runs today")}</h3>
          <p>
            Synthetic committed sources and one licensed published daily-quote
            source, a deterministic fixture mapping provider, explicit human
            approvals, one versioned rule and server-resolved finding evidence.
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
              className={
                chapter === 6 ? "button primary step-action" : "button primary"
              }
              type="button"
              disabled={!repeatMatches}
              onClick={() => {
                if (!repeatMatches) return;
                completeChapter(chapter);
                focusPending.current = true;
                onGuideComplete?.();
              }}
            >
              Continue in working mode
            </button>
          )}
        </section>
      )}
      {guided && (
        <footer className="journey-footer panel">{stepControls("end")}</footer>
      )}
    </section>
  );
}
