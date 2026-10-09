<!-- markdownlint-disable-file MD033 MD041 -->

<p align="center">
  <img src="docs/assets/brand/mark.svg" width="72" height="72" alt="">
</p>

<h1 align="center">WeaveTrail</h1>

<p align="center">
  Deterministic case replay, and a planned measured choice of which model may
  propose its field mappings.
</p>

<p align="center">
  <a href="https://github.com/WeaveTrail/WeaveTrail/actions/workflows/ci.yml?query=branch%3Amain"><img alt="CI" src="https://github.com/WeaveTrail/WeaveTrail/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-blue">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A5%2022-informational">
</p>

<p align="center">
  <a href="https://weave-trail-web-flax.vercel.app"><b>Open WeaveTrail</b></a>
  &middot;
  <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="#which-model-and-how-far-it-is-trusted">Problem</a> &middot;
  <a href="#a-synthetic-case">A synthetic case</a> &middot;
  <a href="#layer-separation">Layers</a> &middot;
  <a href="#the-boundary-is-a-contract-not-a-convention">Design</a> &middot;
  <a href="#how-it-fits-together">Plan</a>
</p>

Before anything can be computed from an unfamiliar trade file, someone has to
read it: which column is the event time, which the price, which the account. A
language model can propose that reading from the headers and a few sample
rows, and can be confidently wrong.

WeaveTrail is being built to answer one question with numbers and code:
**which model was chosen for that reading and why, how far it is trusted, and
how the system controls an answer that is wrong or ambiguous.** The
deterministic replay engine underneath already decides every result. The work
now is to measure, select and restrict the models that propose its inputs.

**Current status:** the deterministic replay engine and its evidence hashes,
the synthetic Case Replay walkthrough, the mapping and case-scope contracts, a
sealed synthetic schema-dialect evaluation set, the mapping run-record
contract, the shared mapping validator with its hostile probes, and the
[AI failure log](docs/AI_FAILURE_LOG.md) are implemented. Running
models, scoring, the non-model baseline and rule-based model selection are
implemented. The first held-out run and the fresh recovery run both returned
`NO_MODEL`; the [evaluation protocol](docs/EVALUATION.md) publishes their records
and comparison. Routing and case-scope proposals remain planned.

- **What it reads ·** synthetic trade and quotation files with unfamiliar
  column names, each with its provenance beside it. Real quotation data and the
  pages built on it have been withdrawn.
- **What a model may do ·** propose a field mapping and, as planned, a case
  scope chosen from values code has already computed. Nothing else.
- **What it returns ·** a comparison of models on a sealed held-out set beside
  a non-model baseline, and a selection made by a rule fixed before that run.
  A proposal path that escalates once and otherwise stops at review is planned.
- **What it never does ·** let a model compute, approve or decide a result;
  state a cause, intent or legality; single out an account; forecast a price;
  or recommend a trade.

## Which model, and how far it is trusted

Field mapping is narrow and checkable, which is what makes it worth measuring,
and a wrong mapping is cheap to make and expensive to miss.

- **A wrong mapping can look right ·** swapping two same-shaped columns, such
  as price and quantity, passes every format check. The validator cannot catch
  it; only review can, and the evaluation names it as residual risk.
- **Calling one model is not a choice ·** without a held-out set, a non-model
  baseline and a rule fixed before the run, "we picked this model" is an
  explanation written after the fact.
- **Ambiguity is a correct answer ·** `amt` may be a quantity or a notional. A
  model that guesses is worse than one that returns `REVIEW_REQUIRED`, and one
  that always abstains helps nobody, so both are counted.

See [Limitations](docs/LIMITATIONS.md) for what a result is allowed to mean.

## A synthetic case

The walkthrough uses synthetic executions with published FIX 4.4 field names.
Approve the mapping and case scope, run the rule, and open each finding onto its
source rows and hashes. Repeat the same inputs to compare result hashes.
Real quotation sources and the pages built on them have been withdrawn.

