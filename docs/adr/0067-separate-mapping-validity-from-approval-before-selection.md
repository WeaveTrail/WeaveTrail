# ADR 0067: Separate mapping validity from approval before selection

- Status: Accepted
- Date: 2026-10-08
- Supersedes: [ADR 0066](0066-declare-the-mapping-model-selection-rule-before-the-held-out-run.md)
  for the validator version and sealed selection inputs, before any model run.

## Context

Adding `eventType` to the corpus exposes a second impossibility in the original
selection protocol: `mapping-validator/1` rejects every `REVIEW_REQUIRED`
field with `REVIEW_STATUS`, including a correct abstention on an unresolvable
column. Such gold cannot be a `VALID` run. F-003 in the
[AI failure log](../AI_FAILURE_LOG.md) records the reproduced failure.
ADR 0066 permits only hash filling in its amendment and requires a superseding
ADR for any other change. No HELD_OUT provider record has been collected, and
no prompt or selection rule has been tuned from model results.

## Decision

`mapping-validator/2` separates structure from approval readiness.
`validateMappingStructure` checks the envelope, field contract, source binding,
column coverage and order, target uniqueness and required targets, transform
compatibility and a dry run on every supplied sample. A sound abstention or
low-confidence proposal is structurally valid. `VALID` in a new mapping-run
record means this gate passed; it does not mean correctness, approval or replay.

`validateMappingOutput` retains the existing approval-readiness gate after
structure: any `requiresMappingOverride` field returns `REVIEW_STATUS`.
`validateConfiguredProposal` and the provider's live `propose` method retain
that gate. The evaluation `attempt` method records structural outcomes with
review status and confidence unchanged. Human approval and override contracts
are unchanged. Required targets still cannot be absent, even by abstention.
Historical v1 records and baseline captures keep their original semantics.

Adopt **all** eligibility thresholds, primary and escalation formulas,
tie-breaks, k = 3, five requested candidates, no-model outcome, and post-run
publication and invalidation rules of ADR 0066 unchanged, with one added
eligibility condition: every run in the candidate's grid must retain parsed
output. `mapping-score/1` can count followed injections and invented fields only
in retained output, so a provider failure or an unparseable or non-retainable
response would otherwise count as zero. Unobserved safety behavior makes the
candidate ineligible instead. Because a v2 `VALID` run may now retain fields that
need review, the primary-failed and correct-decision definitions keep their v1
meaning through approval readiness: a resolvable gold decision whose retained
field `requiresMappingOverride`, including a `PROPOSED` field below confidence 1,
makes the dialect primary-failed and is not an exact match for A or B.
The only configuration
version change is validator `mapping-validator/2`. Prompt `schema-mapping/1`,
output schema `mapping-fields/1`, adapter `openai-compatible-mapping/1`,
temperature 0 and scorer `mapping-score/1` remain fixed.
The single provider is Google (`google`) at
`https://generativelanguage.googleapis.com/v1beta/openai`, matching the price
source. Model IDs must be checked against the provider catalogue on the UTC
run date; the operator's dated attestation is copied into the session receipt.
Reported IDs, including preview IDs, are retained exactly. Unknown price
identities and missing usage have unknown cost and rank after fully priced runs.

### Sealed pre-run inputs

These values are fixed before any HELD_OUT model record:

| Input                                  | Version                               | SHA-256                                                            |
| -------------------------------------- | ------------------------------------- | ------------------------------------------------------------------ |
| HELD_OUT original bytes                | `schema-dialects/2`                   | `6d8f1c2c4c6dacacd406cef351250869b01c58771e0ed0a4c07858cfe699e6e3` |
| DEV original bytes                     | `schema-dialects/2`                   | `9260c8bcfe565d4bcffd1f53cfbc09dd4b874afcc750f6b76a80f97b8cda0d0b` |
| Vocabulary canonical JSON              | `lexical-baseline/2`                  | `a4688918c29595d67c12e9bd8873e02c2475e02fcf92f26737a38d93ef9868a4` |
| Prices original bytes                  | `google-gemini-standard-2026-10-08/1` | `d24dcce6cb6b48bebe396df378034ceb2bb43a45e0532537a070f60ee6fe1371` |
| Prices canonical JSON (scorer binding) | same                                  | `0e748c25bed4461ea75dd5f5808ad8409333a4611f1fda1ba9a822a14c22feb7` |

