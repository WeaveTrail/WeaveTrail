# ADR 0012: Use a paper-first provenance-aware workbench

## Status

Accepted

## Context

The web application exposed real approval and replay behavior through unrelated
page-level styles. Authorship and result meaning were therefore harder to scan,
and operational refusal could be confused with a valid hypothesis result.

## Decision

Use a shared paper-first visual language with small radii, hairline borders,
monospace machine values, a 56px app bar, and a 252px navigation rail. Encode
authorship by border style before color: dashed slate for an AI proposal, solid
teal for human approval, and solid ink for versioned-code output.

Keep result colors separate from provenance. `NOT_SUPPORTED` stays neutral and
red represents only fail-closed refusal. Responsive layout stacks evidence
without hiding gates or exact values, and reduced-motion preferences are
honored.

## Consequences

The UI makes review authority legible without changing contracts, calculations,
hashes, or replay behavior. New evidence surfaces must reuse these semantics.
Planned export, full source-row inspection, and workflow history cannot appear
active until their runtime contracts exist.