[Walk the case](https://weave-trail-web-flax.vercel.app/replay)
&middot; [Withdrawal decision](docs/adr/0056-withdraw-the-committed-real-data-tier.md)

## Layer separation

**AI proposes. Human approves. Code verifies. Evidence traces back.**

A model's answer can be fluent and still wrong, and fluency can hide a gap. So the
work is separated by authority: each layer holds what it may do, what it may
never do, and the record it leaves behind.

![Four layers from an unfamiliar trade file to a finding: a model proposes a field mapping now, and a case scope from the dataset profile as planned; a person approves the proposal bound to its hash and the scope before anything runs; fixed code validates the contract, dry-runs every transform, re-derives events from the stored rows and evaluates the versioned rule; every finding opens onto its eventId and rawRowHash. Beneath them, the planned proposal path: the validator sends a primary model's valid, clear proposal straight to review; an ambiguous or rejected one goes once to an escalation model that never sees the primary output and through the validator again, to review if valid or to REVIEW_REQUIRED if unresolved](docs/assets/layer-separation.svg)

- **Propose · a model ·** reads the column names and at most eight sample rows
  and proposes, for each column, a canonical field and an allowed transform
  with a reason, or returns `REVIEW_REQUIRED`. As planned, it will also choose
  a case scope from inside the dataset profile. It never computes a number,
  invents a column or approves anything.
- **Approve · a person ·** approves the mapping, bound to the hash of the exact
  proposal, and the case scope before anything runs. Approval cannot edit what
  comes back.
- **Verify · fixed code ·** validates every model output against a closed
  contract, dry-runs each transform on the sample rows, re-derives events from
  the stored source rows and evaluates the versioned rule. A rejected or
  ambiguous proposal fails closed as `REVIEW_REQUIRED`.
- **Evidence ·** every finding opens onto its canonical `eventId` and
  `rawRowHash`. A run-record contract captures the model runs:
  model, prompt version, validator outcome, latency and tokens.

A model holds two roles, and only two:

| Role                        | What the model proposes                                                                       | What code fixes first                                                                                                                           | What it may never do                                                       | Status                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Field mapping               | Each column's canonical field and allowed transform, with a reason, or `REVIEW_REQUIRED`      | The column list, the target and transform lists, the contract, a dry run                                                                        | Invent a column, use an unlisted transform, change a source value, approve | Fixture, configured adapter and evaluation (`v0.2.0`) exist; routing (`v0.3.0`) planned                                     |
| Bounded case-scope proposal | The instrument, actor group, time window and rule version to examine, chosen from the profile | The `DatasetProfile`: instruments, actors and the earliest and latest event time; event counts, candidate windows and rule versions are planned | Invent an actor, widen the time bounds, predict a result, set a threshold  | Profile and its instrument, actor and time checks exist; rule-version and threshold guards and proposals (`v0.4.0`) planned |

> Code defines the possible space. AI proposes within it. A person decides.

Neither role decides a result, and escalating to a stronger model does not
change that. `SUPPORTED`, `NOT_SUPPORTED` and `INCONCLUSIVE` come only from the
deterministic engine, over an approved mapping and scope.

Two rules hold the separation up, and both live in code rather than in
guidance:

1. **No layer holds two authorities.** The layer that proposes cannot approve,
   the layer that approves cannot compute, and the layer that computes cannot
   widen what it was given.
2. **An answer carries the conditions it is true under.** Not true in general,
   but true for this version of this rule, against these approved inputs, at
   the thresholds shown beside it.

A result says whether the data supports a versioned pattern hypothesis, not why
it happened, whether anyone did wrong, or where a price goes next.

Historical policy reference: Korea's [financial AI guideline](https://www.fsc.go.kr/no010101/87142), in force
since 22 June 2026, holds that the final decision and the responsibility for it
stay with a person, and the supervisory risk-management framework issued
alongside it asks for verification before release and documentation across the
process. Layer separation is one way to carry that out. It is a design
alignment, not a certification, an approval, or an endorsement.

See [Methodology](docs/METHODOLOGY.md) for the rules, their checks and where
they decline to answer.

## The boundary is a contract, not a convention

Repeatability is enforced rather than promised. How time is written, how ties
are broken, how decimals compare, and what the result fingerprint covers are
fixed choices, written down and tested.

![Untrusted input passes a gate that validates the contract, binds the approval to the proposed artifact hash, and compares every submitted row with the stored row, before reaching a deterministic core that fixes ordering, time precision, decimal arithmetic and number spelling](docs/assets/design.svg)

- **Nothing a model wrote crosses unapproved ·** an output that fails the
  contract never reaches review as a mapping, and events are rebuilt from the
  stored source rows, not from anything the model handed over.
- **No floating point where it matters ·** prices and thresholds are compared
  exactly, never through a rounded quotient.
- **A model run is a record, not a replay ·** the run-record contract keeps the
  parsed output, validator outcome, latency and tokens, never the raw provider
  envelope. The scorer gives the same summary whenever committed records are
  re-scored; running a model again makes a new record.
- **The fingerprint covers the answer, not the run ·** shuffling the same rows
  leaves it unchanged; who approved and when is kept in the approval record
  instead, where it can still be read.
- **Refusal is explicit ·** a check that cannot be satisfied stops there and
  returns no answer at all, rather than a weaker one.

Each model is defined by what it is allowed to hand over, so it can be replaced
without moving the boundary.

See [Architecture](docs/ARCHITECTURE.md) for the trust boundaries, and the
[decision records](docs/adr) for why each choice was made.

## How it fits together

The plan adds one measured step per version, each on top of the boundary
above. What exists is on `develop`; everything else is planned, tracked in the
[milestones](https://github.com/WeaveTrail/WeaveTrail/milestones), and carries
no result until its evaluation is published.

- **`v0.2.0` · Evaluation harness ·** exists: the sealed synthetic DEV and
  HELD_OUT schema-dialect set, the run-record contract, the shared validator
  with its hostile probes, and the AI failure log with its prompt-version
  registry; one configuration-driven Chat Completions adapter and an explicit
  local smoke command with sanitized run records; scoring of accuracy, invented
  fields, abstention, rejection, latency and cost beside a non-model lexical
  baseline; a selection rule fixed before the held-out run; and the comparison
  on the evaluation page, with the home page answering which model was chosen.
  The first held-out run selected no model: every request failed without
  output. The fresh recovery run observed model output but no candidate passed
  the pre-declared thresholds; its comparison and `NO_MODEL` decision are
  committed and documented in the evaluation protocol. Both web pages are bound
  to the recovery session, so they show no selection and the home page shows
  no accuracy figures; beside the answer it draws the four control-line stages
  and lists what runs today apart from what is planned. Any changed configuration needs another fresh held-out set and a
  decision record before the run. Each finding's evidence traces back through
  the approved mapping, line by line, to the committed source value. Planned:
  the guided replay grouped under propose, approve, verify and trace.
- **`v0.3.0` · Measured routing ·** planned. A primary model proposes and the
  validator checks it. A valid, clear proposal goes to review; an ambiguous or
  rejected one goes once to an escalation model that never sees the primary
  output, then through the same validator to review, or stops at
  `REVIEW_REQUIRED`. At most two calls, no merging of the two models' fields,
  and no path creates an approval. The policy is compared against single-model
  baselines on the held-out set.
- **`v0.4.0` · Bounded case proposal ·** planned. A model proposes a case
  scope only from values in the dataset profile, out-of-profile and injection
  probes test the validator, and a person reviews the scope beside the profile
  before approving it.

Case Replay is the expert view of the same separation: a model proposes what
the columns of an unfamiliar file mean, a person approves that reading and the
scope, versioned code replays the case, and every finding opens onto its source
rows.

[Architecture](docs/ARCHITECTURE.md) carries the trust boundaries and what the
result fingerprint covers, [Evaluation](docs/EVALUATION.md) how every
measurement is defined and reproduced, and the [decision records](docs/adr) the
reason behind each choice.

## See it running

The [deployed site](https://weave-trail-web-flax.vercel.app) follows the `main`
branch and may differ from this checkout. The current checkout serves the synthetic
walkthrough at `/replay`; the evaluation harness is tracked in the
[v0.2.0 milestone](https://github.com/WeaveTrail/WeaveTrail/milestone/2).

Case replay carries one file along the whole chain: read the actual rows, review
what a model proposed the columns mean, approve that reading and the scope, run
it, and open a result back to the rows it rests on. Approvals and results live
in the open page only, so a refresh starts unapproved. All current cases are synthetic, with adjacent provenance. By
default the reading step runs from stored fixtures rather than calling a model,
and the deployed configuration carries no model credential.
[Contributing](CONTRIBUTING.md) covers running it locally.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — components and trust boundaries
  ([한국어](docs/ARCHITECTURE.ko.md))
- [Methodology](docs/METHODOLOGY.md) — what a result means and the implemented
  rules ([한국어](docs/METHODOLOGY.ko.md))
- [Evaluation](docs/EVALUATION.md) — how every published measurement is defined
  and reproduced ([한국어](docs/EVALUATION.ko.md))
- [AI failure log](docs/AI_FAILURE_LOG.md) — observed model and validator
  failures, their fixes and regression tests, and every prompt version
  ([한국어](docs/AI_FAILURE_LOG.ko.md))
- [Limitations](docs/LIMITATIONS.md) — non-goals and interpretation boundaries
  ([한국어](docs/LIMITATIONS.ko.md))
- [Data handling](docs/DATA_HANDLING.md) — what a check sends, keeps and logs,
  with the tests that enforce it ([한국어](docs/DATA_HANDLING.ko.md))
- [Instrument and index resolution](docs/INSTRUMENT_RESOLUTION.md) — dated name/code matching, ambiguity, quotation links and snapshot references ([한국어](docs/INSTRUMENT_RESOLUTION.ko.md))
- [Daily quote contracts](docs/DAILY_QUOTES.md) — retained versions, synthetic checks and the withdrawn source boundary
  ([한국어](docs/DAILY_QUOTES.ko.md))
- [Expected scenario results](https://weave-trail-web-flax.vercel.app/expectations)
  — what every committed case returns, taken from the engine itself
- [Deployment](docs/DEPLOYMENT.md) — public URL, settings, checks and rollback
- [Decision records](docs/adr) — why each design choice was made
- [Contributing](CONTRIBUTING.md) — workflow and validation expectations

## License

Original source code and documentation are licensed under the
[Apache License 2.0](LICENSE). Third-party packages keep their own licences;
see [Licensing and distribution](docs/LICENSING.md) and
[Third-party notices](THIRD_PARTY_NOTICES.md).
