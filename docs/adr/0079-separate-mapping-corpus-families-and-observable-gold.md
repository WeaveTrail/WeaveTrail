# ADR 0079: Separate mapping corpus families and observable gold

- Status: Accepted for corpus authoring; generation, independent gold review,
  sealing and experiment pre-registration are planned.
- Date: 2026-10-13
- Supersedes: none. ADR 0069's `NO_MODEL` decision and ADR 0075's withdrawal stand.

## Context

The next mapping studies need to separate model selection from evaluation of the
selected policy, and both from reuse on changed input. The existing corpus
generator uses shared semantic slots and includes review-required columns in
every dialect. Renaming those slots cannot establish independent families, and
making every input require review cannot measure where escalation is avoided.

The current validator requires four mapped targets and validates complete
proposals. A correct refusal can therefore be a valid reviewed proposal or a
contract rejection, depending on which fact is unavailable. Reuse adds another
distinction: a local shape check may miss a global target conflict or a semantic
change. Hidden knowledge in a generator must not become an answer that an
input-only model or baseline is expected to discover.

## Decision

Use the [family and gold specification](../MAPPING_CORPUS_SPEC.md) to author new
`SELECT`, `AUDIT` and `DRIFT` inputs. The specification fixes construction and
review obligations; its inventory sizes are proposed values for a later audited
pre-registration, not an accepted experimental run protocol.

- Author a semantic problem and visible evidence per family. Keep templates and
  all derived dialects, mutations and repeats in their common lineage. Audit
  independence before treating the proposed family count as an analysis unit.
- Separate resolvable, hard-but-resolvable and must-review strata. Keep the
  existing seven column tags without requiring all tags in every dialect.
- Keep per-column answers, whole-proposal validation and route disposition as
  separate gold layers. Author finite semantically equivalent transform answers
  before a run, and version scoring separately from historical exact agreement.
- In DRIFT, distinguish local change classification, full assembled-mapping
  validity and semantic correctness. Equal visible inputs have equal input-based
  gold; hidden truth belongs to a separate limitation probe.
- Project the same bounded inputs to every arm. Keep gold and study labels
  offline. Review without model outputs, then seal inputs and gold together.
- Define B0, B1, primary-only, escalation-only and routed comparison roles.
  Require the baselines' DEV sources, code/rule/vocabulary hashes and the
  routing trigger, whole-output selection, versions and limits to be frozen in
  the audited pre-registration before the first paid call. Only P/E identities
  are later filled by the pre-declared SELECT rule; no SELECT-driven tuning of
  those comparison definitions is permitted.

No eligibility threshold, prompt, runtime validator, route, approval contract or
published score changes here. Generation and runner work must add explicit new
contracts, not disguise a new split as historical HELD_OUT. The later experiment
pre-registration must keep required-field refusal probes outside SELECT/AUDIT
eligibility denominators, and fix analysis, budgets and stop rules independently.

## Consequences

The construction specification can guide offline implementation while the live
mapping path stays off. It also makes invalid experimental shortcuts reviewable:
renames counted as independent observations, gold based on hidden semantics,
correct refusals credited from transport errors, and unchanged columns reused
without checking the assembled mapping.

Independent authorship/review and overlap checks do not prove a public corpus
was never seen during model training. The small proposed family counts and
balanced strata do not establish real service prevalence or rare-error safety.
Deterministic reuse measurements remain distinct from AI gains and observed
human effort. No corpus, sealing command or new measurement is delivered by this
ADR; those artifacts must demonstrate these requirements before execution.
