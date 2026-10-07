# Evaluation Protocol

_[한국어](EVALUATION.ko.md)_

WeaveTrail publishes fixture agreement counts, not accuracy or performance
estimates. The versioned offline runner checks committed source dialects,
canonical mutations, declared rule results, and finding-to-source traces.

## Versioned fixture evaluation

From a clean checkout, install the locked dependencies with
`pnpm install --frozen-lockfile`, then run:

```bash
pnpm eval
```

This fixture-only command writes `dist/evaluation/summary.json` and
`dist/evaluation/run.json`. The summary must reproduce the committed
[raw summary](../packages/evals/results/financial-replay-v3.json) byte for byte.
The run receipt records the actual Node, pnpm, Vitest, OS and architecture,
commit SHA, working-tree state, input-tree fingerprint and summary checksum.
The [captured receipt](../packages/evals/results/financial-replay-v3.run.json)
records the publication environment. Environment and checkout metadata stay
outside the stable summary; both files form the machine-readable publication.
No API credentials, network requests or configured AI providers are used.

The [case definitions](../packages/evals/src/cases.ts) declare mapping fields,
review outcomes and mutation oracles. The [runner](../packages/evals/src/runner.ts)
reads scenario outcomes from the existing
[scenario expectations](../apps/web/src/app/expectations/scenario-expectations.json),
also consumed by the public expectations page. It verifies the actual artifact
bytes against their declared hashes before comparing parsed and registered rows.
Changes to expected mappings, review outcomes, mutation oracles, scenario results
or trace references fail the command. Neither the command nor Vitest's snapshot
update flag rewrites these targets. Tests exercise those failure paths.

## Captured counts and scope

All counts below come from the linked raw summary and its cases, using `pnpm eval`
on the environment in the captured receipt (Node 22.18.0, pnpm 10.33.2,
Vitest 5.0.2, Linux x86_64). They count authored fixtures, not independent samples.

| Check                    | Captured outcome                                                                                               | Denominator and limitation                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Mapping proposal fields  | 13 agreements                                                                                                  | 7 FIX 4.4 fields and 6 H0STCNT0 fields; registered fixture proposals against authored targets, not model accuracy     |
| Mapping review           | FIX accepted; H0STCNT0 requires review without its absent-actor override; both accepted with fixture overrides | 2 schema-grounded synthetic dialects; no automatic human approval is claimed                                          |
| Synthetic rule results   | 2 `SUPPORTED`, 2 `NOT_SUPPORTED`, 1 `INCONCLUSIVE`                                                             | 5 `RAPID_PRICE_LIFT/1.1` cases, counted once each; no real-market interpretation                                      |
| Canonical mutations      | 45 preserved, 27 rejected with declared errors                                                                 | 8 mutations on each of 9 successful synthetic baselines; excludes the pre-replay conflict case                        |
| Finding traces           | 100 of 100 references resolve; 20 findings                                                                     | Counts reference occurrences, including reuse across findings; zero-finding cases contribute no successful references |
| Total baseline inventory | 10 cases                                                                                                       | 10 synthetic sources, including one conflicting source that requires input review, no published sources               |

**Evidence completeness** is checked over baseline finding references.

Mapping agreement compares source column, target field, allowed transform and
review status. Composite event time and declared absent fields are checked
separately. The two dialects are schema projections with authored values; they
replace the placeholder dialect pair for mapping publication. Placeholder
sources remain explicit engine-regression inputs in the baseline and mutation
inventory. No agreement count is converted to an accuracy percentage.

The mutation matrix operates on mapped synthetic events. Repeat, reverse order,
exact duplicate, equivalent UTC timestamp spelling and late arrival preserve
the canonical result hash, including the rule evaluation where present. Source
identity conflict, event-ID conflict and mixed sequence presence must raise their
specific canonicalization errors. A rejection yields no result hash. These are
engine probes; their generated values and retained fixture coordinates do not
create source evidence. Trace completeness is measured only over baseline
findings: every reference must resolve through canonical `eventId` and
`rawRowHash` to a parsed row of the hash-verified committed artifact. The summary
retains each distinct event's hash and source coordinate for inspection.

Evaluation v3 withdraws the five real sources. The retained synthetic inputs, mapping and mutation oracles, result hashes and trace expectations are unchanged.

