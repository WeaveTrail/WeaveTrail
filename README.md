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
</p>

<p align="center">
  <a href="#an-alert-is-not-yet-evidence">Problem</a> &middot;
  <a href="#ai-proposes-a-person-approves-code-decides">Approach</a> &middot;
  <a href="#the-boundary-is-a-contract-not-a-convention">Design</a> &middot;
  <a href="#run-it">Run it</a>
</p>

WeaveTrail is an investigation workbench for the step after a market-surveillance
alert. As surveillance turns AI-assisted, candidates arrive faster than anyone
can check them — and a candidate is not a finding until a second person can
re-derive it from the same executions.

- **Where it sits ·** after an alert or a referral, before an investigation
  concludes.
- **Who it is for ·** surveillance teams at a trading venue, compliance reviewers
  at a broker or bank, supervisory investigators, internal audit.
- **What it returns ·** a versioned pattern verdict, the arithmetic behind it,
  and every execution it rests on.

## An alert is not yet evidence

Whoever picks the alert up has to say which executions produced the number,
under which mapping, under which rule version. The feeds make that hard before
a model is anywhere near it.

![An alert names a candidate whose executions arrive in two dialects with different field names and time notations; a model can propose how they line up, but an alert alone never records which rows, which mapping, or which rule version produced its number](docs/assets/problem.svg)

- **Venues disagree by construction ·** field names, time precision, decimal
  spelling and resend semantics differ between any two systems.
- **Identity is not given ·** a duplicate, a reused order reference and a late
  arrival look alike until something defines "the same execution".
- **A model adds a second boundary ·** it narrows the ambiguity, but its output
  is a proposal, and a plausible summary can hide a gap.

See [Limitations](docs/LIMITATIONS.md) for what a result is allowed to mean.

## AI proposes. A person approves. Code decides.

The first case is bounded on purpose:

> Does a short-window price lift support a versioned pattern of repeated,
> concentrated aggressive buying by the approved actor group — and how do the
> metrics move when that group's executions are removed?

![Four stages between a surveillance alert and a re-derivable result: a constrained mapper proposes a field mapping, a reviewer approves that exact proposal by hash, versioned code replays the approved manifest, and the result carries a canonical hash and event identifiers that resolve back to source rows](docs/assets/how-it-works.svg)

- **Propose ·** one target field and one allowlisted transform per source
  column, each with a confidence and its evidence.
- **Approve ·** the approval binds to the proposed artifact hash, and a flagged
  field needs a justified override to clear.
- **Replay ·** `RAPID_PRICE_LIFT` reports `SUPPORTED`, `NOT_SUPPORTED` or
  `INCONCLUSIVE` across five gates. Abstention is a first-class outcome.
- **Trace ·** the canonical hash, the gate findings, the actor-removal
  comparison, and event identifiers that resolve to their source rows.

The verdict is about a technical pattern, not legality, intent or guilt, and the
actor-removal comparison is mechanical rather than causal.

See [Methodology](docs/METHODOLOGY.md) for the rule, the gates and the
abstention boundary.

## The boundary is a contract, not a convention

Determinism is pinned rather than asserted: how time is represented, how ties
break, how decimals compare, and what the result hash may depend on are fixed
choices, written down and tested.

![Untrusted input passes a gate that validates the contract, binds the approval to the proposed artifact hash, and compares every submitted row with the stored row, before reaching a deterministic core that fixes ordering, time precision, decimal arithmetic and number spelling](docs/assets/design.svg)

- **Nothing model-authored crosses unapproved ·** canonical events are
  re-derived from stored rows through the approved mapping.
- **No floating point where it matters ·** prices and thresholds stay decimal
  strings and compare as exact scaled integers.
- **The hash covers the result, not the run ·** every permutation of a source
  set resolves to one canonical hash.
- **Failure is a state ·** a gate that cannot be satisfied returns a review
  state and no result hash.

The mapper is defined by its contract rather than its provider, so the model
behind it can be swapped without moving the boundary.

See [Architecture](docs/ARCHITECTURE.md) for the trust boundaries, and the
[ADRs](docs/adr) for why each choice was made.

## Run it

Node.js 22+ and pnpm 10.33.2.

```bash
cp .env.example apps/web/.env.local
pnpm install
pnpm dev
```

Open <http://localhost:3000/lab> and walk the whole path: a proposal, a review
with a justified override, an approval, and the replay it authorises. The
deployed workbench at
[weave-trail-web-flax.vercel.app](https://weave-trail-web-flax.vercel.app)
runs the same engine over the same reference scenarios.

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — components and trust boundaries
- [Methodology](docs/METHODOLOGY.md) — result semantics and the implemented rule
- [Evaluation](docs/EVALUATION.md) — how every published measurement is defined
  and reproduced
- [Limitations](docs/LIMITATIONS.md) — non-goals and interpretation boundaries
- [Deployment](docs/DEPLOYMENT.md) — public URL, settings, checks and rollback
- [Contributing](CONTRIBUTING.md) — workflow and validation expectations

## License

Original source code and documentation are licensed under the
[Apache License 2.0](LICENSE). Third-party packages keep their own licences;
see [Licensing and distribution](docs/LICENSING.md) and
[Third-party notices](THIRD_PARTY_NOTICES.md).
