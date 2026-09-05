# Daily quote normalization

Working mode includes the Financial Services Commission's published KOSPI daily
quotes for `basDt=20260903`: 40 items from the first page of 943. Select
`real/fsc-stock-quotes-20260903.jsonl`, inspect the original columns and source
provenance, enter reasons for the date/close/volume interpretations, approve the
exact mapping, and select **Normalize source**. Normalization succeeds without
case approval or a pattern verdict. The guided case and rule evaluations remain
synthetic.

## Contract coexistence

| Input            | Existing branch                                            | Daily quote branch                                                                        |
| ---------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Trade Event      | `schemaVersion: 1.1`, `ORDER_NEW`, `ORDER_CANCEL`, `TRADE` | `schemaVersion: 1.2`, `DAILY_QUOTE` only                                                  |
| Mapping Proposal | `mappingVersion: 1.4`, event schema `1.1` constants        | `mappingVersion: 1.5`, event schema `1.2` constants and required `eventType: DAILY_QUOTE` |
| Date transform   | Existing transforms                                        | Adds `YYYYMMDD_TO_KST_DAY_START_ISO` for `eventTime` only                                 |

Every object branch remains strict. Existing payloads require no migration;
new kinds and transforms cannot enter a legacy proposal. The daily kind is an
artifact constant included in the exact proposal approval hash. A field mapping
to that same target is rejected as `DUPLICATE_TARGET_FIELD` before row application.

The date transform accepts exactly eight ASCII digits denoting a valid Gregorian
date in years 0001–9999. It returns `YYYY-MM-DDT00:00:00+09:00` without local-zone
parsing or date rollover. This is a reviewer-approved trading-date anchor, not
an observed execution timestamp, market opening time or publisher-returned
offset. Existing canonicalization converts it to UTC nanosecond representation.
Decimal-string normalization is unchanged; source strings are preserved.

Event schema `1.2` is daily-only. Existing optional event fields retain their
contract definitions, but an actorless published quotation must leave `side`,
`actorId`, `counterpartyId`, `orderId`, `sequence` and `receivedAt` absent. The
`EVENT_TYPE_CODE` transform still accepts only the original execution/order codes.

The fixture provider registry now carries proposal versions and constants by
artifact hash. Daily input constants must match the registered artifact.
Unknown legacy artifacts still produce unresolved mapping proposals. An
unregistered daily artifact is rejected. Provider mode remains `fixture`.

## Published-field interpretation

The registered mapping accounts for all 15 columns in the accepted response.
The following five columns are mapped; the other ten remain explicitly unmapped
with field-specific evidence and their complete original values.

| Publisher field | Canonical target | Transform and interpretation                               |
| --------------- | ---------------- | ---------------------------------------------------------- |
| `srtnCd`        | `sourceEventId`  | `IDENTITY`; issue key within one accepted day              |
| `isinCd`        | `instrumentId`   | `IDENTITY`; instrument identity                            |
| `basDt`         | `eventTime`      | `YYYYMMDD_TO_KST_DAY_START_ISO`; declared day-start anchor |
| `clpr`          | `price`          | `DECIMAL_STRING`; daily closing price                      |
| `trqu`          | `quantity`       | `DECIMAL_STRING`; daily aggregate volume                   |

Date, close and volume require `REVIEW_REQUIRED`, fixture confidence `0` and
nonblank field-specific approval reasons at `fields.<index>`. The score is a
review signal, not a measured model confidence. Other returned columns must
remain intact and explicitly accounted for, including deliberately unmapped
columns. Closing price multiplied by aggregate volume is not asserted to be
the publisher's traded value.

## Workflow boundary

An exact mapping approval with justified overrides and no manifest normalizes
the source. The existing HTTP response is `200 MAPPING_APPROVED`, with canonical
counts, ordered event IDs and the foundation `canonicalResultHash`. It contains
no evaluation, findings, profile, full events or source trace.

An actorless dataset has `actorIds: []`. A schema-valid attempted case with a
valid bound approval and a nonempty actor is rejected with HTTP 422,
`CASE_REVIEW_REQUIRED` and `ACTOR_OUTSIDE_DATASET_PROFILE` at
`["caseManifest", "hypothesis", "actorIds", i]`. The evaluator is never invoked;
no replay or result hash is returned. Empty actors fail request validation, and
invalid case approval retains precedence over profile errors. A normal request
without a manifest does not claim to have reached `CASE_REVIEW_REQUIRED`.

The UI action is “Normalize source” for a daily proposal. The limitation panel
explains that genuine admissible executions with time, side, actor identity,
price and quantity, followed by separate case approval, would be needed for a
future case. Adding an actor alone cannot turn daily quotes into trades.

## Evidence and reproduction

The [adjacent provenance and reproduction instructions](../packages/scenarios/src/sources/real/README.md)
record the response, licence, exact request and all artifact hashes. Acquisition
occurred at `2026-09-05T19:31:27.527Z` (2026-09-06 KST), with unrestricted usage
permission verified on the same UTC date. One re-fetch at
`2026-09-05T19:36:42.695Z` returned identical raw bytes and item values; future
remote corrections may differ.

Actual-artifact tests reproduce the JSONL and generated rows and pin the
foundation, dataset and mapping approval hashes. Run:

```bash
pnpm exec vitest run packages/replay-engine/src/real-market-data.test.ts apps/web/src/app/api/replay/real-market-data-route.test.ts
```

Captured on Node 22.18.0, pnpm 10.33.2 and Linux WSL2 x86_64: normalization returns
40 canonical events and foundation hash
`f8bb2a21d695aab89e826039861204ecb741d5f56ecab69e354c9b5840ae25fc`.
This establishes deterministic normalization of this fixed window; it is not a
rule benchmark or a claim of real-market detection accuracy. Invalid dates,
parser edge cases, identity conflicts and rule ineligibility use wholly synthetic
specimens. The negative real-data route test supplies an explicitly untrusted
actor claim only in a refused request; it never evaluates that case.

The engine stays `0.7.0-canonical-decimal`, Case Manifest stays `1.3`, and the
rule, thresholds and HTTP response shapes stay unchanged. See
[ADR 0022](adr/0022-normalize-daily-quotes-with-version-coexistence.md).
