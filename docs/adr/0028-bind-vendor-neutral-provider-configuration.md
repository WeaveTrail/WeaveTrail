# ADR 0028: Bind vendor-neutral provider configuration

- Status: Accepted
- Date: 2026-09-06

Implementation follow-up: [ADR 0029](0029-bind-configured-mapping-proposals-to-review.md)
implements this selection contract. References below to the planned adapter
describe the state when this configuration decision was accepted.

## Context

The repository currently constructs only the deterministic fixture mapping
provider. A planned structured-output adapter needs stable deployment names
without making one compatible vendor part of the public configuration
contract. It also needs a selection boundary that does not turn the presence of
credentials into an implicit change to the reviewer path.

Provider choice affects an untrusted mapping proposal. It must not affect who
approves the mapping or which deterministic engine computes a result.

## Decision

Keep `AI_MODE` as the explicit selector and bind the planned adapter to
`AI_PROVIDER_BASE_URL`, `AI_PROVIDER_API_KEY`, and `AI_PROVIDER_MODEL`. The
names describe the role rather than one vendor. All four variables are
server-only and may never use a public prefix or reach browser code.

The current application does not read these variables and supports fixture mode
only. The planned adapter will treat unset `AI_MODE` as `fixture` and require
all three provider values for `AI_MODE=ai`. Credential presence alone never
selects configured mode. An explicitly selected configured call that fails or
does not pass the strict mapping contract fails closed as `REVIEW_REQUIRED`; it
does not silently become a fixture proposal.

The previous `OPENAI_API_KEY` and `OPENAI_MODEL` entries were reserved but never
read. They have no runtime compatibility period: local templates migrate to the
new names, and neither old nor new provider configuration belongs in a deployed
environment before the planned adapter is implemented and checked.

A provider may propose a mapping only. The approved mapping is the input to
canonical replay and its result hash, independent of which provider proposed
it. Public status may say **configured provider** only for a proposal produced
by a reproducibly checked configured call; otherwise it says **fixture
provider** or describes configured integration as planned.

The deployment promotion check remains a documented procedure rather than a
new executable script. Browser assets, browser source maps, and public build
logs are deployment outputs unavailable to the repository's unit-test process;
the procedure names the exact static terms and per-run non-secret request and
response substrings that operators must search.

## Consequences

- The planned adapter has one vendor-neutral environment contract to implement.
- Fixture proposals and their published expected results stay deterministic
  while configured-provider credentials are merely available.
- Misconfiguration, transport failure, malformed output, and ambiguous output
  cannot create an approval or canonical result hash.
- A source-level test guards the client module graph, while the promotion check
  guards generated deployment artifacts and logs.
- Adding an executable deployment-output scanner remains possible when stable
  artifact and log inputs exist; this decision does not claim that such a
  scanner runs today.
