import React from "react";

import { requiresMappingOverride } from "@weavetrail/contracts";

import type { Language } from "../../i18n/language";
import { ApprovalReceipt } from "../approval-receipt";
import { STEP } from "./index";
import { approveMappingLabel, mappingStep } from "./mapping";
import { GUIDE_TARGET_EXAMPLE, reveal, shows, type GuideView } from "./step";

/**
 * Both the worked case and the review example render a proposal, so an input
 * id says which of the two it belongs to.
 */
const reviewInputId = (view: GuideView, fieldPath: string) =>
  `mapping-review-${view.mappingExample ? "example" : "case"}-${fieldPath.replace(".", "-")}`;

/**
 * The proposal in full, as proposed: each field's target, transform,
 * confidence and evidence. The fields that block approval are named above it,
 * each linking to its reason input, and the approval binds to these bytes.
 */
export function renderMappingPanel(view: GuideView, language: Language) {
  const text = mappingStep.panel[language];
  const { proposal } = view;
  const reasonInput = (fieldPath: string, label: string) => (
    <label>
      <span>
        {text.reasonFor} {label}
      </span>
      <input
        aria-label={`${text.reasonFor} ${label}`}
        data-review-unresolved={!view.reviewReasons[fieldPath]?.trim()}
        id={reviewInputId(view, fieldPath)}
        onChange={(event) =>
          view.setReviewReason(fieldPath, event.target.value)
        }
        required
        type="text"
        value={view.reviewReasons[fieldPath] ?? ""}
      />
    </label>
  );
  const composites = [
    "compositeSourceEventId" in proposal
      ? ([text.compositeEventId, proposal.compositeSourceEventId] as const)
      : null,
    "compositeEventTime" in proposal
      ? ([text.compositeEventTime, proposal.compositeEventTime] as const)
      : null,
  ];
  return (
    <div hidden={!shows(view, STEP.mapping)}>
      {view.selectedScenario.mappingRequestRequired && (
        <div>
          <p>{text.requestNote}</p>
          <button
            className="button request-mapping"
            disabled={view.requestingMapping}
            onClick={view.requestMapping}
            type="button"
          >
            {view.requestingMapping ? text.requesting : text.request}
          </button>
        </div>
      )}
      {view.proposalPending ? (
        <p data-status="REVIEW_REQUIRED">REVIEW_REQUIRED · {text.pending}</p>
      ) : (
        <div className="mapping-preview">
          <span className="panel-label">
            {view.guided
              ? text.proposedLabel
              : `02 · ${text.executedLabel} · ${view.displayedProviderMode} · ${view.selectedScenario.value}`}
          </span>
          <p>
            {view.displayedProviderMode === "ai"
              ? text.configuredProvider
              : text.fixtureProvider}
          </p>
          <p>{text.reviewNote}</p>
          <p className="machine-note">{text.evidenceNote}</p>
          {view.unresolvedFields.length > 0 && (
            <div className="review-summary" data-status="REVIEW_REQUIRED">
              <strong>{text.waitingTitle}</strong>
              <p>{text.waitingNote}</p>
              <ul>
                {view.unresolvedFields.map(({ fieldPath, label }) => (
                  <li key={fieldPath}>
                    <button
                      className="review-jump"
                      onClick={() =>
                        typeof document !== "undefined" &&
                        reveal(
                          document.getElementById(
                            reviewInputId(view, fieldPath),
                          ),
                        )
                      }
                      type="button"
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {composites.map((composite) =>
            composite && composite[1] !== undefined ? (
              <section
                aria-label={composite[0]}
                className="mapping-row"
                key={composite[0]}
              >
                <strong>{composite[0]}</strong>
                <span>
                  {text.orderedColumns}:{" "}
                  <code>{composite[1].sourceColumns.join(" + ")}</code>
                </span>
                <span>
                  {text.transform}: <code>{composite[1].transform}</code>
                </span>
                <span>
                  {text.confidence}: {composite[1].confidence.toFixed(2)}
                </span>
                <span>
                  {text.evidence}: {composite[1].evidence}
                </span>
                <b data-status={composite[1].status}>{composite[1].status}</b>
              </section>
            ) : null,
          )}
          {proposal.fields.map((field, index) => (
            <div className="mapping-row" key={field.sourceColumn}>
              <code>{field.sourceColumn}</code>
              <span>→</span>
              <code>{field.targetField ?? text.unmapped}</code>
              <span className="mapping-transform">
                {text.transform}:{" "}
                <code>{field.transform ?? text.noTransform}</code>
              </span>
              <span className="mapping-confidence">
                {text.confidence}: {field.confidence.toFixed(2)} (
                {text.uncalibrated})
              </span>
              <span className="mapping-evidence">
                {text.evidence}: {field.evidence}
              </span>
              <b data-status={field.status}>{field.status}</b>
              {requiresMappingOverride(field)
                ? reasonInput(`fields.${index}`, field.sourceColumn)
                : null}
            </div>
          ))}
          {"unmappedFields" in proposal &&
            proposal.unmappedFields.map((field, index) => (
              <div
                className="mapping-row"
                key={`unmapped-${field.targetField}`}
              >
                <code>{text.sourceAbsent}</code>
                <span>→</span>
                <code>{field.targetField}</code>
                <span>
                  {text.confidence}: {field.confidence.toFixed(2)} (
                  {text.uncalibrated})
                </span>
                <span>
                  {text.evidence}: {field.evidence}
                </span>
                <b data-status={field.status}>{field.status}</b>
                {reasonInput(`unmappedFields.${index}`, field.targetField)}
              </div>
            ))}
          {view.unresolvedReview ? (
            <div className="review-message" data-status="REVIEW_REQUIRED">
              <strong>REVIEW_REQUIRED</strong>
              <span>{text.blocked}</span>
            </div>
          ) : null}
        </div>
      )}
      <button
        className={`button approve-mapping${view.approval ? "" : " primary"}${
          view.guided && view.chapter === STEP.mapping && !view.approval
            ? " step-action"
            : ""
        }`}
        data-approved={view.approval !== null}
        disabled={view.approveMappingBlocked}
        id={view.mappingExample ? GUIDE_TARGET_EXAMPLE : undefined}
        onClick={view.approveMapping}
        type="button"
      >
        {approveMappingLabel(view, language)}
      </button>
      {view.approval && (
        <ApprovalReceipt approval={view.approval} coverage={text.coverage} />
      )}
    </div>
  );
}
