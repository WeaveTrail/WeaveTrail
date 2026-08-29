# WeaveTrail Architecture

WeaveTrail separates probabilistic interpretation from authoritative
calculation. A model can narrow ambiguity, but only validated inputs and
versioned code can produce a replay result.

## Component chain

```mermaid
flowchart LR
    RAW[CSV / JSON events] --> MAPPER[Constrained schema mapper]
    MAPPER --> MAP_GATE{Mapping approved?}
    MAP_GATE -- no --> REVIEW[REVIEW_REQUIRED]
    MAP_GATE -- yes --> EVENTS[Canonical TradeEvent set]
    EVENTS --> PROPOSER[Bounded case proposer]
    PROPOSER --> CASE_GATE{Case approved?}
    CASE_GATE -- no --> REVIEW
    CASE_GATE -- yes --> REPLAY[Deterministic replay engine]
    REPLAY --> EVIDENCE[Evidence Bundle]
    EVIDENCE --> SOURCE[Source event + raw-row trace]
```

## Trust boundaries

### Interpretation boundary

Provider output is untrusted data. The mapper may select only source columns
that exist and transforms from a fixed allowlist. Invalid shape, low confidence,
unknown columns, or unsupported transforms return `REVIEW_REQUIRED`.

### Approval boundary

The state machine prevents unapproved output from reaching replay:

```text
UPLOADED -> MAPPING_PROPOSED -> MAPPING_APPROVED
         -> CASE_PROPOSED -> CASE_APPROVED -> REPLAYED -> EXPORTED
```

The current scaffold implements fixture input and deterministic replay. The
complete approval state machine remains planned.

### Decision boundary

The replay engine owns ordering, deduplication, decimal arithmetic, window
aggregation, rule evaluation, counterfactual comparison, and canonical hashes.
It never executes code written by a model.

### Evidence boundary

Canonical hashes exclude volatile metadata. Findings refer to canonical
`eventId` values, and those events retain `sourceEventId` and `rawRowHash` so a
reviewer can reach the source row.

## Package boundaries

| Package         | Owns                                                            | Must not own                             |
| --------------- | --------------------------------------------------------------- | ---------------------------------------- |
| `contracts`     | Versioned schemas and closed vocabularies                       | Provider calls or verdict logic          |
| `ai-harness`    | Provider adapters, structured proposals, deterministic fixtures | Final calculations or automatic approval |
| `replay-engine` | Canonicalization, rules, hashes, evidence assembly              | Free-form inference or legal conclusions |
| `scenarios`     | Synthetic datasets and mutations                                | Production or personal data              |
| `evals`         | Versioned cases and measurement aggregation                     | Undocumented benchmark claims            |
| `web`           | Human review flow and export surface                            | A second implementation of replay logic  |

## Determinism contract

For one validated dataset and approved manifest:

- source times normalize to fixed-width UTC nanoseconds before comparison and
  hashing;
- canonical event order is normalized `eventTime -> sequence -> eventId` using
  locale-independent UTF-16 code-unit ordering for string tie-breakers;
- equivalent `Z` and explicit-offset representations normalize to the same
  event time;
- a dataset that mixes present and absent sequence values fails closed before
  replay;
- exact duplicates do not alter the result;
- conflicting duplicates fail closed rather than being silently selected;
- decimal values are never calculated with JavaScript floating point;
- reruns produce the same `canonicalResultHash`.

Fixed-precision time normalization, locale-independent ordering, mixed-sequence
rejection, row shuffling, and exact-duplicate tolerance have foundation
invariant tests today. Manifest-aware replay, conflicting-duplicate handling,
canonical hash projection, a committed literal golden hash, and financial
arithmetic remain planned. See
[ADR 0003](adr/0003-use-nanosecond-utc-and-code-unit-ordering.md) for the exact
representation and input limits.

## Deployment boundary

The MVP uses one Next.js application and local workspace packages. Fixture mode
works without an external model or database. Provider adapters run server-side;
browser bundles must never receive provider credentials. A separate replay
service or database is deferred until measured scale or persistence needs
justify it.
