# Lexical reference capture and synthetic controls

All content is repository-authored synthetic material under Apache-2.0.
`vocabulary.json` is a frozen `lexical-baseline/1` vocabulary derived only from
the sealed DEV input names and labels. `buildLexicalVocabulary` regenerates it;
its regression test rejects HELD_OUT and seal mismatches. The mapper never
reads either corpus's gold.

`records.json` contains 80 authored controls: oracle and always-abstaining
decisions, two repeats over 8 DEV and 12 HELD_OUT dialects. Their `VALID` outcomes
are authored scorer fixtures, not observations of the shared validator.
`authorLexicalComparisonControls` regenerates these bytes. No model was run,
no prompt was changed, and no model held-out evaluation was burned. The frozen
baseline itself has now been applied to both splits; do not tune it on these
HELD_OUT results.

`baseline-records.json` contains 40 actual deterministic baseline attempts over
the same grids. All pass through the shared mapping-output gate and are rejected
with `MISSING_REQUIRED_TARGET`; missing `eventType` is sufficient for rejection.
The `0` latency is a nonmeasurement sentinel; null tokens and zero covered cost
runs are unavailable observations. There are no invented token counts or tariffs.
The existing synthetic scorer price table is reused without adding a dependency
or claiming a vendor price.

`selected.json` explicitly names all four synthetic control groups solely to
exercise the selection-record format, including equal and baseline-favored
tags. It does not select a production model. The committed
[summary](../../results/mapping-comparison-v1.json) uses compact JSON plus one
newline. Run `pnpm eval:mappings:compare` to reproduce the baseline attempts and
verify both the records and summary byte for byte, without credentials or
network. The command never updates any committed file.

See [the public protocol](../../../../docs/EVALUATION.md#non-model-lexical-reference)
for definitions, commands, environment and limits.
