import React from "react";

import type { Language } from "../../i18n/language";
import { ApprovalReceipt } from "../approval-receipt";
import { Instant } from "../machine-values";
import { approveCaseLabel, caseApprovalStep } from "./case-approval";
import { STEP } from "./index";
import { panelLabel, shows, type GuideView } from "./step";

/**
 * The authored case: instrument, actor group, window and the rule's threshold
 * values, with the exact artifact the approval binds to one disclosure away.
 * A source without a case manifest has no case to approve.
 */
export function renderCasePanel(view: GuideView, language: Language) {
  const text = caseApprovalStep.panel[language];
  const { manifest } = view.selectedScenario;
  return (
    <div hidden={!shows(view, STEP.caseApproval) || view.mappingExample}>
      {manifest ? (
        <div className="case-preview">
          <span className="panel-label">
            {panelLabel(view, "03", text.panelLabel)}
          </span>
          <dl>
            <div>
              <dt>{text.instrument}</dt>
              <dd>{manifest.hypothesis.instrumentId}</dd>
            </div>
            <div>
              <dt>{text.actors}</dt>
              <dd>{manifest.hypothesis.actorIds.join(", ")}</dd>
            </div>
            <div>
              <dt>{text.window}</dt>
              <dd>
                <Instant value={manifest.hypothesis.startTime} /> —{" "}
                <Instant value={manifest.hypothesis.endTime} />
              </dd>
            </div>
          </dl>
          <p>
            {text.pattern}: <code>{manifest.hypothesis.pattern}</code>
          </p>
          <p>{text.authored}</p>
          {manifest.rules.map((rule) => (
            <div key={rule.ruleId} className="case-rules">
              <h3>
                <code>
                  {rule.ruleId}@{rule.ruleVersion}
                </code>
              </h3>
              <p>
                {view.caseApproval
                  ? text.approvedThresholds
                  : text.proposedThresholds}{" "}
                {text.thresholdNote}
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
            <summary>{text.inspect}</summary>
            <p className="machine-note">{text.inspectNote}</p>
            <pre className="artifact-json" aria-label={text.inspectLabel}>
              {JSON.stringify(manifest, null, 2)}
            </pre>
          </details>
          {!view.approval && <p>{text.mappingFirst}</p>}
          <p className="approval-binding">{text.binding}</p>
          <button
            className={`button approve-case${view.caseApproval ? "" : " primary"}${
              view.guided &&
              view.chapter === STEP.caseApproval &&
              !view.caseApproval
                ? " step-action"
                : ""
            }`}
            data-approved={view.caseApproval !== null}
            disabled={!view.approval}
            onClick={view.approveCase}
            type="button"
          >
            {approveCaseLabel(view, language)}
          </button>
          {view.caseApproval && (
            <ApprovalReceipt approval={view.caseApproval} />
          )}
        </div>
      ) : null}
    </div>
  );
}
