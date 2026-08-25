# ADR 0002: Volatile metadata stays outside the canonical hash

- Status: Accepted
- Date: 2026-08-25

## Context

An export may need creation times, request IDs, or provider latency, but those
values differ between otherwise identical runs. Including them would make a
determinism claim impossible to verify with a plain hash comparison.

## Decision

`canonicalResultHash` covers only normalized inputs, the approved manifest,
versioned calculations, and stable findings. Timestamps, run IDs, request IDs,
and other execution metadata are stored outside that canonical payload.

## Consequences

Two equivalent replays can be compared byte-for-byte at the canonical payload
boundary. Export metadata remains useful, but it cannot silently influence the
technical result.
