"use client";

import React, { useState } from "react";

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
} from "@weavetrail/contracts";
import { MAPPING_CONFIDENCE_REVIEW_THRESHOLD } from "@weavetrail/contracts";
import {
  canonicalJson,
  type CanonicalJsonInput,
} from "@weavetrail/replay-engine/canonical-json";

import { Diagnostic, HashRef, ProvenanceChip, ResultBanner } from "../ui";

type Mutation = "baseline" | "shuffle" | "duplicate";

export type LabScenario = {
  value: ReplayScenario;
  label: string;
  sourceArtifactHash: string;
  rows: ReplayRequest["rows"];
  manifest?: CaseManifestProposal;
};

type LabProps = {
  providerMode: "fixture";
  proposals: Record<string, SchemaMappingProposal>;
  scenarios: LabScenario[];
};

export const APPROVAL_HASH_ERROR =
  "Approval hash could not be computed. Approval and replay remain blocked.";

type ApprovalHashCrypto = {
  subtle?: Pick<SubtleCrypto, "digest">;
};

function requiresMappingOverride(
  field: SchemaMappingProposal["fields"][number],
): boolean {
  return (
    field.status === "REVIEW_REQUIRED" ||
    field.confidence < MAPPING_CONFIDENCE_REVIEW_THRESHOLD
  );
}

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
}: {
  evaluation: RapidPriceLiftResult;
}) {
  return (
    <ResultBanner
      result={evaluation.result}
      rule={`${evaluation.ruleId}@${evaluation.ruleVersion}`}
    >
      <div className="evaluation-block">
        {evaluation.result === "INCONCLUSIVE" ? (
          <p>Reason: {evaluation.reason}</p>
        ) : (
          <div className="gate-list">
            {evaluation.findings.map((finding) => (
              <div className="gate-row" key={finding.gate}>
                <strong>{finding.gate}</strong>
                <span>
                  {finding.observedValue} / threshold {finding.threshold}
                </span>
                <b data-passed={finding.passed}>
                  {finding.passed ? "PASS" : "FAIL"}
                </b>
                <small>{finding.referencedEventIds.join(" · ")}</small>
              </div>
            ))}
          </div>
        )}
        {evaluation.sensitivity ? (
          <div className="sensitivity-block">
            <strong>Mechanical sensitivity comparison</strong>
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
    </ResultBanner>
  );
}

const options: Array<{ value: Mutation; label: string; detail: string }> = [
  { value: "baseline", label: "Baseline", detail: "Original fixture order" },
  {
    value: "shuffle",
    label: "Shuffle rows",
    detail: "Same events, different input order",
  },
  {
    value: "duplicate",
    label: "Insert duplicate",
    detail: "Repeat one source row exactly",
  },
];

export function Lab({ proposals, providerMode, scenarios }: LabProps) {
  const [scenario, setScenario] = useState<ReplayScenario>(scenarios[0]!.value);
  const [mutation, setMutation] = useState<Mutation>("baseline");
  const [result, setResult] = useState<ReplayResultResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalRecord | null>(null);
  const [caseApproval, setCaseApproval] = useState<ApprovalRecord | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const selectedScenario = scenarios.find(({ value }) => value === scenario)!;
  const proposal = proposals[selectedScenario.sourceArtifactHash]!;
  const unresolvedReview = hasUnresolvedMappingReview(proposal, reviewReasons);

  async function approveMapping() {
    if (unresolvedReview) return;
    setError(null);
    setApproval(null);
    setResult(null);
    const attempt = await attemptApproval(
      proposal,
      mappingOverrides(proposal, reviewReasons),
    );
    setApproval(attempt.approval);
    setError(attempt.error);
  }

  async function approveCase() {
    if (selectedScenario.manifest === undefined) return;
    setError(null);
    setCaseApproval(null);
    setResult(null);
    const attempt = await attemptApproval(selectedScenario.manifest);
    setCaseApproval(attempt.approval);
    setError(attempt.error);
  }

  async function runReplay() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenario,
          mutation,
          rows: selectedScenario.rows,
          mappingApproval: approval,
          ...(selectedScenario.manifest && caseApproval
            ? {
                caseManifest: {
                  ...selectedScenario.manifest,
                  approval: caseApproval,
                } satisfies CaseManifest,
              }
            : {}),
        }),
      });
      if (!response.ok) {
        const review = (await response.json()) as ReplayReviewResponse;
        throw new Error(review.issues.map(({ message }) => message).join(" "));
      }
      setResult((await response.json()) as ReplayResultResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Replay failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="lab-grid">
      <div className="lab-control panel">
        <span className="panel-label">01 · Input mutation</span>
        <label className="scenario-select">
          <span>Committed source artifact</span>
          <select
            onChange={(event) => {
              const reset = resetReplayForScenarioChange(
                event.target.value as ReplayScenario,
              );
              setScenario(reset.scenario);
              setApproval(reset.approval);
              setCaseApproval(reset.caseApproval);
              setResult(reset.result);
              setError(reset.error);
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
                onChange={() => setMutation(option.value)}
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
        <div className="mapping-preview">
          <span className="panel-label">
            02 · Executed mapping proposal · {providerMode}
          </span>
          <ProvenanceChip kind={approval ? "approved" : "proposed"} />
          {proposal.fields.map((field, index) => (
            <div className="mapping-row" key={field.sourceColumn}>
              <code>{field.sourceColumn}</code>
              <span>→</span>
              <code>{field.targetField ?? "unmapped"}</code>
              <code>{field.transform ?? "none"}</code>
              <span>{field.confidence.toFixed(2)}</span>
              <span>{field.evidence}</span>
              <b data-status={field.status}>{field.status}</b>
              {requiresMappingOverride(field) ? (
                <label>
                  <span>Reviewer reason for {field.sourceColumn}</span>
                  <input
                    aria-label={`Reviewer reason for ${field.sourceColumn}`}
                    onChange={(event) => {
                      setReviewReasons((current) => ({
                        ...current,
                        [`fields.${index}`]: event.target.value,
                      }));
                      setApproval(null);
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
            <Diagnostic code="MAPPING_OVERRIDE_REQUIRED" field="fields">
              Replay is blocked until every flagged field has a reviewer reason.
            </Diagnostic>
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
        {selectedScenario.manifest ? (
          <div className="case-preview">
            <span className="panel-label">03 · Case manifest proposal</span>
            <dl>
              <div>
                <dt>Instrument</dt>
                <dd>{selectedScenario.manifest.hypothesis.instrumentId}</dd>
              </div>
              <div>
                <dt>Approved actor group</dt>
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
            <button className="button" onClick={approveCase} type="button">
              {caseApproval ? "Case approved locally" : "Approve case manifest"}
            </button>
          </div>
        ) : null}
        <button
          className="button primary run-button"
          disabled={
            running ||
            approval === null ||
            (selectedScenario.manifest !== undefined && caseApproval === null)
          }
          onClick={runReplay}
          type="button"
        >
          {running ? "Replaying…" : "Run deterministic replay"}
        </button>
        {error ? <Diagnostic code="REPLAY_REFUSED">{error}</Diagnostic> : null}
      </div>

      <div className="panel result-panel" aria-live="polite">
        <span className="panel-label">04 · Canonical result</span>
        {result ? (
          <>
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
              <HashRef
                label="canonicalResultHash"
                value={result.replay.canonicalResultHash}
                full
              />
            </div>
            {result.evaluation ? (
              <RapidPriceLiftEvaluation evaluation={result.evaluation} />
            ) : null}
            <div className="boundary-note">
              <strong>Fixture mode</strong>
              <p>{result.boundary}</p>
            </div>
          </>
        ) : (
          <div className="empty-result">
            <span className="empty-mark">⌁</span>
            <h2>Ready to replay</h2>
            <p>
              Select a controlled mutation and run the fixture. Compare hashes
              across runs.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
