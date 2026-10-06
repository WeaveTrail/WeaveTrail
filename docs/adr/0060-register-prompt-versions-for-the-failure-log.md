# ADR 0060: Register prompt versions for the failure log

## Status

Accepted.

## Context

The [AI failure log](../AI_FAILURE_LOG.md) must list every prompt version with
what changed, why and whether it burned a held-out set. Deriving that list by
scanning source syntax is never complete: each new form (constants, assignments,
default values, JSX attributes, spreads) needs another parser rule, and a missed
form lets a deployed version stay out of the public table while checks pass.

## Decision

Keep one registry, `PROMPT_VERSIONS` in `packages/contracts`, with the
`PromptVersion` type and an `isPromptVersion` guard. `ProviderTrace.promptVersion`
has type `PromptVersion`, so a mapping provider cannot report an unregistered
version without a type error. Scenario case-manifest traces check their literals
with `satisfies PromptVersion`, and the web server rejects a sealed mapping
receipt whose trace carries an unregistered version.

The failure-log check requires each log's prompt-version table to equal the
registry exactly. Its type-checked source scan stays as a backstop that fails on
an unregistered or non-literal value at the forms it recognizes; it is not the
source of truth.

The case-manifest and mapping-run-record Zod schemas keep accepting any
nonblank identifier. Narrowing them would change runtime contracts and reject
existing test manifests, and neither carries a prompt to a model.

## Consequences

Adding or changing a prompt version is one registry edit plus its log row, both
enforced by `pnpm typecheck` and `pnpm test`. A version introduced outside the
typed traces, for example a free-form string passed to an untyped prop, is not
caught by the compiler; review and the backstop scan cover only what they can
see. Test-only identifiers are not registered because they never reach a model.
