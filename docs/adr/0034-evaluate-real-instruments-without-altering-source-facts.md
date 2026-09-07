# ADR 0034: Evaluate real instruments without altering source facts

## Status

Accepted

## Context

The real-data provenance rule said both that a committed real artifact carries
no fabricated attribute and that no invented hypothesis or pattern verdict may
be attached to a real instrument. That wording allowed two readings. It could
prohibit only writing claims the source does not carry into source or derived
rows, or it could prohibit any rule from evaluating a real instrument.

The first reading is the repository's implemented boundary. A cross-market
session-reversal regression test evaluates fixed, licensed KOSPI 200 index and
futures rows and pins a `SUPPORTED` engine output using generated approval
fixtures. Separately, the published web case uses committed mapping approvals,
asks the visitor to approve the exact case scope before the server runs it, and
links each observed gate value back to the thresholds' origin. Its API verifies
the approval decision and exact scope hash but does not authenticate who created
the record. The source rows remain unchanged in both. Reading the provenance
rule as a ban on every evaluation would contradict the accepted engine decision
and published worked case.

The distinction still needs a narrow boundary. A computed result must not be
made to look like a publisher fact, an allegation about a person, or evidence
for a broader conclusion than the declared technical pattern.

## Decision

The narrow reading governs. A committed real source artifact and every derived
source row may contain only published attributes and deterministic
transformations whose provenance and reproduction are recorded. They may not
gain an invented participant, trade side, actor, hypothesis or verdict.

A versioned deterministic rule may separately evaluate a real market index or
contract. A user-visible result, or one retained as case evidence, may report
`SUPPORTED`, `NOT_SUPPORTED` or `INCONCLUSIVE` for a declared pattern
hypothesis only when all of these conditions hold:

- the instrument is a market index or contract, not an identified participant;
- no participant, actor group, trade side or order is invented or attached;
- an explicit `APPROVED` record binds the complete instrument, date/range and
  rule scope by hash before the rule runs;
- the configured thresholds and their provenance are displayed beside the
  observations they are compared against; and
- the result is identified as the output of the named rule and version under
  that approved scope, and claims no guilt, legal violation, causality,
  detection quality or investment suitability.

The case manifest contains the rule configuration it approves. That combined
artifact and its evaluation remain separate from the retained response, source
artifact and derived source rows; none alters the publisher's claims. Models may
not choose the result, and the existing licence, traceability, exact-arithmetic,
approval and canonical-hash requirements remain in force.

An `ApprovalRecord` proves that an `APPROVED` decision was supplied for one
exact artifact; it does not by itself authenticate a person. The current
published-case API enforces the record, decision and hash boundary but has no
reviewer authentication. Audit-grade use must establish human identity and
authorization outside this prototype.

A deterministic regression test may generate approval fixtures and pin an
engine output over admitted real rows. Those fixtures test validation and
hashing; they do not record a person's review. The resulting golden is neither
an approved case nor evidentiary output, and public material may not cite it as
satisfying the safeguards above.

Alternatives rejected:

- Prohibit every rule evaluation over a real instrument. This would require
  removing or rescoping the accepted cross-market engine golden and published
  case without improving the integrity of the retained source bytes.
- Permit arbitrary real-instrument evaluation whenever provenance exists.
  Provenance alone does not prevent invented actors, retrospective scope or
  thresholds, or claims that exceed a technical pattern result.
- Store the hypothesis or result on the real source rows for convenience. That
  would erase the boundary between publisher facts and repository-authored
  evaluation.

## Consequences

The committed cross-market golden remains permitted only as deterministic
regression evidence. Because it creates test approval fixtures and does not
display threshold provenance, it is not evidence of an approved scope and is
not a published case result.

The published web case remains permitted because its mappings have committed
reviewed approvals, the browser obtains an explicit exact-scope approval record
before the server runs it, and every gate links to the threshold origin. Its
result demonstrates that one versioned rule was satisfied under the supplied
approved scope; it is not authenticated review evidence, an attribute of the
KOSPI 200 or its futures contract, or a general statement about the market.

Future real-instrument cases must meet every condition above. A participant-
identified instrument, invented actor or side, unapproved scope, missing
threshold provenance, or broader interpretation is not eligible for this
permission and must fail closed or remain outside the repository.

ADR 0021 continues to govern whether real source material may be committed.
ADR 0032 continues to govern the cross-market rule itself. This decision only
settles the boundary between source facts and a separate deterministic
evaluation; it changes no runtime behavior, contract, hash scope, ordering rule
or result vocabulary.
