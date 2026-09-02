"use client";

import React, { useState } from "react";

import type {
  ReplayResultResponse,
  ReplayReviewResponse,
  ReplayScenario,
  ReplayRequest,
  ApprovalRecord,
  SchemaMappingProposal,
} from "@weavetrail/contracts";
import { MAPPING_CONFIDENCE_REVIEW_THRESHOLD } from "@weavetrail/contracts";

type Mutation = "baseline" | "shuffle" | "duplicate";

export type LabScenario = {
  value: ReplayScenario;
  label: string;
  sourceArtifactHash: string;
  rows: ReplayRequest["rows"];
};

type LabProps = {
  providerMode: "fixture";
  proposals: Record<string, SchemaMappingProposal>;
  scenarios: LabScenario[];
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
    result: null,
    error: null,
  } satisfies {
    scenario: ReplayScenario;
    approval: ApprovalRecord | null;
    result: ReplayResultResponse | null;
    error: string | null;
  };
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
  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const selectedScenario = scenarios.find(({ value }) => value === scenario)!;
  const proposal = proposals[selectedScenario.sourceArtifactHash]!;
  const unresolvedReview = hasUnresolvedMappingReview(proposal, reviewReasons);

  function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value !== null && typeof value === "object") {
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
        .join(",")}}`;
    }
    return JSON.stringify(value);
  }

  async function approveMapping() {
    if (unresolvedReview) return;
    const bytes = new TextEncoder().encode(canonicalJson(proposal));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const approvedArtifactHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    setApproval({
      approvedArtifactHash,
      reviewerRef: "reviewer:local-lab",
      decision: "APPROVED",
      overrides: mappingOverrides(proposal, reviewReasons),
      approvedAt: new Date().toISOString(),
    });
    setResult(null);
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
            <p className="error-message">
              Replay is blocked until every flagged field has a reviewer reason.
            </p>
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
        <button
          className="button primary run-button"
          disabled={running || approval === null}
          onClick={runReplay}
          type="button"
        >
          {running ? "Replaying…" : "Run deterministic replay"}
        </button>
        {error ? <p className="error-message">{error}</p> : null}
      </div>

      <div className="panel result-panel" aria-live="polite">
        <span className="panel-label">03 · Canonical result</span>
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
              <span>Canonical result hash</span>
              <code>{result.replay.canonicalResultHash}</code>
            </div>
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