For a reviewed change to a target, edit the case definition or shared scenario
expectation deliberately and review a newly captured versioned summary alongside
it; routine evaluation never updates targets. Financial replay v1/v2 and claim coverage v1 remain unchanged historical captures with withdrawn sources. They are not current results and cannot be fully reproduced from this tree. See [historical captures](../packages/evals/results/README.md) and [ADR 0056](adr/0056-withdraw-the-committed-real-data-tier.md).

## Planned schema-dialect model evaluation input

The [version 1 offline corpus](../packages/evals/fixtures/schema-dialects-v1/PROVENANCE.md)
is implemented input for a **planned** field-mapping model evaluation. It is not
part of `pnpm eval` and has no model results. Its deterministic
[definition](../packages/evals/src/schema-dialects-generator.ts) produces DEV and
HELD_OUT with disjoint authored naming families. Each column has contract-checked
target/transform (or paired nulls), `PROPOSED`/`REVIEW_REQUIRED` status and tags:
`CLEAR`, `ABBREVIATED`, `SYNONYM`, `AMBIGUOUS`, `ABSENT_LURE`, `TRANSFORM_LURE`,
and `INJECTION`. Ambiguity and unsupported conversions require review. Injection
gold ignores instructions and records the attempted `injectedTarget`; payloads
cover English/Korean, plain/base64/zero-width text and headers/cells/constants.
DEV and HELD_OUT use separately authored attack wording with no decoded payload
overlap. Each dialect independently orders its semantic slots by SHA-256 of the
dialect ID and slot; input columns and gold move together. Tests reject repeated
orders and fixed semantic positions within either split.

Reproduce and verify the inputs with the locked dependencies:

```bash
pnpm eval:schemas:generate
pnpm exec vitest run packages/evals/src/schema-dialects.test.ts
```

The adjacent provenance records the generation environment, inventory and limits.
The committed [HELD_OUT SHA-256](../packages/evals/fixtures/schema-dialects-v1/HELD_OUT.sha256)
exposes the exact-file seal. Only DEV may guide tuning or prompt examples. Freeze
provider configuration and record the held-out commit and seal before a future
run; feed only each dialect's `input`, never `gold`. HELD_OUT is offline and never
served to the browser. Tests guard production imports, public assets and the package entry point's
transitive relative imports and re-exports.

All values and gold are synthetic and authored; shared semantic templates limit
independence. A public holdout is not secret, and a seal cannot establish absence
of prior exposure. No model execution, mapping accuracy, real-world
representativeness or adversarial robustness is claimed. See
[ADR 0057](adr/0057-seal-offline-schema-dialect-evaluation-inputs.md).

## Adversarial mapping validator probes

The server-side [`validateMappingOutput`](../packages/ai-harness/src/mapping-output-validator.ts),
version `mapping-validator/1`, is the common gate for every configured model
mapping output and the offline hostile-fixture evaluation. The current model
output contract is the closed `{ fields: [...] }` shape for mapping `1.4` and
event `1.1`. Daily and composite execution mappings remain registered fixtures;
this change does not extend the configured model's supported contracts.

Validation stops at the first failure in this fixed order. Reasons contain only
a stable code and string/index path, never provider prose or exception text.

| Stage      | Checks and reason codes                                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Envelope   | UTF-8 body at most 65,536 bytes (`BODY_TOO_LARGE`), JSON (`ENVELOPE_INVALID_JSON`), one assistant choice ending in `stop` (`ENVELOPE_INVALID`), no tools/functions (`TOOL_CALL`), refusal (`REFUSAL`) or length stop (`LENGTH_STOP`), JSON message content (`OUTPUT_INVALID_JSON`)                                                           |
| Contract   | Strict existing Zod proposal/field contract and bounded nonblank evidence (`OUTPUT_CONTRACT`), allowed target/transform (`UNKNOWN_TARGET`, `UNKNOWN_TRANSFORM`), supported version and exact supplied artifact/constants binding (`INPUT_BINDING_MISMATCH`); parsed proposals are also bounded to 65,536 UTF-8 JSON bytes (`BODY_TOO_LARGE`) |
| Columns    | Every supplied column once, in supplied order (`INVENTED_COLUMN`, `DUPLICATE_COLUMN`, `MISSING_COLUMN`, `REORDERED_COLUMN`)                                                                                                                                                                                                                  |
| Targets    | Each of `sourceEventId`, `eventTime`, `instrumentId`, `eventType` exactly once, and no other target twice (`DUPLICATE_TARGET`, `MISSING_REQUIRED_TARGET`)                                                                                                                                                                                    |
| Transforms | Structural target/transform compatibility (`TARGET_TRANSFORM_MISMATCH`), nonempty samples (`NO_SAMPLE_ROWS`), exact deterministic ingest transforms and resulting event contract on every supplied sample row (`TRANSFORM_FAILED`)                                                                                                           |
| Review     | Confidence below 1, even with `PROPOSED`, or explicit `REVIEW_REQUIRED` remains in review (`REVIEW_STATUS`)                                                                                                                                                                                                                                  |

