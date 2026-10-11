"use client";

import React from "react";

import type {
  ApprovalRecord,
  RapidPriceLiftFinding as Finding,
  SchemaMappingProposal,
  SourceTrace,
} from "@weavetrail/contracts";

import { replayCopy } from "./copy";
import { gateReading, type GateName } from "./machine-values";
import { useReplayLanguage } from "./replay-language";

type TraceEntry = SourceTrace["entries"][number];

/**
 * One row of the approved mapping, read as it was approved. `sourceColumns` is
 * null for a target the proposal declared absent from the source; `targetField`
 * is null for a source column the proposal left unmapped.
 */
export type MappingTraceRow = {
  readonly key: string;
  readonly sourceColumns: readonly string[] | null;
  readonly targetField: string | null;
  readonly transform: string | null;
  readonly evidence: string;
  readonly reason: string | null;
};

/** Where a mapping row is rendered, so an evidence line can link to it. */
export const mappingRowId = (key: string) => `approved-mapping-${key}`;

/** Where a finding is rendered, so a mapping row can link back to it. */
export const findingId = (gate: string) => `gate-${gate}`;

/**
 * The rows of the mapping an approval is bound to, in the order the review
 * panel shows them. Reasons come from the approval record by the same field
 * path the review inputs write, verbatim.
 */
export function mappingTraceRows(
  proposal: SchemaMappingProposal,
  approval: ApprovalRecord,
): readonly MappingTraceRow[] {
  const reasons = new Map(
    approval.overrides.map(({ fieldPath, reason }) => [fieldPath, reason]),
  );
  const rows: MappingTraceRow[] = [];
  if ("compositeSourceEventId" in proposal && proposal.compositeSourceEventId)
    rows.push({
      key: "compositeSourceEventId",
      sourceColumns: proposal.compositeSourceEventId.sourceColumns,
      targetField: "sourceEventId",
      transform: proposal.compositeSourceEventId.transform,
      evidence: proposal.compositeSourceEventId.evidence,
      reason: null,
    });
  if ("compositeEventTime" in proposal && proposal.compositeEventTime)
    rows.push({
      key: "compositeEventTime",
      sourceColumns: proposal.compositeEventTime.sourceColumns,
      targetField: "eventTime",
      transform: proposal.compositeEventTime.transform,
      evidence: proposal.compositeEventTime.evidence,
      reason: null,
    });
  proposal.fields.forEach((field, index) =>
    rows.push({
      key: `fields-${index}`,
      sourceColumns: [field.sourceColumn],
      targetField: field.targetField,
      transform: field.transform,
      evidence: field.evidence,
      reason: reasons.get(`fields.${index}`) ?? null,
    }),
  );
  if ("unmappedFields" in proposal)
    proposal.unmappedFields.forEach((field, index) =>
      rows.push({
        key: `unmappedFields-${index}`,
        sourceColumns: null,
        targetField: field.targetField,
        transform: null,
        evidence: field.evidence,
        reason: reasons.get(`unmappedFields.${index}`) ?? null,
      }),
    );
  return rows;
}

/**
 * The checks that counted an event derived through this row: the row maps
 * a target and this source row carries every column it reads. Which events a
 * check counted is the server's `referencedEventIds`; nothing is recomputed.
 */
export function checksForLine(
  row: MappingTraceRow,
  entry: TraceEntry,
  findings: readonly Finding[],
): readonly Finding[] {
  if (row.targetField === null || row.sourceColumns === null) return [];
  if (row.sourceColumns.some((column) => !(column in entry.sourceRow.values)))
    return [];
  return findings.filter(({ referencedEventIds }) =>
    referencedEventIds.includes(entry.event.eventId),
  );
}

/** Every check any evidence line of this row names, in finding order. */
export function checksForRow(
  row: MappingTraceRow,
  sourceTrace: SourceTrace,
  findings: readonly Finding[],
): readonly Finding[] {
  const used = new Set(
    sourceTrace.entries.flatMap((entry) =>
      checksForLine(row, entry, findings).map(({ gate }) => gate),
    ),
  );
  return findings.filter(({ gate }) => used.has(gate));
}

/** The canonical value the trace returned for a target, exactly as returned. */
function canonicalValue(
  entry: TraceEntry,
  targetField: string | null,
): string | undefined {
  if (targetField === null) return undefined;
  const value = (entry.event as Record<string, unknown>)[targetField];
  return typeof value === "string" ? value : undefined;
}

/**
 * Move to an anchor inside the evidence, opening any disclosure that hides it,
 * and take focus there so the next Tab continues from the destination.
 */
export function revealAnchor(id: string) {
  if (typeof document === "undefined") return;
  const target = document.getElementById(id);
  if (!target) return;
  for (
    let node: HTMLElement | null = target.parentElement;
    node;
    node = node.parentElement
  )
    if (node instanceof HTMLDetailsElement) node.open = true;
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.focus({ preventScroll: true });
}