The [protocol](../../packages/evals/fixtures/mapping-selection-v1/protocol.json)
also seals original vocabulary bytes. `lexical-baseline/2` freezes the v1
algorithm from v2 DEV only; HELD_OUT never enters vocabulary construction.
Every dialect maps all four required targets and has one tag per decision,
retaining all seven tags. Constant-placement attacks move to headers because
the fixed adapter transmits only columns and sample rows. Corpus provenance
records this change rather than claiming unexposed attacks were evaluated.

The dated price table covers uncached Standard text, at most 200,000 input
tokens, including thinking output. Other tiers and larger requests are outside
scope. Prices are estimates, not invoices. The original Google response,
CC BY 4.0 attribution and deterministic integer extraction are committed beside
it. Gemini 3.8 Flash introductory prices end on 2026-12-31.

### Execution and application

`eval:models:held-out --live --catalogue <attestation.json>` checks the seals,
committed protocol and accepted ADR, clean tracked implementation, fixed
provider and full candidate list before transport. CI cannot call providers.
Every dialect is attempted three times per candidate. Each attempt and its
hash-linked `mapping-held-out-receipt/1`, which adds the session ID to the
`mapping-run-receipt/1` fields, are written immediately and exclusively;
a session receipt binds the catalogue attestation, the fixed provider and
endpoint, checkout and environment.
An interrupted session retains its attempts; its incomplete grid cannot be
selected. Each invocation creates a new session, never overwrites a prior run,
and does not resume or merge partial sessions automatically.

Each grid cell has exactly one attempt per session, and only the first session
invoked against these sealed inputs is selected. A later session may run only
after the earlier one's interruption is recorded in the AI failure log, and
only the first complete session counts. The result amendment lists every
session ID with its receipt hash, including interrupted ones. The command
cannot see sessions on other machines, so this policy is procedural; retained
receipts make a violation auditable.

`eval:mappings:select --session <session directory>` is offline. It accepts only
one session directory, checks each record against its receipt and the session's
protocol hash, rejects a receipt naming another session, unreceipted files or a `records.json` that differs
from the receipted attempts. It checks sealed
inputs, versions, candidate identities and the full five-model dialect-by-repeat
grid; it revalidates records marked `VALID`. It applies the unchanged rule with
BigInt cross-products and costs, emits the comparison including the frozen
reference, and emits the existing `mapping-selection/1` record with every tag
difference. Because that record does not distinguish roles, a versioned
`mapping-selection-decision/1` file names primary and escalation roles,
eligible candidates, primary-failed dialects and the separate A and B counts,
and binds the session ID and receipt hash, the comparison hash and the
`mapping-selection/1` hash.
A no-model result has an empty selected list. No result enables the live AI path.

## Consequences

Structural validity and approval readiness now have explicit separate meanings.
Consumers must use the record's validator version; v1 and v2 validity rates
are not interchangeable. Retained fields preserve abstention and uncertainty
for scoring without authorizing any execution. Tests exercise gold through
structure and prove the live review gate still rejects uncertain proposals.

This commit prepares infrastructure and the pre-run protocol only. Actual
provider runs, selected models, result amendment and bilingual measured
comparison remain future work. The single-provider, synthetic corpus,
public-holdout exposure, shared templates, three-repeat and cost-estimate
limitations from ADR 0066 continue to apply. After any v2 HELD_OUT model record,
a prompt, schema, adapter, validator, candidate or rule change must mark v2 used
in the failure log and introduce a fresh sealed corpus and pre-run ADR.
