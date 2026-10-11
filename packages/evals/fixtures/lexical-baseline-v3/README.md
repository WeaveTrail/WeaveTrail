# DEV-only lexical reference, version 3

`lexical-baseline/3` freezes the vocabulary from the sealed `schema-dialects/4`
DEV split with the unchanged `lexical-baseline/1` algorithm and
`ascii-separators/1` normalization: exact normalized whole headers, unique DEV
labels and compatible sample strings. HELD_OUT labels never enter vocabulary
construction. Version 3 identifies the new vocabulary and its `mapping-run/2`
records, not a tuned algorithm.

`pnpm eval:schemas:generate:v4` reproduces this file. The vocabulary records its
DEV original-byte seal. Under [ADR 0075](../../../../docs/adr/0075-retry-mapping-selection-with-column-ids-and-a-fresh-corpus.md)
the reference assigns the same supplied-order column IDs as the adapter and is
validated by `mapping-validator/3` exactly as model output is. It is not a model
candidate; its zero latency and absent token counts are sentinels, not speed or
cost measurements.
