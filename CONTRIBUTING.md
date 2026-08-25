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

Use synthetic data only. If a new fixture resembles a real system, replace
identifiers, values, timing, and schema details until it cannot expose a person,
customer, venue, or production implementation.

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

## License of contributions

Unless you state otherwise when submitting a contribution, you agree that it
is licensed under the repository's [Apache License 2.0](LICENSE). Do not submit
code, data, documentation, or assets that you do not have the right to license
on those terms.
