# Claim scope contracts

[한국어](COVERAGE.ko.md)

The committed quotation sources and their application composition have been withdrawn. No real quotation data is offered in the current tree. See [ADR 0056](adr/0056-withdraw-the-committed-real-data-tier.md).

## Removed endpoints

`GET /api/coverage` and `POST /api/check/coverage` return 404. Replay no longer links a published coverage manifest. No pasted-text check is implemented.

## Retained library

The strict coverage contracts and `resolveClaimCoverage` library remain. They receive a manifest from the caller, fail closed on absent scope, coarse resolution or an unbound definition, and produce no numeric grade. Tests supply synthetic metadata only.

## Verification

```bash
pnpm exec vitest run packages/replay-engine/src/claim-coverage.test.ts
```
