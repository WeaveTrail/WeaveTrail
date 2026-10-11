# ADR 0075 selection inputs

`protocol.json` seals the [`schema-dialects/4`](../schema-dialects-v4/PROVENANCE.md)
DEV and HELD_OUT splits and the DEV-only [`lexical-baseline/3`](../lexical-baseline-v3/README.md)
vocabulary, and names the four candidates of
[ADR 0075](../../../../docs/adr/0075-retry-mapping-selection-with-column-ids-and-a-fresh-corpus.md).
These are pre-run inputs, not provider measurements.

The protocol is incomplete. It has no dated price table: ADR 0075 requires one
dated on the held-out run's UTC date, captured with the pre-run amendment.
Gate 2 did not pass on 2026-10-10, so no amendment exists, ADR 0075 is not
accepted and the held-out command refuses this protocol. See the
[gate 2 capture](../../results/mapping-dev-gate-v4/README.md). The earlier
protocols and sessions remain unchanged and can still be selected offline.
