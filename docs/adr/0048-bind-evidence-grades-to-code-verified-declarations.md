# ADR 0048: Bind evidence grades to code-verified declarations

- Status: Accepted
- Date: 2026-09-16

## Context

The public surface needs one of five evidence grades on each displayed
sentence or number: quoted, recomputed, differs, not confirmable, or AI
interpretation. The names are presentation vocabulary, not replacements for
the internal `SUPPORTED`, `NOT_SUPPORTED`, and `INCONCLUSIVE` result values.

A structural contract alone cannot award a code-backed grade. A caller could
declare text that differs from a source span, attach a value that was not
recomputed, or say that data is absent when the approved dataset contains it.
Free-form missing-data prose also crosses the trust boundary: a finite word
blacklist cannot prevent a caller from introducing a legal, causal, or factual
verdict.

The authority split in
[ADR 0001](0001-ai-proposes-deterministic-code-decides.md) requires models and
callers to propose declarations while versioned code decides whether the
evidence supports the requested grade.

## Decision

Add an opt-in Evidence Grade `1.0` discriminated union. The contract is closed
over `QUOTED`, `COMPUTED`, `DIFFERS`, `UNCONFIRMABLE`, and `INTERPRETATION`.
Parsing the union validates a declaration; it does not by itself verify or
award a code-backed grade.

Code-backed grades have a second verification boundary in the replay engine:

- `QUOTED` declares an immutable source-artifact hash and a nonempty UTF-8 byte
  range. Verification re-hashes the supplied artifact and compares the exact
  range with the displayed sentence. Format-aware document extraction and
  reversible HTML, PDF, or HWP coordinates are not implemented by this
  verifier.
- `COMPUTED` and `DIFFERS` declare the displayed decimal range, the reported
  value, a calculation identifier and explicit version, a display-template
  identifier, exact `eventId` and `rawRowHash` inputs, and the computed value.
  The contract binds the displayed range to the reported value and enforces
  equality for `COMPUTED` and inequality for `DIFFERS`. Verification resolves
  the code-owned calculation by both identifier and version. Each registered
  input is a canonical event paired with its `SourceRow`: the verifier derives
  the event ID from its source identity, parses the row through the canonical
  source-trace row contract before hashing or duplicate detection, re-derives
  the row hash, requires both values to match the event and declaration, and
  rejects duplicate event IDs or source coordinates. It orders the
  authenticated event-row pairs by `eventTime -> sequence -> eventId`, rejects
  mixed sequence presence, and freezes isolated row snapshots. It then passes
  those exact canonical snapshots to the calculation and compares the result
  with the attached computed value. `DIFFERS` additionally
  requires a code-owned resolver to read the reported side from those trusted
  rows; callers cannot invent that value. Verification then renders the
  selected code-owned template and requires the entire text and value range to
  match, so an unverified second claim cannot be appended to the graded
  sentence. Data can select registered identifiers; it cannot supply
  executable calculation, reported-value, or display logic.
- `UNCONFIRMABLE` declares a closed reason code and a missing-evidence check
  identifier, explicit version, display-template identifier, and approved
  dataset hash. Verification resolves the code-owned check by both identifier
  and version, canonicalizes and freezes an isolated dataset snapshot,
  authenticates that exact snapshot, and awards the grade only when the check
  reports that the required evidence is absent. The complete displayed claim
  must match the selected code-owned template, while user-visible reason
  fragments come from bilingual application copy keyed by the closed code;
  neither comes from caller-authored prose.
- `INTERPRETATION` records either a validated model proposal reference or that
  the sentence is not a data question. It carries no claim of code-backed
  confirmation.

The grade describes the verification relationship, not the provenance tier.
Calculated inputs may be synthetic fixtures or admitted real sources, so the
presentation calls them verified source data rather than implying that every
registered calculation uses public data. Provenance is declared and presented
separately.

Every successful code-backed verifier returns a branded, deeply read-only
value and freezes the complete parsed sentence before returning it. Retained
verified values therefore cannot be changed into a different claim without
crossing the verification boundary again.

Presentation keeps internal grade and result codes out of visible, assistive,
and tooltip text. The badge component requires a branded verified sentence for
every code-backed grade; only `INTERPRETATION` can render without one. It renders
the fixed bilingual names and required companion text, and derives the
`DIFFERS` recomputed value and `UNCONFIRMABLE` reason from that verified
sentence. The tally uses the contract order and omits zero-count grades.

Adding a missing-data reason requires adding a contract code, both language
entries, and parity tests together. Changing the meaning of a calculation or
absence check requires a new explicit version. Registries retain implementations
under both stable identifier and version, so retained evidence resolves its
original implementation instead of being reinterpreted by the newest version.

## Consequences

The contract can carry untrusted declarations across package boundaries, while
only the matching replay-engine verifier can establish a code-backed grade.
Consumers must not render `QUOTED`, `COMPUTED`, `DIFFERS`, or `UNCONFIRMABLE`
from schema parsing alone.

The first closed missing-data reason covers daily quotes that contain no time
of day. More reasons require reviewed code and bilingual copy rather than
free-form text. This is deliberately less flexible than arbitrary prose and
fails closed for an unsupported explanation.

Evidence Grade `1.0` is new and opt-in. Existing replay, result, event, and
Evidence Bundle contracts require no migration. A future incompatible change
uses a new evidence version instead of silently changing `1.0` semantics.
