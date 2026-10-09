"use client";

import React from "react";

import { ExplainerPage, ExplainerSection } from "../explainer/explainer";
import { useCopy, useLanguage } from "../i18n/language";
import { replayCopy } from "../replay/copy";
import { SCENARIO_LABELS_KO } from "../replay/scenario-labels";
import { caseApprovalStep } from "../replay/steps/case-approval";
import { mappingStep } from "../replay/steps/mapping";
import { runStep } from "../replay/steps/run";
import { conditionsKo, expectationsCopy } from "./copy";

import type { ReplayScenario } from "@weavetrail/contracts";

export type Scenario = {
  scenario: string;
  label: string;
  purpose: string;
  availableInCaseReplay: boolean;
  availableMutations: readonly string[];
  workflowState: string;
  demonstrates: string | null;
  result: string | null;
  inconclusiveReason: string | null;
  nonComparableEventCount: number | null;
  reviewIssues: readonly string[];
  canonicalDatasetHash: string | null;
  canonicalResultHash: string | null;
  gates: readonly {
    gate: string;
    observedValue: string | null;
    threshold: string;
    passed: boolean | null;
  }[];
  hypothesis: null | {
    pattern: string;
    rules: readonly { ruleId: string; ruleVersion: string }[];
    manifestVersion: string;
    instrumentIds: readonly string[];
    actorIds: readonly string[];
    startTime: string;
    endTime: string;
  };
};

export type CaptureEnvironment = {
  readonly node: string;
  readonly pnpm: string;
  readonly vitest: string;
};

/**
 * The expected outcome of every committed case at a glance, the full record
 * of each one disclosure away, and how to reproduce one.
 */
