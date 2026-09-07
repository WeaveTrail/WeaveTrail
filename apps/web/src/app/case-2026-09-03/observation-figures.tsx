import React from "react";

import type {
  CrossMarketSessionReversalFinding,
  CrossMarketSessionReversalSensitivity,
} from "@weavetrail/contracts";

import { positionFraction, proportionalScale } from "./scaled-price";
import type { CaseCopy } from "./case-copy";

/**
 * The two observations that decide this case, drawn.
 *
 * Both figures are bound to what the rule reported. The rank strip reads the
 * `BASELINE_RANK` gate's observed value and the analysis population size; the
 * denominator comparison reads the returned sensitivity legs. Neither computes
 * a metric of its own, so no picture here can show a number the engine did not
 * produce — the only arithmetic either performs is turning a reported value
 * into a coordinate.
 *
 * The graphical layer of each figure is `aria-hidden`, and every value it marks
 * is printed as ordinary text in the same figure. That leaves one copy of each
 * value rather than a picture and a transcription that can drift apart, and it
 * keeps the figures readable where an SVG label would not be: text reflows and
 * respects the reader's font size, an 11px label inside a 720-wide viewBox does
 * neither at a 320px viewport.
 */

const PERCENT = (fraction: number) => `${(fraction * 100).toFixed(4)}%`;

export type RankFigureProps = {
  /** The `BASELINE_RANK` gate's observed value: the analysed date's position. */
  position: string;
  populationSize: string;
  baselineRange: { startDate: string; endDateInclusive: string };
  legName: string;
  text: CaseCopy;
};

/**
 * The analysed date's position within the baseline population, as a mark on
 * that population rather than a number to be trusted.
 *
 * Every position in the population gets a tick and the analysed one is the
 * only one coloured, so the reader sees how far along a run of 45 days this
 * session sits without reading an axis. The ticks are evenly spaced because
 * rank is ordinal: the strip orders the population, it does not measure it.
 */
export function BaselineRankFigure({
  position,
  populationSize,
  baselineRange,
  legName,
  text,
}: RankFigureProps) {
  const left = 12;
  const right = 708;
  const top = 24;
  const bottom = 56;
  const size = Number(BigInt(populationSize));
  const at = (rank: number) =>
    left + positionFraction(String(rank), populationSize) * (right - left);
  const marked = at(Number(BigInt(position)));
  return (
    <figure className="rank-figure">
      <figcaption>{text.rankFigureCaption(legName)}</figcaption>
      <svg
        aria-hidden="true"
        className="rank-svg"
        focusable="false"
        viewBox="0 0 720 72"
      >
        <line className="rank-track" x1={left} x2={right} y1={40} y2={40} />
        {[...Array(size).keys()].map((index) => {
          const rank = index + 1;
          const analysed = String(rank) === position;
          return (
            <line
              className="rank-slot"
              data-analysed={analysed}
              key={rank}
              x1={at(rank)}
              x2={at(rank)}
              y1={analysed ? top - 12 : top}
              y2={analysed ? bottom + 12 : bottom}
            />
          );
        })}
        <circle className="rank-mark" cx={marked} cy={12} r="5" />
      </svg>
      <p className="rank-ends" aria-hidden="true">
        <span>{text.rankMostExtreme}</span>
        <span>{text.rankLeastExtreme}</span>
      </p>
      {/* The figure's values in text: the same three the strip marks, plus the
          range they were counted over, which a mark cannot carry. */}
      <dl className="rank-facts">
        <div>
          <dt>{text.rankPositionLabel}</dt>
          <dd>
            <code>{position}</code>
          </dd>
        </div>
        <div>
          <dt>{text.rankPopulationLabel}</dt>
          <dd>
            <code>{populationSize}</code>
          </dd>
        </div>
        <div>
          <dt>{text.rankBaselineLabel}</dt>
          <dd>
            <code>
              {baselineRange.startDate} — {baselineRange.endDateInclusive}
            </code>
          </dd>
        </div>
      </dl>
      <p className="machine-note">
        <code>POSITION_WITHIN_DECLARED_RANGE_NOT_PROBABILITY</code>
      </p>
    </figure>
  );
}

/** One denominator's reported metric, approved or not. */
export type DenominatorRow = {
  denominatorId: string;
  denominatorValue: string;
  meaning: string;
  metricValue: string;
  approved: boolean;
  /** Reported only for an alternative, and null when both metrics are zero. */
  ratioToApprovedMetric?: string | null;
};

export type DivergenceFigureProps = {
  legName: string;
  /** The `LEG_REVERSAL_MULTIPLE` gate's threshold for this leg. */
  threshold: string;
  rows: readonly DenominatorRow[];
  text: CaseCopy;
};

