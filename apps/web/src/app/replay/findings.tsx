"use client";

import React from "react";

import type {
  ApprovalRecord,
  RapidPriceLiftResult,
  ReplayScenario,
  SchemaMappingProposal,
  SourceTrace,
} from "@weavetrail/contracts";

import { openedForPrint } from "../shell/print-disclosures";
import {
  Bps,
  eventFieldNote,
  gateReading,
  GateReading,
  HashValue,
  Instant,
  reportedValueNote,
  type GateName,
} from "./machine-values";
import {
  ApprovedMappingTrace,
  EvidenceLines,
  findingId,
  mappingTraceRows,
} from "./mapping-trace";
import { useReplayLanguage } from "./replay-language";
import { evidenceStep } from "./steps/evidence";
import { GUIDE_TARGET_EVIDENCE } from "./steps/step";

/**
 * The rule's checks, each with its observed value against its threshold, how
 * many canonical events it counted, and a disclosure that lists those events
 * with the committed source row behind each, traced through the approved
 * mapping. An INCONCLUSIVE result carries its reason and no finding evidence.
 */
export function RapidPriceLiftEvaluation({
  evaluation,
  sourceTrace,
  scenario,
  onEvidenceOpen,
  advancesStep = false,
  mapping,
}: {
  evaluation: RapidPriceLiftResult;
  sourceTrace: SourceTrace;
  scenario: ReplayScenario;
  onEvidenceOpen?: () => void;
  advancesStep?: boolean;
  /** The proposal and the approval bound to it that this result ran under. */
  mapping?:
    { proposal: SchemaMappingProposal; approval: ApprovalRecord } | undefined;
}) {
  const language = useReplayLanguage();
  const text = evidenceStep.panel[language];
  const mappingRows = mapping
    ? mappingTraceRows(mapping.proposal, mapping.approval)
    : null;
  return (
    <section className="result-summary" aria-label={text.resultLabel}>
      <div className="evaluation-heading">
        <strong data-result={evaluation.result}>{evaluation.result}</strong>
        <code>
          {evaluation.ruleId}@{evaluation.ruleVersion}
        </code>
      </div>
      <div className="evaluation-block">
        {evaluation.result === "INCONCLUSIVE" ? (
          <>
            <p>
              {text.reason}: {evaluation.reason}
            </p>
            <p>{text.noEvidence}</p>
          </>
        ) : (
          <div className="gate-list">
            <p className="machine-note">{reportedValueNote(language)}</p>
            {evaluation.findings.map((finding, index) => (
              <div
                className="gate-row"
                key={finding.gate}
                id={findingId(finding.gate)}
                tabIndex={-1}
              >
                <strong>
                  {gateReading(finding.gate as GateName, language).label}
                </strong>
                <code className="gate-id">{finding.gate}</code>
                <GateReading
                  gate={finding.gate as GateName}
                  observedValue={finding.observedValue}
                  threshold={finding.threshold}
                />
                <b data-passed={finding.passed}>
                  {finding.passed ? text.passed : text.failed}
                </b>
                <p className="gate-description">
                  {gateReading(finding.gate as GateName, language).tests}
                </p>
                {/* Each event id opens with its source row in the disclosure
                    below; the row says how many the check counted. */}
                <small>
                  {text.eventsCounted(finding.referencedEventIds.length)}
                </small>
                <details
                  className={
                    advancesStep
                      ? "source-evidence step-action"
                      : "source-evidence"
                  }
                  onToggle={(event) => {
                    if (
                      event.currentTarget.open &&
                      !openedForPrint(event.currentTarget)
                    )
                      onEvidenceOpen?.();
                  }}
                >
                  <summary id={index === 0 ? GUIDE_TARGET_EVIDENCE : undefined}>
                    {text.inspect(
                      finding.gate,
                      gateReading(finding.gate as GateName, language).label,
                    )}
                    <small>{text.inspectNote}</small>
                  </summary>
                  {sourceTrace.entries
                    .filter(({ event }) =>
                      finding.referencedEventIds.includes(event.eventId),
                    )
                    .map(({ event, sourceRow }) => (
                      <article
                        key={event.eventId}
                        aria-label={text.evidenceFor(event.eventId)}
                      >
                        {mappingRows ? (
                          <>
                            <h3>
                              {text.sourceRow} {sourceRow.coordinate.rowNumber}{" "}
                              → <code>{event.eventId}</code>
                            </h3>
                            <EvidenceLines
                              rows={mappingRows}
                              entry={{ event, sourceRow }}
                              findings={evaluation.findings}
                            />
                          </>
                        ) : null}
                        <details className="trace-machine-values">
                          <summary>{text.machineValues}</summary>
                          <h3>{text.canonicalEvent}</h3>
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
                                  {eventFieldNote(field, language) ? (
                                    <small className="machine-note">
                                      {eventFieldNote(field, language)}
                                    </small>
                                  ) : null}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          <h3>{text.committedRow}</h3>
                          <dl>
                            <div>
                              <dt>{text.artifact}</dt>
                              <dd>{scenario}</dd>
                            </div>
                            <div>
                              <dt>sourceArtifactHash</dt>
                              <dd>
                                <HashValue
                                  scope="sourceArtifact"
                                  value={
                                    sourceRow.coordinate.sourceArtifactHash
                                  }
                                />
                              </dd>
                            </div>
                            <div>
                              <dt>{text.rowNumber}</dt>
                              <dd>{sourceRow.coordinate.rowNumber}</dd>
                            </div>
                          </dl>
                          <h3>{text.rawValues}</h3>
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
                        </details>
                      </article>
                    ))}
                </details>
              </div>
            ))}
            {mappingRows ? (
              <ApprovedMappingTrace
                rows={mappingRows}
                sourceTrace={sourceTrace}
                findings={evaluation.findings}
              />
            ) : null}
          </div>
        )}
        {evaluation.sensitivity ? (
          <div className="sensitivity-block">
            <strong>{text.sensitivity}</strong>
            <small className="machine-note">
              {reportedValueNote(language)}
            </small>
            <a href={`#${findingId("REMOVAL_SENSITIVITY")}`}>
              {text.sensitivityLink}
            </a>
            <span>
              {text.priceChange}:{" "}
              <Bps value={evaluation.sensitivity.priceChangeBps} />
            </span>
            <span>
              {text.withoutActors}:{" "}
              <Bps
                value={
                  evaluation.sensitivity.priceChangeBpsWithoutApprovedActors
                }
              />
            </span>
            <span>
              {text.difference}:{" "}
              <Bps value={evaluation.sensitivity.removalSensitivityBps} />
            </span>
          </div>
        ) : null}
        <small>
          {text.nonComparable}: {evaluation.nonComparableEventCount}
        </small>
      </div>
    </section>
  );
}
