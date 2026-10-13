# Independent gold and lineage review: mapping study drafts v1

Status: **review record; decisions not yet applied**. This document records an
independent review of the [unsealed mapping study drafts](../packages/evals/fixtures/mapping-study-v1/README.md)
against the [family and gold specification](MAPPING_CORPUS_SPEC.md). It does not
change any committed input, gold, ledger or manifest. `review-ledger.json` and
`exclusions.json` stay `PENDING` until a separate change applies the decisions
below and regenerates the drafts. Nothing is sealed, no model was called and
`NO_MODEL` is unchanged.

## Scope and reviewed bytes

Reviewed at `develop` commit `35a0235`. `pnpm eval:corpus:check` passed on that
checkout (committed bytes verified, two generations identical, `UNSEALED`).

| Artifact               | SHA-256                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `manifest.json`        | `09048de7ca72a8b4836fb13b910284e5c87ac9c056e3085bd9be4d16fc809774` |
| `SELECT.inputs.json`   | `c1509d30edcd28cd43f92f9875866d1713c0dbd809e40ef6df6cb0e8e7b377f7` |
| `AUDIT.inputs.json`    | `f8cf2a0d72c1f6d015282e7646cfa5ac24dc0a2b23dca0a8d90530b957964c24` |
| `DRIFT.inputs.json`    | `985f01aaa1e6b9eec48dd4f5ea9de02076886ee38b8f1e0eb481fb6f84f5e865` |
| `SELECT.gold.json`     | `8c6910f74db99ff2d097412f43ec3ec74f2dbf3551bc9dd2f097e6bc2501edfe` |
| `AUDIT.gold.json`      | `06f89a3c438aaaaa93a832dba3a949c65fd5d977fcceee963871b95999ff604d` |
| `DRIFT.gold.json`      | `bf80fffc3e2b679d3671e2c3cee3c4e6ddee4b722a040f8e1e73085afa0a2c0c` |
| `families.json`        | `df7cfdb044adb3d6a658c4f7d228f668288cc4aad0ef8af41576be115a0eaeed` |
| `drift-relations.json` | `ca9973fbe8f38ba87c7e09922d8d1c98dad266b9d3e369cc8268f0b3675e93d5` |
| `overlap-report.json`  | `56dc7c78d7b04681d7d31c2d141088963abd538f1e110cfe20c6b1a41ab2588f` |

## Reviewer and procedure