/**
 * The same session's metric under every denominator the approved scope
 * declared, on one comparison.
 *
 * The bars share a scale anchored at zero and the leg's threshold is drawn
 * across them, so which side of the threshold the metric lands on — the thing
 * the gate turns on — is visible without dividing anything. That the
 * alternative's bar is a hairline is the finding, not a rendering fault.
 */
export function DenominatorDivergenceFigure({
  legName,
  threshold,
  rows,
  text,
}: DivergenceFigureProps) {
  // The threshold joins the scale so its marker cannot fall outside the track.
  const width = proportionalScale(
    [...rows.map(({ metricValue }) => metricValue), threshold],
    0,
    1,
  );
  return (
    <figure className="divergence-figure">
      <figcaption>{text.divergenceCaption(legName)}</figcaption>
      <div className="divergence-rows">
        {rows.map((row) => (
          <div className="divergence-row" key={row.denominatorId}>
            <div className="divergence-label">
              <strong>{text.denominatorNames[row.denominatorId]}</strong>
              <span className="divergence-tag" data-approved={row.approved}>
                {row.approved
                  ? text.approvedDenominatorTag
                  : text.alternativeDenominatorTag}
              </span>
              <small>
                {text.denominatorMeanings[row.meaning] ?? row.meaning}
              </small>
            </div>
            <div className="divergence-track" aria-hidden="true">
              <div
                className="divergence-bar"
                data-approved={row.approved}
                style={{ width: PERCENT(width(row.metricValue)) }}
              />
              <div
                className="divergence-threshold"
                style={{ insetInlineStart: PERCENT(width(threshold)) }}
              />
            </div>
            <dl className="divergence-values">
              <div>
                <dt>{text.metricValueLabel}</dt>
                <dd>
                  <code>{row.metricValue}</code>
                </dd>
              </div>
              <div>
                <dt>{text.denominatorValueLabel}</dt>
                <dd>
                  <code>{row.denominatorValue}</code>
                </dd>
              </div>
              {row.approved ? null : (
                <div>
                  <dt>{text.metricRatioLabel}</dt>
                  <dd>
                    <code>
                      {row.ratioToApprovedMetric ?? text.metricRatioUnavailable}
                    </code>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        ))}
      </div>
      <p className="divergence-threshold-note">
        {text.thresholdMarkerLabel(threshold)}
      </p>
    </figure>
  );
}

/** The gate findings and analysis the two containers below read. */
type Finding = CrossMarketSessionReversalFinding;
type Analysis = {
  baselineRange: { startDate: string; endDateInclusive: string };
  rank: { position: string; populationSize: string };
};
type SensitivityLeg = CrossMarketSessionReversalSensitivity["legs"][number];

/**
 * One rank strip per ranked gate, each reading its own gate's observed value
 * rather than the analysis summary, so a figure and the gate beside it cannot
 * disagree about where the day placed.
 */
export function BaselineRankFigures({
  analysis,
  findings,
  legNames,
  text,
}: {
  analysis: Analysis;
  findings: readonly Finding[];
  legNames: Readonly<Record<string, string>>;
  text: CaseCopy;
}) {
  return (
    <>
      {findings
        .filter(({ gate }) => gate === "BASELINE_RANK")
        .map((gate) => (
          <BaselineRankFigure
            baselineRange={analysis.baselineRange}
            key={`${gate.gate}-${gate.legId ?? ""}`}
            legName={
              (gate.legId ? legNames[gate.legId] : undefined) ??
              gate.instrumentId ??
              ""
            }
            populationSize={analysis.rank.populationSize}
            position={gate.observedValue}
            text={text}
          />
        ))}
    </>
  );
}

/**
 * One comparison per sensitivity leg, against the threshold its own
 * `LEG_REVERSAL_MULTIPLE` gate declared. A leg with no such gate is not drawn:
 * without the threshold there is nothing for the metrics to land either side
 * of, and inventing one is exactly what these figures may not do.
 */
export function DenominatorDivergenceFigures({
  findings,
  legNames,
  legs,
  text,
}: {
  findings: readonly Finding[];
  legNames: Readonly<Record<string, string>>;
  legs: readonly SensitivityLeg[];
  text: CaseCopy;
}) {
  const thresholdFor = (legId: string) =>
    findings.find(
      (finding) =>
        finding.gate === "LEG_REVERSAL_MULTIPLE" && finding.legId === legId,
    )?.threshold;
  return (
    <>
      {legs.map((leg) => {
        const threshold = thresholdFor(leg.legId);
        if (threshold === undefined) return null;
        return (
          <DenominatorDivergenceFigure
            key={leg.legId}
            legName={legNames[leg.legId] ?? leg.legId}
            rows={[
              { ...leg.approved, approved: true },
              ...leg.alternatives.map((alternative) => ({
                ...alternative,
                approved: false,
              })),
            ]}
            text={text}
            threshold={threshold}
          />
        );
      })}
    </>
  );
}
