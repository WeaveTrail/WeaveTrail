# ADR 0083: Record and analyze mapping studies offline

- Status: Accepted
- Date: 2026-10-13

## Context

Issue #277 requires single-model and routed arms to share scoring and
non-model references, with independent selection and policy-evaluation inputs.
The existing selector accepts only its historical corpus, candidate and stack
combinations. The new mapping-study drafts remain unsealed, with unresolved
review and lineage findings. No new paid experiment is authorized by this change.

## Decision

Add separate versioned study run, route, protocol and bundle contracts and
an offline scorer and selector. Historical records, selectors, decisions and
live-command gates remain in force. Study records carry family, input, protocol,
session and phase bindings. Volatile session IDs remain in validation bindings
and stay outside canonical evidence and selection-summary hashes. GRID and LIVE_ROUTE attempts are distinct; a live
operating sample is never pooled into the grid's quality estimate.

Protocols supply candidate identities, stacks, original-byte hashes, frozen
DEV reference configurations, tariffs, repeats and analysis configuration.
B0 and B1 run automatically beside every model comparison and cannot be
selected. The new selector retains the strengthened eligibility conditions
and historical primary and escalation ordering; across providers its final
tie-break uses the unique candidate ID fixed in the protocol.

Offline route reconstruction reads the primary's provider, structural and
approval-readiness disposition, never gold or the escalation answer when choosing
whether to escalate. It references complete recorded attempts by canonical hash.
Gold is used afterwards for scoring. A completed response after the route deadline
cannot improve the route's safe-completion count. Synthetic latency is an estimate
from paired elapsed times; actual route latency belongs to a separate sample.
Conditional route resources and all recorded research resources are reported
separately. No synthetic record invents a provider failure to represent a withheld
proposal.

Family analysis uses exact rational macro differences, stratified paired cluster
resampling, a SHA-256 counter stream with rejection sampling and inverse empirical
CDF quantiles. Repeats and variants stay together. A degenerate interval retains
its warning. The zero-event one-sided binomial bound uses integer power comparisons
and returns a conservative rational bracket, separately from the bootstrap.

Completed sessions require the entire declared grid. Stopped sessions retain
observed failures and explicit missing coordinates; they cannot select a model.
Unsealed or unaudited input bindings produce exploratory output. Even a decision
with registered input attestations has activation disabled. This tooling does not
create approvals, call providers, admit a corpus seal, authorize paid work or
replace the site's committed decision.

## Consequences

The authored controls reproduce byte for byte offline and carry no model
performance claim. They are derived synthetic scorer inputs, not independently
reviewed evaluation sets. Accepted equivalent assignments remain diagnostic;
canonical strict scoring does not change. Future publication still needs a sealed,
independently reviewed set, an audited pre-run protocol, authorized execution,
recorded environments and a result audit. Runtime routing and reuse remain separate
work. The shared historical metric function is exported without changing its
arithmetic or denominator definitions.