function AnchorLink({
  target,
  children,
  className,
}: {
  target: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={`#${target}`}
      onClick={(event) => {
        event.preventDefault();
        revealAnchor(target);
      }}
    >
      {children}
    </a>
  );
}

function CheckLinks({
  checks,
  none,
}: {
  checks: readonly Finding[];
  none: string;
}) {
  const language = useReplayLanguage();
  if (checks.length === 0) return <span className="trace-none">{none}</span>;
  return (
    <span className="trace-checks">
      {checks.map(({ gate }) => (
        <AnchorLink className="trace-check" key={gate} target={findingId(gate)}>
          {gateReading(gate as GateName, language).label}
        </AnchorLink>
      ))}
    </span>
  );
}

function Target({ row }: { row: MappingTraceRow }) {
  const text = replayCopy[useReplayLanguage()].trace;
  return (
    <>
      <code>{row.targetField ?? text.notMapped}</code>
      {row.transform ? (
        <>
          {" · "}
          <code>{row.transform}</code>
        </>
      ) : null}
    </>
  );
}

function ReviewerReason({ reason }: { reason: string | null }) {
  const text = replayCopy[useReplayLanguage()].trace;
  if (reason === null) return null;
  return (
    <span className="trace-reason">
      {text.reviewerReason}: <q>{reason}</q>
    </span>
  );
}

/**
 * One line per approved mapping row for one traced event: the committed
 * source value, the approved target and transform, the canonical value the
 * server returned, and the checks that counted the event.
 */
export function EvidenceLines({
  rows,
  entry,
  findings,
}: {
  rows: readonly MappingTraceRow[];
  entry: TraceEntry;
  findings: readonly Finding[];
}) {
  const text = replayCopy[useReplayLanguage()].trace;
  return (
    <ol className="trace-lines">
      {rows.map((row) => {
        const value = canonicalValue(entry, row.targetField);
        return (
          <li className="trace-line" data-mapping-row={row.key} key={row.key}>
            <span className="trace-source">
              {row.sourceColumns === null ? (
                <code>{text.sourceAbsent}</code>
              ) : (
                row.sourceColumns.map((column) => (
                  <span key={column}>
                    <code>{column}</code> ={" "}
                    {column in entry.sourceRow.values ? (
                      <code>{entry.sourceRow.values[column]}</code>
                    ) : (
                      <em>{text.absentInRow}</em>
                    )}
                  </span>
                ))
              )}
            </span>
            <span aria-hidden="true">→</span>
            <span className="trace-target">
              <Target row={row} />
            </span>
            <span aria-hidden="true">→</span>
            <span className="trace-canonical">
              {row.targetField === null ? (
                <em>{text.noCanonicalValue}</em>
              ) : value === undefined ? (
                <em>{text.notInTrace}</em>
              ) : (
                <code>{value}</code>
              )}
            </span>
            <ReviewerReason reason={row.reason} />
            <span className="trace-used">
              {text.lineChecks}:{" "}
              <CheckLinks
                checks={checksForLine(row, entry, findings)}
                none={text.none}
              />
            </span>
            <AnchorLink
              className="trace-row-link"
              target={mappingRowId(row.key)}
            >
              {text.goToRow}
            </AnchorLink>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The approved mapping itself, one row per entry, each linking to the checks
 * that used it. Proposal evidence is the proposal's own text and a reviewer
 * reason is the approval record's own text; neither is rewritten.
 */
export function ApprovedMappingTrace({
  rows,
  sourceTrace,
  findings,
}: {
  rows: readonly MappingTraceRow[];
  sourceTrace: SourceTrace;
  findings: readonly Finding[];
}) {
  const text = replayCopy[useReplayLanguage()].trace;
  return (
    <details className="approved-mapping">
      <summary>
        {text.approvedMapping}
        <small>{text.approvedMappingNote}</small>
      </summary>
      <ol className="approved-mapping-rows">
        {rows.map((row) => (
          <li
            className="approved-mapping-row"
            data-source-columns={row.sourceColumns?.join(" + ") ?? ""}
            data-target-field={row.targetField ?? ""}
            data-transform={row.transform ?? ""}
            id={mappingRowId(row.key)}
            key={row.key}
            tabIndex={-1}
          >
            <span className="trace-source">
              {row.sourceColumns === null ? (
                <code>{text.sourceAbsent}</code>
              ) : (
                <code>{row.sourceColumns.join(" + ")}</code>
              )}
            </span>
            <span aria-hidden="true">→</span>
            <span className="trace-target">
              <Target row={row} />
            </span>
            <span className="trace-evidence">
              {text.proposalEvidence}: {row.evidence}
            </span>
            <ReviewerReason reason={row.reason} />
            <span className="trace-used">
              {text.rowChecks}:{" "}
              <CheckLinks
                checks={checksForRow(row, sourceTrace, findings)}
                none={text.none}
              />
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}
