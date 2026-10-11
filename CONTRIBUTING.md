# Contributing to WeaveTrail

Thanks for helping make event verification more reproducible. Start with an
issue that states the capability, why it matters, and the observable evidence
that will demonstrate it.

## Development

```bash
pnpm install
pnpm check
pnpm build
```

`pnpm figures:build` writes the boundary figures the design documents embed
from `scripts/boundary-figures.mjs`; `pnpm figures:check` fails when a committed
figure no longer matches that source, and `pnpm figures:test` exercises the
renderer. Both run in `pnpm check` and CI, so a diagram and the words around it
change together.

`pnpm adr:check` validates ADR filenames, first-line headings, unique numbers,
and local ADR links. `pnpm adr:test` exercises the validator's regression
fixtures; both commands run in `pnpm check` and CI. Markdown links are relative
to the containing document. JavaScript and TypeScript documentation comments
may also use repository-root `docs/adr/...` references. Code examples and source
string literals are not live references. See
[ADR 0045](docs/adr/0045-parse-adr-references-as-documentation.md) for the parser
boundary and check limitations.

`pnpm eval` verifies the committed fixture evaluation and writes a stable JSON
summary plus an actual environment and checkout receipt to `dist/evaluation/`.
It never updates expectations. See [the evaluation protocol](docs/EVALUATION.md)
for case definitions, captured results and limits. Its publication assertion also
runs in `pnpm test`; CI runs the command to exercise receipt generation.