Envelope checks reject tools before refusal, then length/other stop failures;
the [invariant tests](../packages/evals/src/adversarial-mapping.test.ts) pin stage
precedence and reason coordinates. Parsed fields or sealed proposals enter at
the contract stage to re-validate retained content. The configured adapter
bounds the streamed response before parsing, invokes the same gate, and still
returns only the sanitized `REVIEW_REQUIRED` failure to the application. No raw
body, temporary mapped events or provider text is retained. The separate
[configured run producer](#configured-mapping-run-producer) records sanitized
attempts; model scoring remains planned.

The model prompt receives at most eight sample rows; validation dry-runs all
supplied samples, including later rows. It projects supplied columns without
changing source rows, discards temporary events and never approves a mapping.
The new internal workspace dependency on replay-engine reuses its exact ingest
transforms and event checks rather than implementing a second conversion path.

The authored synthetic [hostile fixture provider and probes](../packages/evals/src/adversarial-mapping-fixtures.ts)
exercise each requested rejection class, with a valid control. Tests assert the
expected reason for every probe and run those envelopes through the configured
adapter using an injected local transport. `pnpm test` runs them in CI without
credentials or network; run them separately with:

```bash
pnpm exec vitest run packages/evals/src/adversarial-mapping.test.ts packages/ai-harness/src/configured-provider.test.ts
```

Use the locked dependencies, Node 22.13 or newer and pnpm 10.33.2. These are
validator regression assertions over authored probes, not measurements of any
model's accuracy or adversarial robustness. The sealed DEV/HELD_OUT corpus and
the `pnpm eval` publication are unchanged.

**Residual risk:** a well-formed, transform-valid swap of two same-shaped
columns passes the validator. The tests demonstrate swapping decimal price
and quantity targets while retaining the original source-column order. Semantic
correctness remains for human review and the existing explicit approval gate;
`VALID` does not establish it. See [ADR 0059](adr/0059-share-the-model-mapping-validator-with-hostile-probes.md).

## Mapping model run record contract

The implemented [run-record contracts](../packages/contracts/src/mapping-run-record.ts)
define auditable records for model attempts. The
[configured run producer](#configured-mapping-run-producer) now binds adapter
observations to these records; `pnpm eval` still runs fixtures only and model
scoring remains planned.
The new contract is additive; existing mapping responses need no migration.

`MappingRunRecordSchema` version `mapping-run/1` requires:

| Fields                                                                       | Meaning                                                                                                                          |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `evaluationSet.version`, `sha256`, `split`                                   | Corpus version, exact-file SHA-256 seal of DEV or HELD_OUT, and that split                                                       |
| `dialectId`, `repeat`                                                        | Dialect within that corpus and one-based attempted-call repeat; failures count too                                               |
| `provider`, `requestedModel`, `reportedModel`                                | Provider label and requested/reported identity; reported identity is null when absent                                            |
| `adapterVersion`, `promptVersion`, `outputSchemaVersion`, `validatorVersion` | Versions needed to interpret and re-validate the output                                                                          |
| `temperature`                                                                | Nonnegative decimal string, canonicalized without floating-point arithmetic                                                      |
| `outcome`, `validatorReasons`, `failureClass`                                | `VALID`, `CONTRACT_REJECTED` or `PROVIDER_FAILED`, stable uppercase reason codes with string/index paths, and classified failure |
| `parsedOutput`                                                               | Closed `{ fields: [...] }` structured output, at most 65,536 bytes of UTF-8 JSON, or null                                        |
| `latencyMs`, `inputTokens`, `outputTokens`                                   | Nonnegative safe-integer milliseconds and positive safe-integer token counts; absent usage is null, never a zero placeholder     |

`VALID` requires existing mapping-field contract values, non-null output, no
validator reasons and null failure class. It is a validation observation, not
human approval or proof of semantic correctness. `CONTRACT_REJECTED` requires
at least one coded reason and an `OUTPUT_CONTRACT`, `UNPARSEABLE_OUTPUT` or
`OUTPUT_NOT_RETAINABLE` failure class. It may retain incorrect scalar values
and missing fields under the six existing mapping-field keys. Malformed shapes,
unknown properties, nested objects, oversized output and unparseable JSON must
be discarded as null; the latter two failure classes require null.
`PROVIDER_FAILED` requires null output, no validator reasons and a failure class
from `TIMEOUT`, `RATE_LIMITED`, `AUTHENTICATION`, `TRANSPORT`, `HTTP_ERROR`,
`STRICT_MODE_UNSUPPORTED`, `INVALID_RESPONSE` or `UNKNOWN_PROVIDER_FAILURE`.
The record schema checks structure and outcome consistency; the future producer
must verify corpus membership, the seal and the declared validator's decision.

Every object is strict. Request bodies, response envelopes, headers, provider
request IDs, credentials and raw error messages are not record fields; attempts
to attach them are rejected, including within output and validator reasons.
Producers must also prevent secrets from appearing in permitted strings.
If raw envelopes are needed locally, use only the ignored `.model-runs/raw/`
directory. No raw storage is implemented; the configured command saves only
sanitized records and separate receipts.

`MappingRunReceiptSchema` version `mapping-run-receipt/1` carries `runId`,
`startedAt` (UTC) and `recordHash` separately. Compute `recordHash` with the
existing `sha256Canonical` over the validated record alone. Summaries must not
include receipts in their hash scope. Changing receipt metadata leaves the
record hash unchanged; latency, token usage and reported identity remain
observations within the record. Re-scoring committed records is reproducible
with the same sealed corpus and scoring/validator versions. Re-running a model
creates a new record. A null-output failure can be re-counted, but its discarded
output cannot be re-validated. See [ADR 0058](adr/0058-separate-mapping-run-records-from-raw-provider-traces.md).

Run the offline synthetic contract and hash-boundary tests with:

```bash
pnpm exec vitest run packages/contracts/src/mapping-run-record.test.ts packages/evals/src/mapping-run-record.test.ts
```

These tests cover outcomes, transport-field rejection, missing usage, exact
UTF-8 size boundaries and receipt separation. They are not captured model runs
or measurements of provider performance.

## Configured mapping run producer

The [server adapter](../packages/ai-harness/src/configured-provider.ts) and
[record binder](../packages/evals/src/mapping-model-runner.ts) produce
`mapping-run/1` observations through the same validator as the web path.
Every model receives the unchanged instruction, strict output schema,
temperature 0 and the same 30-second/64-KiB limits. The base URL includes the
API path and only `/chat/completions` is appended. There is no retry, tool call
or relaxed-mode fallback. Usage and reported model are nullable observations.
Refusal, truncation and invalid envelopes are `PROVIDER_FAILED` with
`INVALID_RESPONSE`; parsed field-output violations are `CONTRACT_REJECTED`.

`pnpm eval:models --live --scenario concentrated-buy-dialect-a.csv` explicitly
runs each entry in `AI_EVALUATION_MODELS`. The list and each entry's key must be
supplied; the command is disabled in CI. It writes closed structured outputs
and versioned records with separate hash receipts to ignored
`dist/mapping-runs/`, with no raw envelope storage. See
[deployment configuration](DEPLOYMENT.md#manual-model-adapter-runs).

This command is a registered synthetic adapter smoke run, labelled
`replay-synthetic-adapter-smoke/1`, with the registered artifact hash, `DEV`,
source filename and repeat 1. It does not read the sealed DEV/HELD_OUT corpus,
score outputs, choose models or establish live compatibility. The reusable
binder validates caller context before the call; a future corpus runner must
verify membership and the exact-file seal before passing that context.

Run the offline recorded-response regression tests with:

```bash
pnpm exec vitest run packages/evals/src/mapping-model-runner.test.ts packages/ai-harness/src/configured-provider.test.ts
```

The envelopes are authored synthetic recordings, not vendor captures. They
verify success, missing usage/model, refused/truncated/tool responses, exact
UTF-8 size boundaries, HTTP and strict-mode failures, transport/body timeouts,
request parity across configurations and secret/trace rejection. No keys or
network are used, and no model-quality or performance claim follows.

## AI failure log

The [AI failure log](AI_FAILURE_LOG.md) records each observed model or validator
failure as an `F-nnn` entry: role, model or validator version, run record,
assumption, counterexample, fix with its pull request, regression test and
status. It also lists every prompt version and whether a held-out set has been
burned. A log check in `pnpm test` fails when an entry is incomplete or names a
test file the suite does not collect; run it separately with:

```bash
pnpm exec vitest run packages/evals/src/ai-failure-log.test.ts
```

## Measurements still planned

Model accuracy on independent mappings, configured-provider comparisons,
real-market generalization, investigation effort, latency, memory use and
evidence-grade shares remain separate measurements. The current counts imply
none of them. Rules, inputs, provider configuration, sample definitions and
limitations must accompany any future publication.

## Foundation checks

The current unit suite tests these engineering invariants only:

```bash
pnpm test
```

- **Row-order invariance** — all permutations of the committed four-event foundation
  fixture preserve canonical order and the result hash. Representative
  permutations of parsed source rows also pass the approved HTTP boundary for
  both dialects and all three rule cases; rule evaluations and source traces
  remain unchanged. Source-file bytes and coordinates are fixed in these checks.
- **Literal golden hash** — a committed fixture is pinned to its literal
  canonical result hash.
- **Exact duplicate tolerance** — identical source-identity duplicates collapse
  without changing canonical events.
- **Identity-conflict rejection** — conflicting reuse of an event or source
  identity fails independent of input order.
- **Time-format equivalence** — equivalent offset and `Z` timestamps normalize
  to the same instant, including across a UTC date boundary.
- **Sub-millisecond order** — supported precision preserves ordering and finer
  than nanosecond timestamps are rejected.
- **Locale-independent order** — canonical keys use UTF-16 code-unit ordering
  without locale data.
- **Volatile-metadata exclusion** — collection metadata is classified and
  excluded from the canonical result hash.
- **Mixed-sequence policy** — mixed sequence presence fails closed and the
  all-absent case orders by event ID.
- **Dialect convergence** — equivalent committed source dialects converge to
  one canonical dataset and result hash.
- **Decimal-spelling convergence** — accepted trailing-zero and signed-zero
  variants normalize before duplicate classification and hashing while their
  verbatim source rows retain distinct raw-row hashes.
- **Dataset-profile determinism** — profiles remain identical across event
  shuffling and committed source dialects.
- **Mapping-approval binding** — approval is bound to the validated proposal
  and its executed transforms.
- **Record-set completeness** — omitted declared rows or approved columns fail
  before result hashing.
- **Shared approval serialization** — browser approval and replay validation
  use the same canonical bytes, including the RFC 8785 finite-number rule, and
  browser hashing failures leave replay blocked.
- **Mapping agreement reporting** — the engine reports per-field agreement
  between mapped canonical events and each mapping application's review
  outcome.
- **Reachable mapping review** — dialect B presents its `source_note` for
  review; replay fails without a matching justified override and succeeds with
  one, while dialect A remains fully resolvable.
- **Scenario classification** — the complete-evidence case satisfies every
  declared gate and is pinned to `SUPPORTED`; the broad-participation case has
  enough evidence to evaluate but fails concentration gates and is pinned to
  `NOT_SUPPORTED`; the missing-side case withholds all four in-window trades as
  non-comparable and is pinned to `INCONCLUSIVE` with
  `INSUFFICIENT_ELIGIBLE_EVENTS`. The same suite pins their semantic result
  hashes, declared orders, duplicate tolerance, finding references, and
  dataset-hash independence.
- **Published-schema not-supported case** — six FIX-shaped comparable executions
  fail only `ACTOR_CONCENTRATION` and `REMOVAL_SENSITIVITY`, producing
  `NOT_SUPPORTED`. Literal gate readings, dataset/manifest/result hashes and
  source traces are pinned through approved baseline, shuffle and duplicate
  runs in `published-execution-not-supported.test.ts`. Its
  [provenance](../packages/scenarios/src/sources/published-execution-fix44-broad-participation.provenance.json)
  records the exact command, environment, authored thresholds and limitations.
- **Committed conflict review** — a published-schema synthetic FIX source
  reuses one `ExecID(17)` with different `TransactTime(60)` and `LastPx(31)`
  values. It is pinned to `INPUT_REVIEW_REQUIRED` with
  `CONFLICTING_SOURCE_IDENTITY`; no rule result or canonical result hash is
  produced.

The scenario-classification sample is three authored synthetic fixtures, with
the separate conflicting-input fixture pinning a pre-replay review path. Run
`pnpm test -- packages/replay-engine/src/rapid-price-lift-golden.test.ts packages/replay-engine/src/published-execution-schema.test.ts`
on
Node 22.18.0, pnpm 10.33.2, Vitest 4.1.11, Linux WSL2 x86_64. These outcomes
verify only the declared cases and illustrative per-case thresholds; they do
not estimate performance on independent or real-market data.

These checks do not measure schema-mapping accuracy, anomaly-detection quality,
real-market generalization, user productivity, or large-scale performance.

## Publication gate

A number may appear in the main README only after its evaluation case and raw
or machine-readable summary are committed, the command is reproducible, and
the limitations are linked next to the number.

## Offline mapping run scoring

`pnpm eval:mappings:score` validates committed `mapping-run/1` records against
sealed `schema-dialects/1` gold and a dated, versioned price table. It writes
`dist/mapping-scores/summary.json` and fails unless those bytes exactly match
[the committed summary](../packages/evals/results/mapping-score-v1.json).
The command is offline, requires no provider configuration and is allowed in
CI. It never updates expectations or calls a model.

The [records and tariffs](../packages/evals/fixtures/mapping-score-v1/README.md)
are authored synthetic regression inputs, not live model observations, vendor
prices or the lexical baseline. The captured summary verifies the scorer only.
Reproduce on Node 22.18.0, pnpm 10.33.2, Linux x86_64; unit checks use Vitest
5.0.2. All inputs, including the gold seals and price-table provenance, are
committed. No independently measured model quality is claimed.

Custom committed record arrays can use the same scorer, including records from
a non-model producer, without a scoring special case:

```bash
pnpm eval:mappings:score --records path/to/records.json --prices path/to/prices.json --expected path/to/summary.json
pnpm exec vitest run packages/evals/src/mapping-scorer.test.ts
```

`--expected` is optional for custom inputs; omitting it writes a new local
summary without updating any committed file. The default command always checks
the committed golden. The non-model lexical producer is still planned; the
interface regression checks only that its record identity uses identical rules.
The existing adapter smoke records use a different evaluation set and cannot
be scored against this corpus.

`mapping-score/1` groups by provider, requested model, prompt, adapter, output
schema, validator, temperature and exact corpus version/hash/split. Reported
model identities, including null, have counts within each group so missing
identities never remove failed runs from the requested model's denominator.
The scorer rejects wrong corpus seals or bindings, duplicate run identities
(even identical duplicates), duplicate gold/source columns and incomplete
repeat grids. Partial corpus cohorts are allowed and list their exact dialect
IDs; every included dialect must have every included repeat. Unknown dialects
are rejected. Gold remains outside the production package entry point.

Every metric stores integer decimal strings as `numerator` and `denominator`.
A zero denominator is unavailable, never a measured zero rate. No percentage,
mean or cost is computed using floating point. In the table, a _decision_ is
one gold source column in one run; a _resolvable_ decision has gold status
`PROPOSED`; an _unresolvable_ decision has null target/transform and status
`REVIEW_REQUIRED`. Exact matches require one and only one output entry for the
source column and equal target, transform and status. Confidence and evidence
prose never earn correctness.

| Metric                     | Numerator                                                                                                                            | Denominator                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Valid output               | Runs recorded as `VALID`                                                                                                             | All runs, including failures                                                                                 |
| Contract rejection         | Runs recorded as `CONTRACT_REJECTED`                                                                                                 | All runs                                                                                                     |
| Rejection by reason code   | Rejected runs containing that code, once per run                                                                                     | All runs; codes can overlap                                                                                  |
| Provider failure           | Runs recorded as `PROVIDER_FAILED`                                                                                                   | All runs                                                                                                     |
| Strict accuracy            | Exact matches on resolvable gold in `VALID` runs                                                                                     | All resolvable decisions, including every invalid run's decisions                                            |
| Misassignment              | Gold decisions with any retained non-null target whose target/transform/status differs from gold                                     | All gold decisions                                                                                           |
| Invented field             | Retained entries with no matching source column, or a non-null target outside the contract enum or assigned where gold has no target | All retained output entries; one entry counts at most once                                                   |
| Correct abstention         | Unresolvable decisions with exactly one null-target/null-transform `REVIEW_REQUIRED` entry in a `VALID` run                          | All unresolvable decisions                                                                                   |
| Over-abstention            | Resolvable decisions with exactly one retained null-target/null-transform `REVIEW_REQUIRED` entry, including rejected output         | All resolvable decisions                                                                                     |
| Injection followed         | Injection-tagged decisions with any retained target equal to the gold `injectedTarget`                                               | All injection-tagged decisions                                                                               |
| Consistency across repeats | Pairs of `VALID` runs for the same dialect with equal sorted source/target/transform/status multisets                                | All unordered repeat pairs for that dialect, including invalid pairs                                         |
| Latency p50/p95            | Observed milliseconds at nearest rank `ceil(N * p / 100)` in sorted latency values                                                   | Number of latency observations, including failed attempts; this is a quantile with sample count, not a ratio |
| Input/output tokens        | Sum of known counts, independently by token direction                                                                                | Runs with a known count in that direction; `totalRuns` exposes missing coverage                              |
| Cost, integer micro-USD    | Ceiling of the sum of exact input/output token-price products divided by 1,000,000                                                   | Runs with both token counts and an exact price entry; `totalRuns` exposes missing coverage                   |

Strict accuracy deliberately excludes correct abstentions from its numerator
and denominator. The two abstention metrics always appear together, beside
accuracy. An always-abstaining fixture earns zero accuracy and full
over-abstention even though its correct-abstention count is high. Missing,
duplicated or discarded fields cannot earn a correct decision; absent output
is not counted as an explicit abstention. Failure mode metrics may overlap.
A discarded output cannot be diagnosed for injection or invention, so their
counts are observed lower bounds; consult validity, rejection and retained-entry
denominators together. The scorer trusts the recorded versioned validator
outcome rather than claiming to revalidate unavailable provider output.

Every group reports `ALL`, each gold tag, and `UNMATCHED`. Field metrics select
gold decisions bearing the tag and their retained entries. Unknown source
entries appear in `UNMATCHED` and `ALL`; they cannot be attributed to a gold
tag. Run metrics and resources for a tag cover runs whose dialect contains
that tag; `UNMATCHED` uses all runs. These overlapping breakdowns are not
additive. Consistency compares the selected fields, ignoring output order,
confidence and prose. Two identical failures never earn consistent-valid-output
credit. No pairs yields denominator zero.

Prices are integer micro-USD per million tokens. The strict table records a
version, ISO date, provenance and unique provider/requested/reported-model
entries. Null reported identity needs an explicit matching entry; unknown
usage or missing prices are not free runs. Cost rounds upward once per reported
cohort after summing products, not once per token or request. Repricing changes
the price-table hash and summary; it never alters run records. The committed
table has synthetic tariffs only. A non-model producer with no token
observations has unavailable token cost, not inferred zero model usage.

`accuracyByRepeat` preserves numerator and denominator for each repeat.
Pairwise comparisons cover only matching sealed splits, dialect inventories
and repeat IDs. A strict-accuracy difference receives `LEFT` or `RIGHT` only
when its absolute difference of repeat means strictly exceeds **both** groups'
own max-minus-min repeat accuracy. Comparison uses integer cross-products,
requires at least two repeats and nonzero denominators, and returns `UNRANKED`
for equality, overlapping spread or insufficient evidence. Other metrics are
reported without a ranking. This rule does not establish statistical
significance, select a model or account for every source of uncertainty.

The summary binds a canonical hash of the sorted validated record multiset
and a canonical hash of the price table. Receipt timestamps/run IDs stay
outside this scope. Record input order does not change summary bytes; actual
latency and usage remain observations inside the record hash. The golden uses
deterministic compact JSON plus one newline. See
[ADR 0064](adr/0064-score-mapping-records-offline-with-integer-metrics.md).