- **Author:** `repository-author` (the drafts' recorded author).
- **Reviewer:** an AI coding assistant (Claude Opus 5.5) acting as a reviewer
  separate from the authoring assistant. It did not write the generator, the
  briefs or the gold. Whether an AI reviewer satisfies the independence
  requirement is a decision for the audited pre-registration, not this record.
- **No model output.** No provider was called and no mapping proposal from any
  model was read. Only the committed drafts and repository code were used.
- **Blind first pass.** For SELECT and AUDIT the reviewer read only the
  provider projections (headers and the two sample rows), wrote a complete
  answer per column, and only then opened the gold, families and overlap
  report. The written answers are in the [appendix](#appendix-blind-answers).
  For DRIFT the reviewer read the base and follow-up projections before any
  gold and formed expected answers, but did not write them down before opening
  the DRIFT gold.
- **Prior exposure.** Before the blind pass the reviewer had read
  `MAPPING_CORPUS_SPEC.md`, ADR 0081 and the draft README, which describe the
  cell allocation and the DRIFT change design. The DRIFT pass was therefore not
  blind to the design, only to the gold records.
- Transform equivalence was checked against the shared validator's
  compatibility table and the ingest transforms in
  `packages/replay-engine/src/source-ingest.ts`.

## Result summary

| Check                                          | Result                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| SELECT column answers (24 inputs, 156 columns) | Blind answer equals proposed gold on 156/156                               |
| AUDIT column answers (60 inputs, 391 columns)  | Blind answer equals proposed gold on 391/391                               |
| DRIFT answers (12 bases, 72 follow-ups)        | Expected answers equal proposed gold on 84/84 inputs                       |
| Whole-input validator and disposition          | Agree for all 168 inputs; one reason-category label wrong on 6 inputs (N1) |
| Accepted equivalent assignments                | Missing where the code makes transforms identical (B3)                     |
| Family independence, MUST_REVIEW stratum       | **Not established**: 28 families share one null-slot template (B1)         |
| Family independence, DRIFT                     | **Not established**: 12 families share one mutation template (B2)          |
| Family independence, RESOLVABLE / HARD         | Accepted for 56 families, with the notes below                             |

Agreement on every column means the gold follows the visible evidence. It does
not show that the inputs are hard or that the families are independent; the
findings below concern those questions.

## Findings that block sealing

### B1. One template across every MUST_REVIEW family

All 28 MUST_REVIEW families (8 SELECT, 20 AUDIT) contain the same set of null
answers: 21 have `AMBIGUOUS` + `ABSENT_LURE` + `TRANSFORM_LURE`, and the 7
hostile-decoy families have `AMBIGUOUS` + `INJECTION` + `TRANSFORM_LURE`. The
four required targets are always plain. The overlap report already groups 26 of
them under two slot signatures; f-059 and f-073 differ only by doubling one
slot.

Consequences:

- The four MUST_REVIEW cells are not distinct problems. An "ambiguous roles"
  family and an "unsupported representations" family carry the same three kinds
  of review reason, so a per-cell result cannot be attributed to its cell.
- Every input has at least three independent review triggers. Under the
  planned any-review-field stop rule, flagging any one of them gives full route
  credit, which inflates the MUST_REVIEW route outcome.
- The template spans SELECT and AUDIT, so selection and evaluation share a
  lineage.

**Decision:** gold correct; independence **rejected as authored**. Before
sealing, either redesign so that each MUST_REVIEW family's review reason
belongs to its own cell (one cell-specific trigger per input, other optional
columns mappable), or record the template as one lineage (two with the hostile
variant) and revise the independent unit count in the pre-registration.
Redesign is recommended because the second option also leaves the route-credit
inflation in place.

### B2. One mutation template across all DRIFT families

All twelve DRIFT bases share one naming grammar: the "Reusable …" prefix, the
party legend `(ACT-* = actor, CP-* = counterparty)`, the clock legend `(ISO UTC
or Unix epoch milliseconds, as shown)` or its `s:` seconds variant, and the
follow-up phrases `Re-labelled … (same units and role)`, `… (equally
authoritative event reference)` and `Added receipt UTC for …`. The bases differ
only in event kind and in which optional roles are present. The specification
requires bases to pass the same independence review and not to reuse a source
template.

The answers themselves are correct, including the cases that need care: the
competing required source in each add-required follow-up is indistinguishable
and both columns go to review; the unobservable same-shape inputs are
byte-identical to their bases with identical gold; the visible ones change only
the `ACT-`/`CP-` prefix.

**Decision:** gold correct; independence **rejected as authored**. Either give
each base its own source convention and wording for the change (the allocation
table can stay), or record one DRIFT lineage and report the twelve as
allocation slots of one template, not twelve families.

### B3. Equivalent transforms are not recorded

`acceptedAlternativeAssignments` is empty on every input, but the code makes
some transform choices identical:

| Columns                                                           | Equivalent transforms                      | Basis                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| ISO clocks (`eventTime`, `receivedAt`): 91 SELECT/AUDIT, 78 DRIFT | `ISO_DATETIME` = `IDENTITY`                | `applyTransform` returns the value unchanged for both, and the validator accepts both on clock targets. Identical on every input |
| `eventType` with canonical values: 81 SELECT/AUDIT, 84 DRIFT      | `IDENTITY` = `UPPERCASE`                   | Identical over the declared domain `{TRADE, ORDER_NEW, ORDER_CANCEL}`                                                            |
| `side` with `BUY`/`SELL`: 5 SELECT/AUDIT, 26 DRIFT                | `IDENTITY` = `UPPERCASE` = `BUY_SELL_CODE` | Identical over `{BUY, SELL}`                                                                                                     |
| d-047 `side` with `buy`/`sell`                                    | `BUY_SELL_CODE` = `UPPERCASE`              | Identical over the domain declared in the header, `buy/sell`                                                                     |

Rejected as equivalents: `IDENTITY` vs `UPPERCASE` on identifiers (their case
domain is not declared; the samples alone do not prove it); `IDENTITY` vs
`DECIMAL_STRING` (they differ on trailing zeros, e.g. `17.50`);
`EVENT_TYPE_CODE` on `TRADE`-only columns (the declared domain includes
`ORDER_NEW`/`ORDER_CANCEL`, which that transform does not map).

**Decision:** record the accepted rows above as complete alternative
assignments before sealing. Under the specification, strict accuracy and the
eligibility gate still score the canonical tuple; alternative agreement is
reported beside them as a diagnostic.

## Findings to fix before sealing (non-blocking for gold)

- **N1. Wrong reason category on required removals.** The six DRIFT follow-ups
  that remove the required `sourceEventId` (d-085.4, d-086.4, d-091.4, d-092.4,
  d-093.4, d-095.4) have validator `MISSING_REQUIRED_TARGET` and disposition
  `REVIEW_REQUIRED` but reason category `COMPLETE_VISIBLE_ASSIGNMENT`. Use a
  required-target-absence category.
- **N2. Headers reused from a used corpus.** f-009 `Executed unit price` and
  f-066 `Entry amount` match headers of the used v3 `HELD_OUT` set exactly,
  with the same answers (`price` and `AMBIGUOUS`). That set was run against
  models and is public. Rename both.
- **N3. Glosses in HARD_RESOLVABLE headers.** 34 of the 52 abbreviated or
  synonym columns in the HARD stratum carry a parenthetical gloss that names the
  role or unit, e.g. `Orig ord ref (order identifier)` or
  `Contra desk (counterparty identifier)`. The gold is unaffected, but the
  stratum label may not reflect difficulty. Either remove the glosses or keep
  the strata as construction labels in the pre-registration, not difficulty
  claims.
- **N4. Template alternatives.** 545 mapped columns share one alternative
  sentence ("Treat the values as another same-shaped role"). The specification
  asks for the plausible competing assignment and the evidence that rules it
  out. At least the role-pair and name families should name their competing
  column.
- **N5. d-064 c05 tag.** `Actor number padded to width 6` does not state the
  output form, unlike the other conversion lures (`…; output major currency`).
  The column answer (null, review) is right either way, but the tag could be
  `AMBIGUOUS` rather than `TRANSFORM_LURE`. Reword it, e.g. `Actor number;
output zero-padded to width 6`.
- **N6. d-024 c04 wording.** `Removed order event ID` is correctly
  `sourceEventId`, but it can be read as the original order's event. Consider
  `Removal event ID`.
- **N7. DRIFT change position.** In the rename and add follow-ups the changed
  column is always placed first (`c01`). Detection is name-based, so this does
  not change any oracle, but it is a positional regularity; place it by the
  same seeded order as the base.

## Notes accepted without change

- Shared slot signatures among resolvable families (f-001/f-054,
  f-016/f-031, f-030/f-036/f-042, f-005/f-007) come from the common required
  targets plus one or two optional roles. Their event kinds, wording and
  evidence differ; accepted as independent.
- f-021 (AUDIT) shares a slot signature with DRIFT f-087/f-089/f-095. Only
  scaffolding is shared and the wording differs; accepted.
- All sample rows reuse the same values (`SYN-71`/`SYN-72`, the same
  timestamps and amounts) across roles and families, so every role clue is in
  the header. This is consistent with the specification and makes value-based
  shortcuts impossible; it also means the study measures header reading only.
- Several lures pass the validator with the wrong transform (for example
  seconds read as epoch milliseconds in d-080, or `100.01` read as a decimal in
  d-082). Gold correctly stays null; these are useful probes that validator
  acceptance is not correctness.
- Hostile strings in mapped identifier columns (d-029, d-052, d-054, d-056)
  remain the mapped value under `IDENTITY`, as the specification allows.

## Per-family decisions

| Families                                                      | Gold                           | Lineage                                       |
| ------------------------------------------------------------- | ------------------------------ | --------------------------------------------- |
| SELECT and AUDIT, RESOLVABLE and HARD_RESOLVABLE (56)         | Agree                          | Independent; N2, N3, N4, N6 apply where named |
| SELECT and AUDIT, MUST_REVIEW (28)                            | Agree; N5 for f-064            | Shared template; redesign or record (B1)      |
| DRIFT (12, 84 inputs)                                         | Agree; N1 for six follow-ups   | Shared template; redesign or record (B2)      |
| All with ISO clocks, canonical event kinds or canonical sides | Add accepted alternatives (B3) | —                                             |

No exclusion is recommended on gold grounds. If B1 or B2 is resolved by
redesign, the replaced versions and their hashes go into `exclusions.json`
with this record as the reason, and the redesigned families need their own
independent review before sealing.

## Appendix: blind answers

Written from the projections before opening any gold. One line per input,
columns in supplied order. `I` = `IDENTITY`, `ISO` = `ISO_DATETIME`, `EP` =
`EPOCH_MS_TO_ISO`, `D` = `DECIMAL_STRING`, `BS` = `BUY_SELL_CODE`, `ET` =
`EVENT_TYPE_CODE`, `U` = `UPPERCASE`; `R` = `(null, null, REVIEW_REQUIRED)`;
every non-`R` answer is `PROPOSED`.

<details>
<summary>SELECT (24 inputs)</summary>

```text
d-001 eventType:I quantity:D sourceEventId:I eventTime:ISO instrumentId:I orderId:I
d-002 eventType:I sequence:I eventTime:ISO orderId:I sourceEventId:I instrumentId:I
d-008 sourceEventId:I receivedAt:ISO instrumentId:I sequence:I eventType:I eventTime:ISO
d-009 price:D eventTime:EP instrumentId:I eventType:I sourceEventId:I receivedAt:ISO
d-015 eventType:I side:I counterpartyId:I eventTime:ISO sourceEventId:I actorId:I instrumentId:I
d-016 actorId:I sourceEventId:I eventType:I orderId:I eventTime:ISO instrumentId:I
d-022 eventType:I price:D eventTime:ISO sequence:I sourceEventId:I instrumentId:I quantity:D
d-023 orderId:I quantity:D eventType:I instrumentId:I sourceEventId:I eventTime:ISO price:D
d-029 instrumentId:I price:D quantity:D sourceEventId:I eventType:I actorId:I eventTime:ISO
d-030 instrumentId:I eventTime:ISO eventType:I quantity:D sourceEventId:I price:D
d-036 eventTime:ISO instrumentId:I eventType:I sourceEventId:I quantity:D price:D
d-037 sourceEventId:I eventType:I eventTime:ISO actorId:I instrumentId:I orderId:I
d-043 eventType:I sourceEventId:I side:BS price:D eventTime:ISO instrumentId:I
d-044 eventType:ET quantity:D instrumentId:U eventTime:ISO actorId:I sourceEventId:I
d-050 sourceEventId:I eventTime:ISO eventType:I orderId:I instrumentId:I quantity:D
d-051 receivedAt:ISO instrumentId:I eventType:I sourceEventId:I eventTime:ISO actorId:I
d-057 instrumentId:I eventTime:ISO sourceEventId:I eventType:I R R R
d-058 sourceEventId:I R instrumentId:I R eventTime:ISO eventType:I R
d-064 eventType:I instrumentId:I sourceEventId:I eventTime:ISO R R R
d-065 R R sourceEventId:I instrumentId:I eventType:I eventTime:ISO R
d-071 sourceEventId:I eventTime:ISO R R R instrumentId:I eventType:I
d-072 R eventTime:ISO instrumentId:I eventType:I sourceEventId:I R R
d-078 sourceEventId:I instrumentId:I eventType:I R eventTime:ISO R R
d-079 eventType:I sourceEventId:I instrumentId:I R eventTime:ISO R R
```

</details>

<details>
<summary>AUDIT (60 inputs)</summary>

```text
d-003 eventType:I orderId:I instrumentId:I price:D eventTime:ISO sourceEventId:I
d-004 instrumentId:I eventTime:ISO eventType:I counterpartyId:I sourceEventId:I orderId:I
d-005 instrumentId:I eventType:I sourceEventId:I actorId:I orderId:I eventTime:ISO
d-006 instrumentId:I eventType:I orderId:I sourceEventId:I side:I eventTime:ISO
d-007 actorId:I eventType:I sourceEventId:I eventTime:ISO orderId:I instrumentId:I
d-010 eventTime:ISO sourceEventId:I receivedAt:ISO eventType:I instrumentId:I
d-011 sourceEventId:I eventTime:ISO eventType:I instrumentId:I sequence:I receivedAt:EP
d-012 receivedAt:ISO sourceEventId:I eventTime:ISO eventType:I instrumentId:I orderId:I
d-013 eventTime:ISO sourceEventId:I receivedAt:ISO eventType:I instrumentId:I actorId:I
d-014 sourceEventId:I eventTime:ISO eventType:I receivedAt:ISO orderId:I instrumentId:I
d-017 orderId:I actorId:I instrumentId:I eventTime:ISO eventType:I sourceEventId:I
d-018 eventTime:ISO side:BS eventType:I sourceEventId:I instrumentId:I actorId:I counterpartyId:I
d-019 sourceEventId:I eventTime:ISO side:I instrumentId:I eventType:I actorId:I
d-020 sourceEventId:I eventType:I counterpartyId:I orderId:I eventTime:ISO instrumentId:I actorId:I
d-021 eventTime:ISO orderId:I eventType:I actorId:I sourceEventId:I instrumentId:I side:I
d-024 price:D instrumentId:I eventType:I sourceEventId:I sequence:I eventTime:ISO quantity:D
d-025 quantity:D price:D eventTime:ISO sourceEventId:I eventType:I instrumentId:I
d-026 quantity:D price:D sourceEventId:I eventTime:ISO eventType:I instrumentId:I sequence:I
d-027 instrumentId:I price:D eventTime:ISO sourceEventId:I quantity:D eventType:I orderId:I
d-028 sequence:I instrumentId:I eventTime:ISO eventType:I sourceEventId:I quantity:D side:I
d-031 eventType:I instrumentId:I orderId:I sourceEventId:I actorId:I eventTime:ISO
d-032 eventType:I price:D counterpartyId:I instrumentId:I eventTime:ISO sourceEventId:I
d-033 eventType:I eventTime:ISO actorId:I quantity:D instrumentId:I orderId:I sourceEventId:I
d-034 sourceEventId:I quantity:D eventTime:ISO eventType:I instrumentId:I actorId:I
d-035 orderId:I eventType:I instrumentId:I actorId:I price:D sourceEventId:I eventTime:ISO
d-038 counterpartyId:I sourceEventId:I instrumentId:I eventTime:ISO actorId:I eventType:I
d-039 sourceEventId:I eventType:I instrumentId:I orderId:I receivedAt:ISO eventTime:ISO
d-040 sequence:I instrumentId:I eventTime:ISO sourceEventId:I eventType:I price:D
d-041 instrumentId:I eventTime:ISO sourceEventId:I eventType:I orderId:I counterpartyId:I
d-042 sourceEventId:I price:D quantity:D instrumentId:I eventTime:ISO eventType:I
d-045 instrumentId:I eventTime:ISO eventType:ET orderId:I sourceEventId:I receivedAt:EP
d-046 eventType:ET sourceEventId:I instrumentId:I quantity:D actorId:I eventTime:ISO
d-047 eventTime:ISO price:D sourceEventId:I eventType:I side:BS instrumentId:I
d-048 quantity:D instrumentId:I eventTime:EP eventType:I receivedAt:ISO sourceEventId:I
d-049 actorId:U quantity:D sourceEventId:I orderId:I instrumentId:I eventType:I eventTime:ISO
d-052 orderId:I eventTime:ISO instrumentId:I actorId:I eventType:I sourceEventId:I
d-053 sourceEventId:I quantity:D eventType:I eventTime:ISO instrumentId:I price:D
d-054 sourceEventId:I orderId:I instrumentId:I eventTime:ISO eventType:I quantity:D
d-055 eventTime:ISO instrumentId:I sourceEventId:I eventType:I actorId:I quantity:D
d-056 orderId:I sourceEventId:I counterpartyId:I instrumentId:I eventType:I eventTime:ISO
d-059 eventType:I sourceEventId:I R instrumentId:I R R R eventTime:ISO
d-060 R R sourceEventId:I eventType:I eventTime:ISO instrumentId:I R
d-061 R eventTime:ISO eventType:I sourceEventId:I R R instrumentId:I
d-062 R R sourceEventId:I eventType:I instrumentId:I eventTime:ISO R
d-063 eventTime:ISO instrumentId:I R R R eventType:I sourceEventId:I
d-066 sourceEventId:I R eventType:I R R eventTime:ISO instrumentId:I
d-067 eventTime:ISO R sourceEventId:I R instrumentId:I R eventType:I
d-068 eventType:I R R eventTime:ISO R sourceEventId:I instrumentId:I
d-069 eventType:I R sourceEventId:I eventTime:ISO R instrumentId:I R
d-070 R R eventTime:ISO eventType:I R sourceEventId:I instrumentId:I
d-073 instrumentId:I R sourceEventId:I R eventTime:ISO eventType:I R R
d-074 sourceEventId:I instrumentId:I eventTime:ISO eventType:I R R R
d-075 instrumentId:I sourceEventId:I R eventType:I eventTime:ISO R R
d-076 R R eventTime:ISO instrumentId:I eventType:I sourceEventId:I R
d-077 R eventTime:ISO R sourceEventId:I instrumentId:I R eventType:I
d-080 R eventType:I instrumentId:I R R eventTime:ISO sourceEventId:I
d-081 eventType:I eventTime:ISO R R instrumentId:I sourceEventId:I R
d-082 R eventType:I sourceEventId:I instrumentId:I eventTime:ISO R R
d-083 eventTime:ISO eventType:I R sourceEventId:I instrumentId:I R R
d-084 R eventTime:ISO instrumentId:I eventType:I R sourceEventId:I R
```

</details>
