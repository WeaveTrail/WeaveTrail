# ADR 0039: Verify evidence bundles from declared source bytes

## Status

Accepted.

## Context

ADR 0024 fixed the Evidence Bundle 1.3 hash preimages before an assembler or
verifier existed. Subsequent committed artifacts added Event 1.3 and Mapping
1.7/1.8, including the published-schema synthetic execution scenario. A bundle
verifier must also derive `rawRowHash`, canonical events, findings and hashes
without trusting the declaration it is checking.

The export shape intentionally contains source hashes rather than raw bytes.
Those bytes therefore have to be supplied independently at verification time.
The current request replay path accepts one mapping and does not define how
multiple mapped sources form one dataset.

## Decision

Extend the opt-in 1.3 unions to Event 1.3 and Mapping 1.7/1.8 without converting
older events or proposals. Add their fields to the published hash table. Keep
Manifest 1.3 and the Rapid Price Lift result as the bundle's case/evaluation
boundary; later case and rule families require their own explicit bundle
contract decision.

`assembleEvidenceBundle` accepts exact CSV or JSON Lines bytes, mapping and
optional case declarations. It hashes and parses the bytes, validates approval
binding, runs deterministic normalization and evaluation, and computes both
declared hashes. `verifyBundle` treats the bundle as untrusted, repeats assembly
from separately supplied bytes, and compares the complete declaration and all
nested hashes. A declaration that stops at mapping review has no `replay`.

Reject more than one mapping until multi-source replay semantics exist. Do not
infer joins, source priority or event conflict policy merely because the bundle
contract uses arrays. Preserve the legacy 1.2 contract without conversion.

## Consequences

Every currently committed single-source artifact admitted by the 1.3 unions can
be assembled and independently checked, including the published FIX execution
scenario and declarations with no replay result. INCONCLUSIVE evaluations retain
their reason and empty findings with `sensitivity: null`; no metric value is
invented.

Verification detects changes relative to the supplied source bytes and claimed
hashes. It does not authenticate source publishers or reviewers and supplies no
signature. A party that needs origin authentication must provide a separate
trusted signature or hash channel.
