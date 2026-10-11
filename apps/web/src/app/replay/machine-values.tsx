"use client";

import React, { useState } from "react";

import type { Language } from "../i18n/language";
import { replayCopy, type GateName, type HashScope } from "./copy";
import { useReplayLanguage } from "./replay-language";

export type { GateName, HashScope };

/**
 * Machine values as a reviewer reads them: a hash with what it covers and what
 * a comparison proves, an instant in a readable form beside its canonical
 * string, and a basis-point value beside its percentage. The wording is the
 * replay copy's `machine` table, so a hash's scope changes in one place.
 */

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
  const language = useReplayLanguage();
  const text = replayCopy[language].machine;
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const { covers, proves } = text.hashScopes[scope];
  const name = label ?? text.hashScopes[scope].label;
  return (
    <div className="machine-hash">
      <span className="machine-label">{name}</span>
      <code className="machine-abbrev">{abbreviateHash(value)}</code>
      <p className="machine-note">{text.covers(covers)}</p>
      <details>
        <summary>{text.showFull(name)}</summary>
        <code className="machine-full">{value}</code>
        <button
          className="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(
              () => setCopiedValue(value),
              () => setCopiedValue(null),
            );
          }}
          type="button"
        >
          {copiedValue === value ? text.copied : text.copy}
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
 * The unit each gate's values carry. Every gate in this rule passes at or
 * above its threshold.
 */
const GATE_UNITS: Readonly<Record<GateName, "bps" | "count">> = {
  PRICE_CHANGE: "bps",
  AGGRESSIVE_BUY_SHARE: "bps",
  ACTOR_CONCENTRATION: "bps",
  REPEATED_EXECUTION: "count",
  REMOVAL_SENSITIVITY: "bps",
};

/** What a gate measures, in the reader's language. */
export function gateReading(
  gate: GateName,
  language: Language,
): { label: string; tests: string } {
  return replayCopy[language].machine.gates[gate];
}

/**
 * Reported rates are truncated to four fractional digits, while the engine
 * compares and subtracts the exact ratio. A reported value can therefore sit
 * just below a threshold it passes, and the panel says so rather than letting
 * the reported value be read as the comparison operand.
 */
export const reportedValueNote = (language: Language) =>
  replayCopy[language].machine.reportedValueNote;

export function Bps({ value }: { value: string }) {
  const unit = replayCopy[useReplayLanguage()].machine.bps;
  const percent = bpsToPercent(value);
  return (
    <span className="machine-measure">
      {`${value} ${unit}${percent === null ? "" : ` (${percent}%)`}`}
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
  const text = replayCopy[useReplayLanguage()].machine;
  const value = (raw: string) =>
    GATE_UNITS[gate] === "count" ? raw : <Bps value={raw} />;
  return (
    <span>
      {text.observed} {value(observedValue)} · {text.passesAt}{" "}
      {value(threshold)} {text.orMore}
    </span>
  );
}

/**
 * What a canonical event field is, in the reader's language. Units come from
 * the contract: prices and quantities are exact decimal strings, and no source
 * carries a currency, so none is shown.
 */
export function eventFieldNote(
  field: string,
  language: Language,
): string | undefined {
  return replayCopy[language].machine.eventFields[field];
}
