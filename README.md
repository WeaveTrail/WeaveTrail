<!-- markdownlint-disable-file MD033 MD041 -->

<p align="center">
  <img src="docs/assets/brand/mark.svg" width="72" height="72" alt="">
</p>

<h1 align="center">WeaveTrail</h1>

<p align="center">
  Weave signals into replayable evidence.
</p>

<p align="center">
  <a href="https://github.com/WeaveTrail/WeaveTrail/actions/workflows/ci.yml?query=branch%3Amain"><img alt="CI" src="https://github.com/WeaveTrail/WeaveTrail/actions/workflows/ci.yml/badge.svg?branch=main"></a>
  <img alt="license" src="https://img.shields.io/badge/license-Apache--2.0-blue">
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A5%2022-informational">
  <img alt="status" src="https://img.shields.io/badge/status-foundation%20scaffold-lightgrey">
</p>

<p align="center">
  <a href="#an-anomaly-alert-is-not-yet-evidence">Problem</a> &middot;
  <a href="#ai-proposes-a-person-approves-code-decides">Approach</a> &middot;
  <a href="#the-boundary-is-a-contract-not-a-convention">Design</a> &middot;
  <a href="#run-it">Run it</a>
</p>

WeaveTrail is a verification harness for event data that arrives in several
dialects and has to end in a number somebody can defend. A constrained model
proposes how each source column maps to a versioned contract. A person approves
that exact proposal. Versioned code then replays it, and every finding it
returns points back at the source row it came from.

> **Status — foundation scaffold.** The contracts, the deterministic engine,
> the approval gates, the `RAPID_PRICE_LIFT` rule and the guided lab are
> committed and tested. A live model provider and published measurements are
> not: the lab runs a deterministic fixture provider over synthetic data, and
> [Evaluation](docs/EVALUATION.md) defines the measurements before any of them
> exist.

## An anomaly alert is not yet evidence

Two files in `packages/scenarios` carry the same four synthetic trades. One is
CSV with a `+09:00` offset and a `side_code` column; the other is JSON Lines
with a `Z` timestamp and a `direction` column. Nothing inside either file says
they describe the same trades, and nothing says which of them is authoritative
when they disagree.

![Two committed source files describe the same trades with different field names and time notations; a model can propose how they line up, but an alert alone never records which rows, which mapping, or which rule version produced its number](docs/assets/problem.svg)

- **Sources disagree by construction ·** field names, time notation and decimal
  spelling all differ, and each difference is a place where a reconciliation can
  be wrong without being visibly wrong.
- **Identity is not given ·** an exact duplicate, a reused identifier with new
  content and a late arrival look alike until something decides what "the same
  event" means.
- **A model adds a second boundary ·** a mapper narrows the ambiguity, but its
  output is a proposal. In the JSON Lines dialect one column has no defensible
  target field, and it stops for review rather than guessing.

See [Limitations](docs/LIMITATIONS.md) for what a result is allowed to mean.

## AI proposes. A person approves. Code decides.

The model's job ends at a structured proposal. Approval is a separate,
human-owned act bound to the hash of the exact artifact that was proposed, and
the engine will not run without it.

![Four stages: a constrained mapper proposes a field mapping, a reviewer approves that exact proposal by hash, versioned code replays the approved manifest, and the result carries a canonical hash and event identifiers that resolve back to source rows](docs/assets/how-it-works.svg)

- **Propose ·** the mapper returns one target field and one allowlisted
  transform per source column, each with a confidence and its evidence. An
  unknown column, a low confidence or an unsupported transform is
  `REVIEW_REQUIRED`, not a guess.
- **Approve ·** the approval record binds to the proposed artifact hash, and a
  flagged field needs a justified override before it clears.
- **Replay ·** `RAPID_PRICE_LIFT` version `1.1` runs on engine
  `0.7.0-canonical-decimal` and reports `SUPPORTED`, `NOT_SUPPORTED` or
  `INCONCLUSIVE` across five gates. Abstention is a first-class outcome.
- **Trace ·** the result carries the canonical hash, the five gate findings and
  event identifiers that resolve to `rawRowHash` on the source row.

What that buys is checkable today, without a model in the loop. All 24
permutations of the committed four-event fixture produce the single hash
`8ecbc171…c81b13ff`. The CSV and JSON Lines dialects converge to one canonical
dataset while keeping distinct artifact and row hashes. Three declared scenarios
are pinned to the three results by literal golden hash, one scenario each.

See [Methodology](docs/METHODOLOGY.md) for the rule, the gates and the
abstention boundary.

## The boundary is a contract, not a convention

Determinism is not a property the engine tries to have. It is a set of choices
that were made once, written down as ADRs, and pinned by tests: how time is
represented, how ties break, how decimals are stored and compared, and what the
result hash is allowed to depend on.

![Untrusted input passes a gate that validates the contract, binds the approval to the proposed artifact hash, and compares every submitted row with the server's committed row, before reaching a deterministic core that fixes ordering, time precision, decimal arithmetic and number spelling](docs/assets/design.svg)

- **Nothing model-authored crosses unapproved ·** the replay route rejects
  caller-authored canonical events outright and re-derives them from committed
  rows through the approved mapping.
- **No floating point anywhere it matters ·** prices, quantities and thresholds
  stay decimal strings and compare as exact scaled-integer cross-products.
- **The hash covers the result, not the run ·** engine version, canonical
  events and rule outcome are inside it; `receivedAt`, `rawRowHash`,
  `workflowState`, reviewer identity and approval time are outside it.
- **Failure is a state, not an exception ·** a gate that cannot be satisfied
  returns HTTP `422` with a review state and no result hash.

See [Architecture](docs/ARCHITECTURE.md) for the trust boundaries and the
package split, and the [ADRs](docs/adr) for why each choice was made.

## Run it

Node.js 22+ and pnpm 10.33.2.

```bash
cp .env.example apps/web/.env.local
pnpm install
pnpm dev
```

Open <http://localhost:3000/lab>. Fixture mode needs no API key. The deployed
copy at
[weave-trail-web-flax.vercel.app](https://weave-trail-web-flax.vercel.app)
runs the same fixture provider and the same committed scenarios, holds no
model-provider credential, and is for synthetic data only.

```bash
pnpm test       # the full suite, including every invariant above
pnpm typecheck
pnpm build
```

See [Deployment](docs/DEPLOYMENT.md) for the recorded Vercel settings, the
environment boundary and the rollback procedure.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — components and trust boundaries
- [Methodology](docs/METHODOLOGY.md) — result semantics and the implemented rule
- [Evaluation](docs/EVALUATION.md) — the measurement protocol, with no targets
  written up as results
- [Limitations](docs/LIMITATIONS.md) — non-goals and interpretation boundaries
- [Deployment](docs/DEPLOYMENT.md) — public URL, settings, checks and rollback
- [Contributing](CONTRIBUTING.md) — workflow and validation expectations

## License

Original source code and documentation are licensed under the
[Apache License 2.0](LICENSE). Third-party packages keep their own licences;
see [Licensing and distribution](docs/LICENSING.md) and
[Third-party notices](THIRD_PARTY_NOTICES.md).
