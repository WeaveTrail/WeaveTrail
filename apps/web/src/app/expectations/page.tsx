import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import publication from "./scenario-expectations.json";

export const metadata: Metadata = {
  title: "Scenario expectations",
  description:
    "Compare every committed WeaveTrail replay source with its engine-derived workflow state, result, gate readings, and canonical hashes.",
  alternates: { canonical: "/expectations" },
};

function Hash({ label, value }: { label: string; value: string }) {
  return (
    <div className="machine-hash">
      <span className="machine-label">{label}</span>
      <code className="machine-full">{value}</code>
    </div>
  );
}

export default function ExpectationsPage() {
  return (
    <main className="shell page-shell">
      <div className="page-heading">
        <span className="eyebrow">Committed verification oracle</span>
        <h1>Expected scenario results</h1>
        <p>
          Use these engine-derived values to check a baseline run in Case
          Replay. They describe one fixed source, approved mapping, approved
          case where present, and the versioned rule. They do not establish the
          truth of the source or a legal, causal, or investment conclusion.
        </p>
      </div>

      <section className="panel expectations-guide">
        <h2>Reproduce a baseline from a clean session</h2>
        <ol>
          <li>
            With the default fixture provider, open{" "}
            <Link href="/replay?mode=working">Case Replay working mode</Link> in
            a fresh browser session and leave the advanced variation on
            <strong> Baseline</strong>.
          </li>
          <li>Select the committed source artifact named in a record below.</li>
          <li>
            For every mapping field marked <code>REVIEW_REQUIRED</code>, enter a
            nonblank reason for accepting the displayed interpretation. Then
            select <strong>Approve executed mapping</strong>.
          </li>
          <li>
            If a case manifest is shown, review its scope and thresholds and
            select <strong>Approve case manifest</strong>.
          </li>
          <li>
            Select <strong>Run deterministic replay</strong> for mapping 1.4
            sources, including Dialect A and Dialect B, even though those two
            sources have no case manifest. Select{" "}
            <strong>Normalize source</strong> for mapping 1.5 and 1.6
            daily-quote sources. Compare the final workflow state, result, gate
            readings, and canonical result hash below. The case proposal shows
            the canonical dataset hash for evaluated cases.
          </li>
        </ol>
        <p>
          The current result panel does not display a canonical dataset hash for
          normalization-only sources. Reproduce all values in this publication,
          including those dataset hashes, with{" "}
          <code>
            pnpm exec vitest run
            packages/replay-engine/src/published-scenario-expectations.test.ts
          </code>
          .
        </p>
        <p>
          This publication was captured at Git revision{" "}
          <code>2a438d04b3f5f04ad847d3207b72a70eb0a76b39</code> with Node{" "}
          <code>22.18.0</code>, pnpm <code>10.33.2</code>, Vitest{" "}
          <code>4.1.11</code>, and Linux WSL2 x86_64. The test recomputes every
          value with the environment in which it runs and reports drift from
          this committed artifact.
        </p>
        <p>
          Approval hashing requires Web Crypto in a secure browser context.
          HTTPS deployments and <code>http://localhost</code> meet that browser
          requirement. Outside a secure context, approval hashing fails closed:
          mapping and case approvals remain unset, replay stays blocked, and no
          result is produced.
        </p>
        <p>
          A repeated baseline executes the same approved input again and should
          return the same canonical result hash. That comparison establishes
          same-input repeatability only. It does not establish source
          authenticity, correctness for changed inputs, causality, or real-world
          rule accuracy. Rate readings are reported after truncation to four
          decimal places, while the engine compares exact ratios; price change,
          shares, and removal sensitivity use basis points, and repeated
          execution uses a count. See{" "}
          <Link href="/methodology">Methodology</Link> and the{" "}
          <a href="https://github.com/WeaveTrail/WeaveTrail/blob/main/docs/LIMITATIONS.md">
            repository limitations
          </a>{" "}
          for interpretation boundaries.
        </p>
      </section>

      <section className="expectations-list" aria-label="Expected outputs">
        {publication.scenarios.map((scenario) => (
          <article className="panel expectation-card" key={scenario.scenario}>
            <span className="panel-label">{scenario.label}</span>
            <h2>
              <code>{scenario.scenario}</code>
            </h2>
            <dl className="expectation-facts">
              <div>
                <dt>Final workflow state</dt>
                <dd>
                  <code>{scenario.workflowState}</code>
                </dd>
              </div>
              <div>
                <dt>Pattern result</dt>
                <dd>
                  {scenario.result === null ? (
                    "Not evaluated"
                  ) : (
                    <strong data-result={scenario.result}>
                      {scenario.result}
                    </strong>
                  )}
                </dd>
              </div>
            </dl>
            {scenario.result === null ? (
              <p>
                This source has no committed case manifest. The workflow ends
                after approved mapping and deterministic normalization, before
                any pattern gate or verdict is evaluated.
              </p>
            ) : scenario.inconclusiveReason !== null ? (
              <p>
                Reason: <code>{scenario.inconclusiveReason}</code>. The engine
                returns no finding rows or observed gate values for this
                inconclusive run; the thresholds below remain the values
                declared by the approved manifest.
              </p>
            ) : null}
            {scenario.hypothesis !== null ? (
              <section className="expectation-hypothesis">
                <h3>Versioned hypothesis</h3>
                <p>
                  <code>{scenario.hypothesis.pattern}</code> evaluated by{" "}
                  {scenario.hypothesis.rules.map((rule, index) => (
                    <React.Fragment key={`${rule.ruleId}@${rule.ruleVersion}`}>
                      {index > 0 ? ", " : ""}
                      <code>
                        {rule.ruleId}@{rule.ruleVersion}
                      </code>
                    </React.Fragment>
                  ))}
                  .
                </p>
                <dl className="expectation-facts">
                  <div>
                    <dt>Manifest version</dt>
                    <dd>
                      <code>{scenario.hypothesis.manifestVersion}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Instrument</dt>
                    <dd>{scenario.hypothesis.instrumentIds.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Approved actor group</dt>
                    <dd>{scenario.hypothesis.actorIds.join(", ")}</dd>
                  </div>
                  <div>
                    <dt>Window</dt>
                    <dd>
                      <code>{scenario.hypothesis.startTime}</code> —{" "}
                      <code>{scenario.hypothesis.endTime}</code>
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}
            <Hash
              label="Canonical dataset hash"
              value={scenario.canonicalDatasetHash}
            />
            <Hash
              label="Canonical result hash"
              value={scenario.canonicalResultHash}
            />
            {scenario.gates.length > 0 ? (
              <div className="gate-list" aria-label="Expected gate readings">
                <h3>Gate readings</h3>
                {scenario.gates.map((gate) => (
                  <div className="gate-row" key={gate.gate}>
                    <strong>{gate.gate}</strong>
                    <span>
                      Observed{" "}
                      <code>{gate.observedValue ?? "not produced"}</code>
                      {" · threshold "}
                      <code>{gate.threshold}</code>
                    </span>
                    <b
                      data-passed={
                        gate.passed === null ? undefined : gate.passed
                      }
                    >
                      {gate.passed === null
                        ? "NOT EVALUATED"
                        : gate.passed
                          ? "PASS"
                          : "FAIL"}
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <p>No rule gates or thresholds are declared for this source.</p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
