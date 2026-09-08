# Repository working conventions

## Purpose

This file defines the boundaries and invariants for every human or coding
agent changing WeaveTrail. `CONTRIBUTING.md` covers the contribution process;
this file covers the judgment calls that process does not spell out.

## Repository shape

| Path                      | Responsibility                                                         |
| ------------------------- | ---------------------------------------------------------------------- |
| `apps/web`                | The public explanation pages and guided Case Replay                    |
| `packages/contracts`      | Versioned runtime contracts and shared types                           |
| `packages/replay-engine`  | Deterministic normalization, ordering, rules, and evidence hashes      |
| `packages/ai-harness`     | Constrained provider adapters and deterministic fixtures               |
| `packages/scenarios`      | Synthetic datasets and controlled input mutations                      |
| `packages/published-data` | Licensed published artifacts, provenance, and declared source mappings |
| `packages/evals`          | Versioned evaluation cases and aggregate runners                       |
| `docs`                    | Public architecture, methodology, evaluation protocol, and limitations |

Describe only behavior that exists. Mark planned work as planned until a
reproducible check confirms it.

## Branch and pull-request workflow

- The default base branch for a new pull request is `develop`.
- Work on a short-lived feature or fix branch, push that branch, and open the
  pull request into `develop`; do not push directly to `develop` or `main`.
- `develop` is the integration branch. `main` is reserved for production
  promotion through a separate `develop`-to-`main` pull request.
- Start ordinary new work from an up-to-date `origin/develop`. If that branch
  is unexpectedly unavailable, stop and report it instead of silently using
  `main`.
- An explicitly authorized emergency hotfix starts from an up-to-date
  `origin/main` and targets `main`. After it merges, carry the same change into
  `develop` so the integration branch does not regress the fix.
- Existing pull requests retain their current base unless the owner requests
  a retargeting.

## Trust boundary

- Models may propose field mappings, bounded case manifests, and prose.
- Models may not execute generated code, modify source events, invent fields,
  or determine the final result.
- Every model output is untrusted until it passes the corresponding Zod
  contract and, where required, explicit human approval.
- A rejected or ambiguous proposal fails closed as `REVIEW_REQUIRED`.
- Provider credentials and raw model traces remain server-only.

## Determinism and evidence

- Do not use JavaScript floating-point arithmetic for price, quantity, money,
  rates, or thresholds. Preserve decimals as strings and use scaled integers
  or a reviewed decimal library for arithmetic.
- Canonical event order is `eventTime -> sequence -> eventId`.
- Duplicate handling must be explicit and tested. Conflicting events with the
  same source identity may not be silently discarded.
- The same validated dataset and approved manifest must produce the same
  canonical result hash.
- Volatile metadata such as timestamps and run IDs is excluded from canonical
  hashes.
- Every finding references at least one canonical `eventId`, and each event
  remains traceable to `rawRowHash`.
- A deterministic-engine change requires a golden or invariant test.

## Domain language

- Results describe support for a versioned pattern hypothesis only:
  `SUPPORTED`, `NOT_SUPPORTED`, or `INCONCLUSIVE`.
- Do not claim that WeaveTrail determines guilt, legal violations, causality,
  or investment suitability.
- Counterfactual output is a mechanical sensitivity comparison, not a causal
  conclusion.

## Data provenance

- Synthetic data is the default for repository fixtures and examples.
- Any real data may be committed only when its published licence permits
  commitment, modification, and redistribution, and only with its provider,
  origin, retrieval date, licence, and required attribution recorded beside it.
  This applies to every real artifact, not only market data.
- Never commit personal, customer, order, or production trading data, or any
  data whose licence does not permit third-party provision.
- A committed real source artifact carries no fabricated attribute. Never add
  an invented participant, trade side, hypothesis, or pattern verdict to its
  source or derived rows.
- A versioned deterministic rule may separately evaluate a real market index or
  contract. A user-visible result, or one retained as case evidence, may report
  support for its declared pattern hypothesis only when the instrument does not
  identify a participant, no actor or side is attached, the scope is approved
  before the run, and each threshold and its provenance are shown beside the
  observation it is compared against. The result remains a rule output bound to
  that approved scope, not a source fact, legal conclusion, causal claim, or
  investment recommendation.
- A regression test may use generated approval fixtures to pin deterministic
  behavior over admitted real rows, but that output is not an approved case or
  evidence and may not be presented as satisfying the publication safeguards.
- Commit the retrieved response as returned. Where a committed artifact is
  derived from it, record that response, its checksum, and the deterministic
  steps that produce the artifact, so a reader can reproduce the committed
  bytes from the stated origin.

## Documentation rules

- A user-visible contract change ships with its public documentation update.
- A non-obvious design decision gets an ADR.
- A quantitative public claim includes the committed evaluation definition,
  exact command, environment, and limitations.
- Example output is captured output, or it is labeled illustrative.
- Never copy private milestones, application targets, submission strategy,
  career notes, or planning identifiers into public files, issues, commits, or
  pull requests.

## Before proposing a change

Run the checks that apply and report `PASS`, `FAIL`, or `SKIP` truthfully:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
pnpm build
```

Add the Playwright flow and property test commands here when those suites
exist. Do not list a planned check as though it already runs.

## Out of bounds

- Weakening a check to make a failure disappear.
- Adding a dependency without a stated need.
- Executing free-form model output.
- Publishing internal planning material or unverified performance claims.
- Describing planned AI behavior as implemented.
