# ADR 0025: Distinguish bounded windows from complete published series

## Status

Accepted.

## Context

The existing published FSC example fixes a completed date, market and first
page of 40 rows before inspecting values. That ceiling prevents choosing rows
for their values but cannot admit larger complete sources without a different
selection guarantee. Existing source bytes, recorded provenance and pinned
hashes must remain unchanged.

## Decision

Name the existing policy `bounded-window` and add `complete-series`, whose
selection guarantee is completeness for a scope declared before retrieval.
Use bounded windows for limited normalization examples and complete series
when every returned row for a named instrument, series or date is required.
Do not raise the first policy's ceiling to simulate the second.

Publish [the acquisition contract](../PUBLISHED_ACQUISITION.md). Strict logical
filter declarations permit one exact identity or date and no value predicates.
Publisher parameter binding and complete response decoding belong to reviewed
adapters; adapters are code, never untrusted executable metadata. No production
complete-series adapter or actual publisher behaviour is added here.

Freeze the date, filter, page size and request settings before transport. Save
all original pages and retain all rows in returned order. A successful receipt
requires sequential page numbers, an unchanged publisher total and exactly that
many rows. An inconsistent total or truncated page fails closed and calls for
design review; it is not repaired or reclassified as a bounded window. An
offline admission check re-derives rows and compares committed bytes, requests
and counts against all original pages. Synthetic transport and disk fixtures
exercise success and rejection without acquiring data.

Classify the already committed FSC artifact in a separate acquisition sidecar,
referencing its original provenance and source hash. This avoids rewriting its
historical record or inventing a pre-retrieval timestamp. Scope is evidence
metadata, never a mapping, approval or canonical event input. Existing event,
proposal, manifest and engine versions remain unchanged.

## Consequences

Permission must still be manually re-verified on the acquisition date; missing,
restricted or contradicted permission stops acquisition. Credentials remain in
the transport environment, errors do not disclose credential-bearing URLs,
and new output paths are reserved before consuming requests. Catchable failures
clean only new outputs; crash-atomic storage is not claimed.

The manual collector and offline admission mechanism exist. Admitting a future
source still requires a reviewed exact-selector/decoder adapter, source-specific
permission evidence and an original-response-based provenance record. No new
real artifact, canonical column mapping, rule, hypothesis or UI is introduced.
Completeness relative to a reported total is not snapshot stability or source
authenticity. Published-data ownership, synthetic defaults and offline CI remain
the existing boundaries.
