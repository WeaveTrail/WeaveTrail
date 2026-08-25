# Repository working conventions

## Purpose

This file defines the boundaries and invariants for every human or coding
agent changing WeaveTrail. `CONTRIBUTING.md` covers the contribution process;
this file covers the judgment calls that process does not spell out.

## Repository shape

| Path                     | Responsibility                                                         |
| ------------------------ | ---------------------------------------------------------------------- |
| `apps/web`               | The public explanation pages and guided replay lab                     |
| `packages/contracts`     | Versioned runtime contracts and shared types                           |
| `packages/replay-engine` | Deterministic normalization, ordering, rules, and evidence hashes      |
| `packages/ai-harness`    | Constrained provider adapters and deterministic fixtures               |
| `packages/scenarios`     | Synthetic datasets and controlled input mutations                      |
| `packages/evals`         | Versioned evaluation cases and aggregate runners                       |
| `docs`                   | Public architecture, methodology, evaluation protocol, and limitations |

Describe only behavior that exists. Mark planned work as planned until a
reproducible check confirms it.

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
- Repository data must be synthetic. Never commit personal, customer, order,
  or production trading data.

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
