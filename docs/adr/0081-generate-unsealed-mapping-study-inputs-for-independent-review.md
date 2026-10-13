# ADR 0081: Generate unsealed mapping study inputs for independent review

- Status: Accepted for offline draft generation; independent review, sealing,
  measurement tooling and experiment pre-registration remain planned.
- Date: 2026-10-13
- Related issues: #277, #292
- Builds on: [ADR 0079](0079-separate-mapping-corpus-families-and-observable-gold.md)

## Context

The family specification needs concrete provider-visible tables and proposed
answers that a second reviewer can inspect before freezing an evaluation. The
historical DEV/HELD_OUT contracts cannot represent SELECT/AUDIT allocation or
DRIFT's distinction between observable gold and hidden scenario truth.

## Decision

Use the offline `mapping-study-inputs/1` draft contract. Keep projected headers
and two sample rows separate from family/gold records, generated base approval
fixtures and parent-relative changes. Column IDs are opaque supplied-order IDs.
Sort base columns by a seeded hash of family ID and header, never target labels.
Preserve base order for same-shape and identical follow-ups. Hidden semantic
changes retain byte-identical visible input and input-based gold; the different
scenario truth is recorded only offline.

Author individual semantic problems, evidence relationships and alternative
interpretations. Rendering helpers implement the shared contract representations.
An overlap report compares every proposed family, plus prior DEV/used material,
for hashes, normalized header tuples, decoded attacks, declared lineage,
slot structures and naming grammar. It deliberately does not read v4 HELD_OUT.
Shared slot/grammar signatures remain independent review findings. Distinct
hashes, prose and proposed lineage IDs cannot establish independent families.

Every manifest is `UNSEALED` and `liveRunnerEligible: false`. Its checksums bind
draft bytes and source/lockfile hashes for reproduction; they are not a seal or
an independent gold-review decision. Record all reviewers as pending and retain
an explicit empty exclusion ledger, ready to record excluded versions and hashes.
Keep actual checkout/environment/time in a separate receipt. A working-tree
generator's source hashes are authoritative when its checkout receipt predates
the authoring commit. Verify the captured receipt's strict shape, original-byte
SHA-256 checksum and manifest binding separately from deterministic regeneration.
The receipt and checksum are explicit exceptions to the generated JSON set;
checksums do not attest to the authenticity of environment metadata.

`eval:corpus:check` reconstructs all draft bytes, runs shared-validator witnesses
and allocation checks, and fails on changes without rewriting expectations.
Enumerate the fixture directory, including nested files, and reject unexpected
artifacts so removed or renamed outputs cannot silently remain in the draft set.
Existing model/scoring contracts reject the new split/version shape. No new
selection, routing implementation, automatic approval or paid call follows from
generation. Evaluation inputs/gold remain outside production imports and assets.

## Consequences and limits

The proposed allocation is concrete and inspectable: 24 SELECT inputs, 60 AUDIT
inputs and 12 DRIFT bases with six follow-ups each. The independent family count
is not established. Review must derive answers from the exact projection first,
resolve or exclude disagreements and examine semantic/lineage overlap before
sealing. Authored evidence and automated validator acceptance are not independent
proof of semantic correctness.

Generated correct-base approvals are favorable experiment fixtures, not observed
human approvals. Changed artifacts reject the base approval's hash. Identical
inputs naturally share that hash; a new task still requires explicit approval,
whose reuse-task enforcement remains part of the later reuse implementation.
Full reused/new-field assembly, incorrect-base propagation and skipped
revalidation probes also remain there. Scheduled-call and review-field savings
are not measured here. Public drafts provide immutability after review, not
secrecy or proof of absence from training data. `NO_MODEL` remains unchanged.
