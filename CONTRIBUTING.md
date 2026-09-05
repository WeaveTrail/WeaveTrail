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
and pnpm 10.33.2; the guided walkthrough is at `/replay?mode=guided`.

Prefer synthetic data. If a synthetic fixture resembles a real system, replace
identifiers, values, timing, and schema details until it cannot expose a person,
customer, venue, or production implementation.

Real data may be committed only under the provenance conditions in
[AGENTS.md](AGENTS.md): its published licence must permit commitment,
modification, and redistribution, and its provider, origin, retrieval date,
licence, and required attribution must be recorded beside it. A real artifact
carries no fabricated attribute.

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