export function ExpectationsContent({
  scenarios,
  environment,
}: {
  scenarios: readonly Scenario[];
  environment: CaptureEnvironment;
}) {
  const { language } = useLanguage();
  const text = useCopy(expectationsCopy);
  const ordered = [
    ...scenarios.filter((s) => s.availableInCaseReplay),
    ...scenarios.filter((s) => !s.availableInCaseReplay),
  ];
  const name = (s: Scenario) =>
    language === "ko"
      ? (SCENARIO_LABELS_KO[s.scenario as ReplayScenario] ?? s.label)
      : s.label;
  const steps = text.steps({
    workingMode: replayCopy[language].heading.workingMode,
    baseline: replayCopy[language].working.mutations.baseline[0],
    approveMapping: mappingStep.panel[language].approve,
    approveCase: caseApprovalStep.panel[language].approve,
    run: runStep.panel[language].run,
    normalize: runStep.panel[language].normalize,
  });

  return (
    <ExplainerPage
      answer={<p>{text.answer}</p>}
      eyebrow={text.eyebrow}
      sections={[
        ["outcomes", text.sections.outcomes],
        ["reproduce", text.sections.reproduce],
        ["capture", text.sections.capture],
      ]}
      title={text.title}
    >
      <ExplainerSection
        id="outcomes"
        line={text.outcomesLine}
        more={ordered.map((s) => (
          <article className="expectation-card" key={s.scenario}>
            <h3>
              <code>{s.scenario}</code>
            </h3>
            <dl className="expectation-facts">
              {s.demonstrates && (
                <div>
                  <dt>{text.facts.condition}</dt>
                  <dd>
                    {language === "ko"
                      ? (conditionsKo[s.scenario] ?? s.demonstrates)
                      : s.demonstrates}
                  </dd>
                </div>
              )}
              <div>
                <dt>{text.purpose[s.purpose as keyof typeof text.purpose]}</dt>
                <dd>
                  {text.facts.mutations}: {s.availableMutations.join(", ")}
                </dd>
              </div>
              {s.inconclusiveReason && (
                <div>
                  <dt>{text.facts.reason}</dt>
                  <dd>
                    <code>{s.inconclusiveReason}</code>
                    {s.nonComparableEventCount !== null
                      ? ` · ${text.facts.nonComparable}: ${s.nonComparableEventCount}`
                      : null}
                  </dd>
                </div>
              )}
              {s.reviewIssues.length > 0 && (
                <div>
                  <dt>{text.facts.reviewIssues}</dt>
                  <dd>
                    <code>{s.reviewIssues.join(", ")}</code>
                  </dd>
                </div>
              )}
              {s.hypothesis ? (
                <div>
                  <dt>{text.facts.hypothesis}</dt>
                  <dd>
                    <code>{s.hypothesis.pattern}</code> ·{" "}
                    {text.facts.evaluatedBy}{" "}
                    {s.hypothesis.rules.map((rule, index) => (
                      <React.Fragment key={rule.ruleId}>
                        {index ? ", " : ""}
                        <code>{`${rule.ruleId}@${rule.ruleVersion}`}</code>
                      </React.Fragment>
                    ))}
                    <br />
                    {text.facts.manifest}{" "}
                    <code>{s.hypothesis.manifestVersion}</code> ·{" "}
                    {text.facts.instrument}{" "}
                    {s.hypothesis.instrumentIds.join(", ")} ·{" "}
                    {text.facts.actors} {s.hypothesis.actorIds.join(", ")} ·{" "}
                    {text.facts.window} <code>{s.hypothesis.startTime}</code> —{" "}
                    <code>{s.hypothesis.endTime}</code>
                  </dd>
                </div>
              ) : s.result === null && s.reviewIssues.length === 0 ? (
                <div>
                  <dt>{text.facts.hypothesis}</dt>
                  <dd>{text.noManifest}</dd>
                </div>
              ) : null}
              {s.canonicalDatasetHash ? (
                <div>
                  <dt>{text.facts.dataset}</dt>
                  <dd>
                    <code>{s.canonicalDatasetHash}</code>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>{text.facts.hash}</dt>
                <dd>
                  {s.canonicalResultHash ? (
                    <code>{s.canonicalResultHash}</code>
                  ) : (
                    text.noHash
                  )}
                </dd>
              </div>
              <div>
                <dt>{text.facts.gates}</dt>
                <dd>
                  {s.gates.length ? (
                    <ul>
                      {s.gates.map((g) => (
                        <li key={g.gate}>
                          <code>{g.gate}</code> · {text.facts.observed}{" "}
                          <code>{g.observedValue ?? text.notProduced}</code> ·{" "}
                          {text.facts.threshold} <code>{g.threshold}</code> ·{" "}
                          <b data-passed={g.passed ?? undefined}>
                            {g.passed === null
                              ? text.gate.notEvaluated
                              : g.passed
                                ? text.gate.passed
                                : text.gate.failed}
                          </b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    text.noGates
                  )}
                </dd>
              </div>
            </dl>
          </article>
        ))}
        title={text.sections.outcomes}
      >
        <div
          aria-labelledby="outcomes-title"
          className="expectation-wrap"
          role="region"
          tabIndex={0}
        >
          <table className="expectation-table">
            <thead>
              <tr>
                <th scope="col">{text.columns.case}</th>
                <th scope="col">{text.columns.listed}</th>
                <th scope="col">{text.columns.state}</th>
                <th scope="col">{text.columns.result}</th>
                <th scope="col">{text.columns.checks}</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((s) => (
                <tr key={s.scenario}>
                  <th scope="row">{name(s)}</th>
                  <td>
                    {s.availableInCaseReplay ? text.listed : text.notListed}
                  </td>
                  <td>
                    <code>{s.workflowState}</code>
                  </td>
                  <td>
                    {s.result === null ? (
                      text.notEvaluated
                    ) : (
                      <strong data-result={s.result}>{s.result}</strong>
                    )}
                  </td>
                  <td>
                    {s.gates.some((g) => g.passed !== null)
                      ? text.checksPassing(
                          s.gates.filter((g) => g.passed).length,
                          s.gates.length,
                        )
                      : text.noChecks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ExplainerSection>
      <ExplainerSection
        id="reproduce"
        line={text.reproduceLine}
        link={[text.openWorkingMode, "/replay?mode=working"]}
        more={text.reproduceMore.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        title={text.sections.reproduce}
      >
        <ol className="expectation-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </ExplainerSection>
      <ExplainerSection
        id="capture"
        line={text.captureLine}
        title={text.sections.capture}
      >
        <p>
          {text.environment}: {text.tools.node} <code>{environment.node}</code>,{" "}
          {text.tools.pnpm} <code>{environment.pnpm}</code>, {text.tools.vitest}{" "}
          <code>{environment.vitest}</code>, {text.platform}
        </p>
      </ExplainerSection>
    </ExplainerPage>
  );
}
