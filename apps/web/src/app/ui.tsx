import React, { type ReactNode } from "react";

export const RESULT_BOUNDARY =
  "Technical pattern support only — not a finding of guilt, a causal claim, investment advice, or an automated trading decision.";

export function ProvenanceChip({
  kind,
  children,
}: {
  kind: "source" | "proposed" | "approved" | "derived";
  children?: ReactNode;
}) {
  return (
    <span className={`provenance provenance-${kind}`}>
      {children ?? kind.toUpperCase()}
    </span>
  );
}

export function HashRef({
  label,
  value,
  full = false,
}: {
  label: "canonicalResultHash" | "sourceArtifactHash" | "eventId";
  value: string;
  full?: boolean;
}) {
  const shown =
    full || value.length <= 13
      ? value
      : `${value.slice(0, 8)}…${value.slice(-4)}`;
  return (
    <span className="hash-ref">
      <span>{label}</span>
      <code title={value} aria-label={`${label}: ${value}`}>
        {shown}
      </code>
    </span>
  );
}

export function Diagnostic({
  code,
  field,
  children,
}: {
  code: string;
  field?: string;
  children: ReactNode;
}) {
  return (
    <div className="diagnostic" role="alert">
      <strong>{code}</strong>
      {field ? <code>{field}</code> : null}
      <span>{children}</span>
    </div>
  );
}

export function ResultBanner({
  result,
  rule,
  children,
}: {
  result: "SUPPORTED" | "NOT_SUPPORTED" | "INCONCLUSIVE";
  rule: string;
  children: ReactNode;
}) {
  return (
    <section className="result-banner" data-result={result}>
      <header>
        <strong>{result}</strong>
        <code>{rule}</code>
      </header>
      {children}
      <p className="result-boundary">{RESULT_BOUNDARY}</p>
    </section>
  );
}
