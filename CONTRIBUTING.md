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

`pnpm dev` serves the workbench at <http://localhost:3000> with Node 22 or newer
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
requests a retarget.

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