`pnpm eval:mappings:score` re-scores the committed synthetic mapping-run records
against sealed gold and a dated synthetic price table, then verifies the committed
summary byte for byte. Its regression tests also run in `pnpm test`. These are
scorer fixtures, not model performance measurements; see the
[mapping metric definitions](docs/EVALUATION.md#offline-mapping-run-scoring).

`pnpm eval:mappings:compare` reproduces the DEV-only lexical reference records,
scores them beside authored synthetic controls with the same scorer, and checks
the committed comparison and explicit selection-record fixture byte for byte.
Publish mapping comparisons through this command or `eval:mappings:score
--records`; both include the reference automatically. The reference is never a
selection candidate. See [the baseline protocol](docs/EVALUATION.md#non-model-lexical-reference).

`pnpm eval:schemas:generate:v2` reproduces the new sealed corpus and DEV-only
vocabulary. `pnpm eval:models:held-out --live --catalogue <attestation.json>`
checks committed pre-run inputs and records three attempts per model and dialect.
`pnpm eval:mappings:select --session <session directory>` verifies one
receipted session and applies the rule of the protocol it was run under offline,
writing the comparison, selection record and a hash-bound primary/escalation decision. See [the run protocol](docs/EVALUATION.md#run-and-reproduce) before a live
run. CI exercises mock transports and offline replay of the committed first
held-out session. That session selected no model: all 180 requests failed with
`HTTP_ERROR`. See the [captured result](docs/EVALUATION.md#first-held-out-session-2026-10-08).

Earlier evaluation captures with withdrawn sources remain historical records.
The current `pnpm eval` verifies synthetic-only v3; see [the evaluation protocol](docs/EVALUATION.md).

`pnpm test:browser` runs the Playwright browser flows in `apps/web/e2e`
against the production build: run `pnpm build` first and install Chromium once
with `pnpm exec playwright install chromium`. CI runs it after the build.

`pnpm dev` serves the workbench at <http://localhost:3000> with Node 22.13 or newer
and pnpm 10.33.2; `/replay` opens the guided walkthrough, also addressable as
`/replay?mode=guided`, and `/replay?mode=working` opens working mode.

Prefer synthetic data. If a synthetic fixture resembles a real system, replace
identifiers, values, timing, and schema details until it cannot expose a person,
customer, venue, or production implementation.

Real data may be committed only under the provenance conditions in
[AGENTS.md](AGENTS.md): its published licence must permit commitment,
modification, and redistribution, and its provider, origin, retrieval date,
licence, and required attribution must be recorded beside it. A real source
artifact and its derived rows carry no fabricated attribute. A versioned rule
may separately evaluate a real market index or contract, but may publish the
result only within the safeguards in
[ADR 0034](docs/adr/0034-evaluate-real-instruments-without-altering-source-facts.md).

## Change requirements

- Contract changes include migration notes and public documentation.
- Replay-engine changes include a golden or invariant test.
- New findings remain traceable to source events and `rawRowHash`.
- A fix for a model or validator failure ships with its `F-nnn` entry in the
  [AI failure log](docs/AI_FAILURE_LOG.md) and a regression test that fails
  without the fix. A new or changed prompt version is added to the
  `PROMPT_VERSIONS` registry in `packages/contracts` and listed there with what
  changed, why, and whether it burned a held-out set.
- Measurements include their dataset version, command, environment, and known
  limits.
- Pull requests report only checks actually run, using `PASS`, `FAIL`, or
  `SKIP` with a reason.

See [AGENTS.md](AGENTS.md) for the trust, determinism, evidence, and language
invariants that apply to every change.

## GitHub conventions

The release-batching branch workflow is:

```text
feature/* -> develop -> main
```

New work is pushed to a short-lived feature branch and opened as a pull
request into `develop`. The `develop` branch is the integration branch. A
separate pull request from `develop` into `main` promotes an accumulated,
reviewed set of changes for production. Do not push directly to `develop` or
`main`. The default base branch for a new pull request is `develop`, and new
work starts from an up-to-date `origin/develop`. If `origin/develop` is
unexpectedly unavailable, stop and report it rather than silently using `main`
as the base. Existing pull requests keep their current base unless their owner
requests a retarget. An explicitly authorized emergency hotfix is the
exception: create it from an up-to-date `origin/main`, target `main`, and carry
the merged fix back into `develop` before ordinary development continues.
After a production rollback, that `origin/main` still holds the failed release
and its merge is not served, and `main` takes no other merge, an ordinary
promotion included, until that hotfix is promoted, released and carried into
`develop` (step 5 of that procedure); follow
[hotfix after a rollback](docs/DEPLOYMENT.md#hotfix-after-a-rollback) to fix
forward and promote the gated deployment, and never revert the promotion merge.

Each GitHub milestone names one version, such as `v0.1.0`, and every promotion
to `main`, a hotfix included, ships one milestone. Give an issue the milestone
of the minor version it is planned for; patch versions are reserved for
hotfixes. Leave an issue without a milestone when no version plans it yet. A
promotion ships everything merged into `develop` since its last merge into
`main`, and the milestone is reconciled with that range before the promotion
merges; an issue still open then moves out of it. Pull requests do not carry
milestones; the release notes list those no issue in the milestone represents.
Milestones have no due dates. The promoted `main` commit is tagged `vX.Y.Z` and
published as a GitHub release; see
[versions and release tags](docs/DEPLOYMENT.md#versions-and-release-tags).

Use these distinct title forms:

- Issue: `<type>: <lowercase summary>`.
- Pull request: repeat the linked issue title verbatim, with no scope, trailing
  `#<number>`, or paraphrase.
- Commit: `<type>(<scope>): <summary> #<issue-number>`.

Rely on the repository's automatic review instead of posting a duplicate
trigger comment. When replying to a review thread, use this structure:

```text
[result] one-sentence work summary
in commit: <commit_hash>
- problem
- work
- resolution
```

Keep the list to two to four short bullets and omit a separate `Summary`
heading. Resolve review threads only when the task explicitly includes
resolution.

## License of contributions

Unless you state otherwise when submitting a contribution, you agree that it
is licensed under the repository's [Apache License 2.0](LICENSE). Do not submit
code, data, documentation, or assets that you do not have the right to license
on those terms.

## Mapping transport recovery

[ADR 0069](docs/adr/0069-recover-mapping-transport-with-a-fresh-held-out-set.md)
ran on fresh v3 inputs; the used v2 and v3 sessions remain reproducible offline.
`pnpm eval:schemas:generate:v3` reproduces the v3 seal.
`pnpm eval:models:diagnose --live --legacy-store` reproduces the removed request
parameter on v2 DEV only. Explicit diagnostics and `--diagnostics` write private
bounded error bodies under ignored `.model-runs/raw/`; never commit those files.

## Mapping selection retry

The live held-out command targets protocol 3 of
[ADR 0075](docs/adr/0075-retry-mapping-selection-with-column-ids-and-a-fresh-corpus.md):
columns are named by opaque IDs, the stack is `adr-0075-r2` (prompt
`schema-mapping/4`, adapter `openai-compatible-mapping/4`), and the inputs are
`schema-dialects/4`. It refuses to run until that ADR is accepted
with a dated price table; its pre-run gate 2 did not pass on 2026-10-10, and
the ADR was withdrawn before acceptance on 2026-10-11, so the command stays
refused.
`pnpm eval:schemas:generate:v4` reproduces both v4 splits and the DEV-only
reference vocabulary. `pnpm eval:models:dev-gate --live` runs the before and
after stacks on v4 DEV, and `pnpm eval:mappings:dev-gate --before <session>
--after <session>` applies the pre-run gate offline.
The offline gate accepts only the two sessions of one gate run.
`pnpm eval:models:diagnose --live` probes each declared candidate once on v4 DEV
with that stack and writes a sanitized status-and-outcome file. See the
[retry protocol](docs/EVALUATION.md#retry-protocol-column-ids-and-fresh-v4) before a live run.
