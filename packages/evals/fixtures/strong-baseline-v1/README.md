# Strong non-model development reference

`configuration.json` is authored exclusively from the sealed
[`schema-dialects/4` DEV](../schema-dialects-v4/DEV.json) source. It records
whole-name aliases, blocked names, five ordered token rules and their DEV
witnesses. The versioned implementation supports only `IDENTITY`,
`ISO_DATETIME` and `DECIMAL_STRING`.

`records.json` contains actual B0 (`lexical-baseline/3`) and B1
(`strong-baseline/1`) runs over the same twelve DEV dialects, one repeat each.
These are deterministic development observations, not model measurements or
confirmation evidence. Zero latency is a sentinel; tokens and costs are unknown.
Both references remain unselectable and create no approval.

Run `pnpm eval:baselines:dev` to reconstruct the configuration, verify the record
bytes, and re-score to the [committed summary](../../results/strong-baseline-dev-v1.json).
The command reads no other split and never updates expected artifacts. The
regression tests also reproduce these bytes in `pnpm test`.

See the [protocol and limitations](../../../../docs/EVALUATION.md#stronger-non-model-development-reference)
and [ADR 0080](../../../../docs/adr/0080-build-a-dev-only-ordered-token-mapping-reference.md).
