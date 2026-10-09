# Daily quote contracts

[한국어](DAILY_QUOTES.ko.md)

The committed quotation sources and their application composition have been withdrawn. No real quotation data is offered in the current tree. See [ADR 0056](adr/0056-withdraw-the-committed-real-data-tier.md).

## Version coexistence

Event `1.1` retains executions/orders. Event `1.2` adds daily close/volume; Event `1.3` retains trading date, OHLC and net change. Mapping `1.5`/`1.6` and `1.7` preserve direct/composite identities. `YYYYMMDD_TO_KST_DAY_START_ISO` anchors a valid Gregorian date at KST midnight; it is not an execution timestamp. `PUBLISHER_DECIMAL_STRING` canonicalizes reviewed leading-dot decimals. Prices and quantities stay decimal strings with scaled-integer arithmetic.

## Schema references

FSC field names such as `basDt`, `srtnCd`, `isinCd`, `idxNm`, `clpr` and `trqu` may serve as synthetic dialect references. No publisher values or registered quotation artifacts remain.

## Approval and evidence

Daily schemas alone authorize no case. Mapping-only replay stops at `MAPPING_APPROVED`; case evaluation requires its separately approved, profile-bound manifest. Adding an actor cannot turn a daily observation into an execution. Evidence Bundle `1.3` still represents normalization without an evaluation. These branches are tested with synthetic specimens; the current picker offers synthetic execution cases.

## Verification

```bash
pnpm exec vitest run packages/replay-engine/src/daily-quote.test.ts packages/replay-engine/src/evidence-hash-scopes.test.ts apps/web/src/app/api/replay/daily-quote-route.test.ts
```
