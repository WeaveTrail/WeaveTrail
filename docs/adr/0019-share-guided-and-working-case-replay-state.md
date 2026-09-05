# ADR 0019: Share guided and working Case Replay state

## Status

Accepted

## Context

The original entry surface asked for mutations before introducing the source
or approvals, and its foundation-only default did not demonstrate a rule result.
A visitor needs to follow one committed case through the existing trust gates
and inspect the source rows supporting its findings.

## Decision

Use **Case Replay** at `/replay`, retaining **Workbench** as the navigation
group. The overview starts `/replay?mode=guided`. Remove the former `/lab` page
without an alias, and update current entry instructions.

Both modes use the same server-prepared scenarios and client approval, request
and result implementation. Guided mode selects the supported case and baseline
mutation. Its progress is presentation state, separate from the request-local
server workflow. Query parameters never supply approvals or results.

The committed Dialect B source supplies a separate mapping review example.
It has no rule manifest. An isolated instance of the same mapping implementation
requires a justified reason, hashes its own proposal, and revokes approval when
the reason changes. Only completion status reaches the parent guide. The main
case requires its own mapping and case approvals; fixture approval records are
stripped during server preparation.

The guide requires a returned case evaluation and source trace, a finding
disclosure, and a second real execution. It compares returned hashes as strings.
It switches the mounted surface into working mode and updates browser history
without recreating the approved case. Refresh starts unapproved; no workflow
state is persisted. Dependent evidence is invalidated on input or approval
changes, and generation checks discard superseded hash and request completions.

## Consequences

The entry journey can exercise implemented behavior without an alternate replay
engine or automatic approval. Working mode retains advanced event mutations;
they still operate after mapping and do not mutate source rows. Old route links
need updating. Source trace is inspectable evidence, not independently verified
bundle export, and same-input repetition does not demonstrate real-market
accuracy or authenticity. Live proposals and portable bundle verification remain
planned. Browser verification and unaided newcomer comprehension are distinct
acceptance checks.
