# ADR 0003: Use nanosecond UTC and code-unit ordering

- Status: Accepted
- Date: 2026-08-25

## Context

Canonical replay must produce the same event order and hash on another
machine. `Date.parse` discards precision below a millisecond, while
`localeCompare` can change order with the host locale and ICU data. Treating a
missing sequence as an empty string also silently invents an order for inputs
whose sequence policy is ambiguous.

## Decision

The replay engine normalizes every supported `eventTime` to
`YYYY-MM-DDTHH:mm:ss.sssssssssZ`. It converts the explicit source offset to UTC,
pads the fraction to nine digits, and compares signed epoch nanoseconds with
`BigInt`. Supported inputs use a four-digit ISO calendar year, uppercase `T`,
`Z` or an explicit `±HH:MM` offset, and zero to nine fractional digits. Offset
normalization must remain inside UTC years `0000` through `9999`. Calendar
components use the proleptic Gregorian calendar: months are `01` through `12`,
days must exist in their month under the Gregorian leap-year rule, hours are
`00` through `23`, and minutes and seconds are `00` through `59`. Offset hours
are `00` through `23` and offset minutes are `00` through `59`. Leap seconds
are unsupported and fail closed.

Canonical JSON keys, numeric sequence tie-breakers, and event IDs use
lexicographic UTF-16 code-unit order through JavaScript relational string
comparison. They do not use host collation. Strings are not Unicode-normalized,
so distinct code-unit sequences remain distinct identifiers. Canonical key
order is produced directly by serialization; it does not rely on JavaScript
object property insertion or enumeration order. Canonical JSON rejects
non-finite numbers instead of allowing JSON serialization to convert them to
`null`; protected decimal payloads remain strings. Object properties whose
value is `undefined` are omitted, matching JSON object serialization so that
equivalent key-presence representations remain identical. An `undefined`
array element is rejected because converting it to `null` would silently turn
a missing element into an explicit value.

The current canonical dataset is one ordered source stream. Its events must
either all declare `sequence` or all omit it. Mixed presence raises
`MIXED_SEQUENCE_PRESENCE` before ordering or hashing. When sequence is absent
for every event, `eventId` is the tie-breaker for equal event times.

## Contract migration

Inputs with more than nine fractional digits previously passed the broad ISO
schema but are now rejected. Producers must emit no more than nanosecond
precision without rounding inside WeaveTrail. Datasets that mix sequence
presence must resolve that source policy before replay; WeaveTrail will not
fill or discard sequence values.

Canonical event-time strings and result hashes change because accepted source
offsets now converge on the fixed UTC representation. A literal golden hash
must be pinned only after the remaining canonical identity and projection work
is complete.

## Consequences

Equivalent offset notations and sub-millisecond events now have one explicit,
runtime-independent ordering representation. The stricter timestamp and
sequence limits favor fail-closed replay over silently losing precision or
inventing order. Multi-stream sequence semantics remain outside the current
single-stream foundation.
