# Published data withdrawal

[한국어](PUBLISHED_DATA_ADMISSION.ko.md)

The committed quotation sources and their application composition have been withdrawn. No real quotation data is offered in the current tree. See [ADR 0056](adr/0056-withdraw-the-committed-real-data-tier.md).

## Historical evaluation

The unchanged claim coverage v1 summary and receipt are historical captures with withdrawn sources, not current coverage. `pnpm eval:coverage` and its runner have been removed.

[Historical captures](../packages/evals/results/README.md) record the limitation.

## Current boundary

No private store or host replaces these sources. Synthetic scenarios remain the default. The [data-provenance rules](../AGENTS.md#data-provenance) remain unchanged.
