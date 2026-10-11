# DEV-only lexical reference, version 2

`lexical-baseline/2` freezes the vocabulary from the sealed
`schema-dialects/2` DEV split. It uses the unchanged `lexical-baseline/1`
algorithm and `ascii-separators/1` normalization: exact normalized whole
headers, unique DEV labels and compatible sample strings. HELD_OUT labels
never enter vocabulary construction. Version 2 identifies the new vocabulary,
not a tuned algorithm. `eventType` can now be recognized from DEV.

`pnpm eval:schemas:generate:v2` reproduces this file. The vocabulary records
its DEV original-byte seal; the selection protocol seals the vocabulary bytes.
The comparison also reports the canonical vocabulary hash. The mapper uses
only input, never gold. Unknown and conflicting aliases abstain. This reference
is not a model candidate; its zero latency and absent token counts are sentinels,
not speed or cost measurements. Historical v1 comparisons retain their original
vocabulary and bytes.
