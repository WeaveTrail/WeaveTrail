# ADR 0036: Normalize published execution-schema projections without inventing identity

## Status

Accepted

## Context

The original heterogeneous synthetic pair proves whole-dataset equivalence but
uses repository-authored column names. It cannot show how the mapping boundary
behaves against recognizable execution schemas. FIX 4.4 `ExecutionReport` and
Korea Investment & Securities TR `H0STCNT0` both publish instrument, execution
time, price, quantity and side fields, but only the FIX projection carries an
account. H0STCNT0 publishes business date and execution time separately and
does not publish a participant or account column.

Treating the absent H0STCNT0 actor as an inferred constant would cross the
trust boundary. Reusing an earlier mapping version while broadening its
transforms would also change an accepted contract without an explicit opt-in.

## Decision

Add Mapping Proposal `1.8` as an opt-in intraday-execution branch. It retains
Trade Event `1.1`, requires the constant `eventType: TRADE`, and adds only these
execution-specific operations:

- `FIX_UTC_TIMESTAMP_TO_ISO` converts the FIX 4.4 UTC timestamp spelling to an
  offset-explicit ISO timestamp.
- `FIX_SIDE_CODE` accepts FIX values `1` (buy) and `2` (sell).
- `KIS_CCLD_DVSN` accepts the published H0STCNT0 values `1` (buy) and `5`
  (sell).
- `compositeEventTime` combines the ordered `BSOP_DATE` and
  `STCK_CNTG_HOUR` columns with `KIS_DATE_TIME_TO_KST_ISO`.
- `unmappedFields` may declare `actorId` absent with confidence `0` and
  `REVIEW_REQUIRED`. The executable mapping omits that declaration, while the
  approval gate requires a nonblank override reason at its exact path.

The committed pair is synthetic. Its FIX and H0STCNT0 projections use the same
fictional instrument and executions. The shared canonical fields normalize to
the same values; the FIX result alone carries synthetic account identifiers and
can reach the participant-based rule. H0STCNT0 produces a different canonical
dataset hash and cannot authorize that case, even after a reviewer acknowledges
the absent field.

The exact field, market-rule and no-market-data provenance is recorded in the
adjacent
[`published-execution-fix44.provenance.json`](../../packages/scenarios/src/sources/published-execution-fix44.provenance.json)
and
[`published-execution-h0stcnt0.provenance.json`](../../packages/scenarios/src/sources/published-execution-h0stcnt0.provenance.json)
records. [ADR 0037](0037-record-every-replay-source-with-adjacent-provenance.md)
defines the common source-record mechanism.

## Consequences

- Mapping Proposals `1.4` through `1.7`, their allowed transforms and existing
  hash literals remain unchanged.
- Strict clients opt into `1.8`, render `compositeEventTime` and
  `unmappedFields`, and include justified absent-field override paths in the
  approval record.
- Acknowledging absence authorizes only normalization. It cannot supply an
  actor or make an actor-dependent manifest compatible with the dataset.
- The new FIX artifact has literal source, dataset and result hash goldens; all
  findings resolve to its committed rows. The H0STCNT0 artifact pins its bytes,
  parser rows and safe stopping points.
