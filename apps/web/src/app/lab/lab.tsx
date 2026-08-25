"use client";

import { useState } from "react";

type Mutation = "baseline" | "shuffle" | "duplicate";
type ReplayResponse = {
  mode: string;
  scenario: string;
  mutation: string;
  boundary: string;
  replay: {
    engineVersion: string;
    inputEventCount: number;
    canonicalEventCount: number;
    duplicateCount: number;
    orderedEventIds: string[];
    canonicalResultHash: string;
  };
};

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

export function Lab() {
  const [mutation, setMutation] = useState<Mutation>("baseline");
  const [result, setResult] = useState<ReplayResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runReplay() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mutation }),
      });
      if (!response.ok)
        throw new Error(`Replay failed with HTTP ${response.status}`);
      setResult((await response.json()) as ReplayResponse);
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
          <span className="panel-label">02 · Fixture mapping</span>
          <div className="mapping-row">
            <code>timestamp</code>
            <span>→</span>
            <code>eventTime</code>
            <b>APPROVED</b>
          </div>
          <div className="mapping-row">
            <code>account</code>
            <span>→</span>
            <code>actorId</code>
            <b>APPROVED</b>
          </div>
          <div className="mapping-row">
            <code>px / qty</code>
            <span>→</span>
            <code>price / quantity</code>
            <b>APPROVED</b>
          </div>
        </div>
        <button
          className="button primary run-button"
          disabled={running}
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
