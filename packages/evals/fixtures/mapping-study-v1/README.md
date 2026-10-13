# Unsealed synthetic mapping study drafts

Status: **UNSEALED; original independent review applied with unresolved lineage
findings; replacement inputs require independent review**.
These inputs implement the authoring allocation of
[the family/gold specification](../../../../docs/MAPPING_CORPUS_SPEC.md) and
[ADR 0081](../../../../docs/adr/0081-generate-unsealed-mapping-study-inputs-for-independent-review.md).
They are not approved evaluation evidence, model observations or a frozen study.
The current `NO_MODEL` decision remains unchanged.

| Split  | Proposed families | Concrete inputs | Purpose after review and sealing                     |
| ------ | ----------------: | --------------: | ---------------------------------------------------- |
| SELECT |                24 |              24 | Select eligible model identities                     |
| AUDIT  |                60 |              60 | Independently evaluate a fixed policy                |
| DRIFT  |                12 |              84 | Twelve bases and six parent-relative follow-ups each |

SELECT/AUDIT allocate 2/5 proposed families to each of twelve cells, giving
8/20 per stratum. The generated `preflight.json` reports actual family and column
tag/attack denominators. These inventory counts are deterministic construction
checks, not a power calculation or accuracy measurement. Three repeated model
calls per input remain a planned run design and are not generated observations.

Reproduce with Node 22.13 or newer and pnpm 10.33.2, using the repository lockfile:

```bash
pnpm eval:corpus:generate
pnpm eval:corpus:check
pnpm eval:corpus:seal:check # expected failure until independent review blockers are resolved
pnpm exec vitest run packages/evals/src/mapping-corpus.test.ts
```

Generation writes `dist/mapping-study-unsealed/`. Verification generates twice,
checks every deterministic JSON byte, rejects unexpected files (including stale
JSON in subdirectories), and fails without updating expectations. Both
write a separate actual `generation-receipt.json` with time, checkout, tracked
dirty paths, Node/pnpm/platform/architecture and the manifest hash. The current
capture receipt is retained here; the original capture is hash-bound at its immutable source commit in the separate [review baseline](../mapping-study-review-v1/README.md); deterministic reproduction excludes its
volatile environment metadata but validates its strict shape, original bytes
against `generation-receipt.sha256`, and binding to the current manifest hash.
The receipt and its checksum are explicit exceptions to deterministic regeneration;
the authored README is outside generated JSON checks. Checksums establish byte
integrity and binding, not authenticity of environment metadata. After a deliberate authoring correction, explicitly
use `pnpm eval:corpus:generate --output packages/evals/fixtures/mapping-study-v1`
and review the changed inputs, gold, manifest and receipt together.

The generator (`mapping-study-generator/2`, seed `weavetrail-study-2036-a`) renders
[separately authored briefs](../../src/mapping-corpus-authoring.ts). Seeds shuffle
headers independently of gold targets. Two fictional sample rows carry every
discriminating clue; no fact depends on an untransmitted ninth row or constant.
The input hash is SHA-256 of UTF-8 `JSON.stringify(projection)` in contract key
order; original artifact hashes bind the exact formatted file bytes. Money and
quantity values remain strings throughout generation and validation.

