"use client";

import React, { useState } from "react";

/**
 * One statement per displayed hash: what it covers and what a comparison
 * proves. Every hash the workbench prints reads its wording from this table,
 * so a change to a hash's scope is a change in one place.
 */
export const HASH_SCOPES = {
  sourceArtifact: {
    label: "Source artifact hash",
    covers:
      "the committed bytes of the whole source artifact, before any mapping.",
    proves:
      "A match proves the rows under review come from the artifact this hash names. A mismatch proves the submitted artifact is not the committed one.",
  },
  approvedArtifact: {
    label: "Approved artifact hash",
    covers:
      "the exact artifact a person approved, canonically serialized: this proposal and its overrides, nothing else.",
    proves:
      "A match proves the request carries the artifact that was approved. A mismatch proves the approval does not authorize the request, and the replay boundary refuses it.",
  },
  canonicalResult: {
    label: "Canonical result hash",
    covers:
      "the engine version, the canonical event projection and the evaluation when one is present. It does not cover complete approval records, every mapping or manifest field, or the source trace.",
    proves:
      "A match across two runs proves the same approved input and engine version produced the same result. A mismatch proves something in the approved input or the engine differed. Neither establishes authenticity or real-market accuracy.",
  },
  rawRow: {
    label: "Raw row hash",
    covers: "the exact serialized source row this canonical event came from.",
    proves:
      "A match proves the canonical event still resolves to that committed row. A mismatch proves the row changed after the event was derived.",
  },
} as const;

export type HashScope = keyof typeof HASH_SCOPES;

/** Abbreviate for reading. The exact value stays available beside it. */
export function abbreviateHash(value: string): string {
  return value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-8)}` : value;
}

/**
 * Basis points to their plain-language percentage, by shifting the decimal
 * point two places. String arithmetic only: no float ever touches a displayed
 * value. Returns null for anything that is not a decimal string.
 */
export function bpsToPercent(value: string): string | null {
  const parsed = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!parsed) return null;
  const [, sign, whole, fraction = ""] = parsed;
  let digits = `${whole}${fraction}`;
  let point = whole!.length - 2;
  if (point <= 0) {
    digits = `${"0".repeat(1 - point)}${digits}`;
    point = 1;
  }
  const whole_part = digits.slice(0, point);
  // Trailing zeros are dropped below two decimal places only, so the rendered
  // percentage carries the same value as the basis-point string it came from.
  const fraction_part = digits.slice(point).replace(/(\d\d)0+$/, "$1");
  return `${sign}${whole_part}.${fraction_part}`;
}

/**
 * Render an instant a reviewer can read without decoding it, from the exact
 * canonical string. Anything that does not match the canonical shape is
 * returned unchanged rather than reformatted into something it is not.
 */
export function readableInstant(value: string): string {
  const parsed =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!parsed) return value;
  const [, date, time, offset] = parsed;
  return `${date} ${time} (${offset === "Z" ? "UTC" : `UTC${offset}`})`;
}

/** Publisher-format trading dates (YYYYMMDD) as a reviewer reads them. */
export function readableCompactDate(value: string): string {
  const parsed = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  return parsed ? `${parsed[1]}-${parsed[2]}-${parsed[3]}` : value;
}

export function HashValue({
  scope,
  value,
  label,
}: {
  scope: HashScope;
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const { covers, proves } = HASH_SCOPES[scope];
  const name = label ?? HASH_SCOPES[scope].label;
  return (
    <div className="machine-hash">
      <span className="machine-label">{name}</span>
      <code className="machine-abbrev">{abbreviateHash(value)}</code>
      <p className="machine-note">Covers {covers}</p>
      <details>
        <summary>Show the full {name.toLowerCase()}</summary>
        <code className="machine-full">{value}</code>
        <button
          className="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
          type="button"
        >
          {copied ? "Copied the full value" : "Copy the full value"}
        </button>
        <p className="machine-note">{proves}</p>
      </details>
    </div>
  );
}

export function Instant({ value }: { value: string }) {
  const readable = readableInstant(value);
  if (readable === value) return <code>{value}</code>;
  return (
    <span className="machine-instant">
      <time dateTime={value}>{readable}</time>
      <code>{value}</code>
    </span>
  );
}

/**
 * What each gate tests, the unit its values carry, and how its threshold is
 * compared. Every gate in this rule passes at or above its threshold.
 */
export const GATE_READINGS = {
  PRICE_CHANGE: {
    unit: "bps",
    tests:
      "Peak price rise from the first eligible trade, in basis points (100 bps = 1%).",
  },
  AGGRESSIVE_BUY_SHARE: {
    unit: "bps",
    tests:
      "Share of eligible trade value (price × quantity) from BUY events, in basis points.",
  },
  ACTOR_CONCENTRATION: {
    unit: "bps",
    tests:
      "Share of BUY trade value from the approved actor group, in basis points.",
  },
  REPEATED_EXECUTION: {
    unit: "count",
    tests:
      "Number of approved-actor aggressive buys above the reference price.",
  },
  REMOVAL_SENSITIVITY: {
    unit: "bps",
    tests:
      "Difference in price-rise basis points when the approved actor group's trades are removed; a mechanical comparison.",
  },
} as const;

export type GateName = keyof typeof GATE_READINGS;

export function Bps({ value }: { value: string }) {
  const percent = bpsToPercent(value);
  return (
    <span className="machine-measure">
      {value} bps{percent === null ? "" : ` (${percent}%)`}
    </span>
  );
}

export function GateReading({
  gate,
  observedValue,
  threshold,
}: {
  gate: GateName;
  observedValue: string;
  threshold: string;
}) {
  const { unit } = GATE_READINGS[gate];
  if (unit === "count")
    return (
      <span>
        Observed {observedValue} · passes at {threshold} or more
      </span>
    );
  return (
    <span>
      Observed <Bps value={observedValue} /> · passes at{" "}
      <Bps value={threshold} /> or more
    </span>
  );
}

/**
 * What each canonical event field is, stated where the field is displayed.
 * Units come from the contract: prices and quantities are exact decimal
 * strings, and no source carries a currency, so none is shown.
 */
export const EVENT_FIELD_NOTES: Record<string, string> = {
  eventId:
    "Canonical identity: dataset, venue and source event identity joined. Not a hash.",
  sourceEventId: "The identifier the source assigned to this record.",
  eventTime: "When the source says the event occurred, in its own UTC offset.",
  price:
    "Executed price per unit, as an exact decimal string. The source carries no currency.",
  quantity: "Executed quantity, in units, as an exact decimal string.",
  sequence: "The source's own ordering value, not the canonical order.",
  rawRowHash: "Covers the exact serialized source row this event came from.",
};