| Artifact                                | Contents and boundary                                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*.inputs.json`                         | Offline IDs/hash bindings and a strict `projection` of opaque column IDs, headers and bounded sample rows; only `projection` is task-specific provider input                       |
| `*.gold.json`                           | Ordered canonical tuples, exact visible coordinates, alternatives, attacks, absent required targets and expected validator/disposition witnesses; never provider input             |
| `families.json`                         | Source conventions, event kinds, problems, lineage declarations, evidence/alternatives and pending authoring records; the applied review lives in the separate ledger              |
| `drift-relations.json`                  | Base-relative local detector labels, global mapping witnesses and separate visible/hidden semantic truth; follow-ups are not independent families                                  |
| `base-approvals.json`                   | Generated correct-base proposal/approval fixtures; never observed humans or model-created approvals                                                                                |
| `overlap-report.json`                   | Prior byte hashes, header/slot/grammar/lineage/decoded-attack diagnostics and explicit within-family duplicate exemptions                                                          |
| `review-ledger.json`, `exclusions.json` | Applied original decisions, unresolved lineage, and old/new input and per-record gold hash bindings for replacements, plus lineage fingerprints; no replacement reviewer signoff   |
| `exposure-ledger.json`                  | Honest public/authoring exposure boundary; no secrecy claim or model-performance evidence                                                                                          |
| `seal-readiness.json`                   | Unresolved lineage and changed-input/gold review blockers; no measured family-count claim                                                                                          |
| `preflight.json`                        | Author consistency checks with the existing validators, applied original-review status, separate pending replacement-review status/family IDs, and remaining implementation limits |
| `manifest.json`                         | Draft-byte/source/specification/lockfile and original review-baseline hashes; `UNSEALED`, never a measurement seal                                                                 |

Correct SELECT/AUDIT answers all pass the structural validator, including review
families whose optional null fields require human review. Resolvable families
have no irrelevant null decoy. Canonical transform tuples are fixed before runs;
the equivalent transforms accepted in the original review are complete diagnostic
assignments of `(columnId, targetField, transform, status)` tuples, in canonical
column order. They include all combinations; headers are fixed by input/canonical
gold. They do not relax strict scoring or eligibility. Names and plausible
competing roles now appear in mapped-column alternatives. HARD_RESOLVABLE is a
construction label; glosses remain and no difficulty is measured. Validator
acceptance does not establish semantic correctness or create an approval.

DRIFT follows the required/optional add/remove allocation, with six supported
and six unsupported representation changes. The old transform fails on visible
representation witnesses. Six same-shape changes have a visible ACT-/CP- prefix
clue outside dry-run validity; six are unobservable and keep input-based gold
identical while hidden scenario truth differs. The latter cannot establish model
rescue. Identical and hidden follow-ups deliberately share their base input hash.
Every follow-up is a new task requiring approval; generated relation labels do
not implement the later reuse workflow or make base approvals reusable.

The overlap report exposes shared semantic slot and naming-grammar signatures.
These require independent semantic and lineage decisions; 96 proposed briefs
must not be reported as 96 established independent families. Source templates
found to be shared must be redesigned or the independent count revised before
sealing. It compares prior DEV and used v1/v2/v3 corpora, plus v4 DEV; v4 HELD_OUT
is never opened by this generator. Exact strings/hashes alone cannot prove a
family was never seen in training.

All values and payloads are fully synthetic, authored for this repository under
its Apache-2.0 contribution terms, with no real data or third-party source.
Payloads are inert data; rendering/validation never decodes them as instructions
or executes them. The [original independent review](../../../../docs/MAPPING_STUDY_V1_GOLD_REVIEW.md)
is applied, including diagnostic equivalents, required-removal reasons, replacement
headers and seeded changed-column positions. Its 28 MUST_REVIEW and 12 DRIFT
lineage rejections remain unresolved. Changed provider bytes are not approved by
that old review: `exclusions.json` records the replaced hashes, source commit and
new input bindings. `seal-readiness.json` records the blockers;
`pnpm eval:corpus:seal:check` fails without writing a seal. A MUST_REVIEW redesign
also needs reviewed coverage floors; none are lowered here. Sealing, new-run scoring
integration, full reuse assembly and audited pre-registration remain planned. No calls, latency, cost savings, model quality or human time are measured.

Review binding migration: baseline `/2` adds original-family lineage fingerprints;
review payload `/2` adds current family hashes and changed-lineage blockers.
`exclusions.json` uses `replacementRecords` in place of `replacementInputHashes`,
with both `inputHash` and `goldSha256` per dialect. Gold hashes cover UTF-8
`JSON.stringify` of the complete contract-ordered gold record, including whole-input
expectations and diagnostic alternatives. The aggregate artifact hashes still bind
original formatted file bytes. Source inputs and canonical gold are unchanged.
Alternative assignments must use compatible transforms and only the closed B3
equivalences; preflight validates their sample domains, shared-validator outcomes
and normalized-event equivalence for complete offerable inputs. See
[F-011](../../../../docs/AI_FAILURE_LOG.md#f-011-diagnostic-gold-accepts-an-unreviewed-alternative-transform).

The contract also requires the exact complete reviewed alternative set, excluding
canonical transforms; array order is immaterial, but missing or duplicate
assignments fail. Preflight and review application reject records outside their
original reviewed partition, mismatched input/gold split labels or dialect
coverage, and family split mismatches. A nonempty `absentRequiredTargets` list
requires `REQUIRED_TARGET_ABSENT`. The review ledger validates gold before
reporting B3/N1 as applied. These checks preserve input and gold artifact bytes;
the manifest source hashes and capture receipt bind the updated validation code.
See [F-012](../../../../docs/AI_FAILURE_LOG.md#f-012-applied-review-claims-survive-missing-evidence-and-split-changes).
