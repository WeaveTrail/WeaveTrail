# ADR 0063: Reserve public model budgets in shared daily counters

- Status: Accepted
- Date: 2026-10-07

## Context

The public configured mapping endpoint could call a provider without a shared
spending boundary. Vercel function memory cannot enforce a global cap, and
separate reads and increments can overspend under concurrency.

## Decision

Keep this boundary in the web server, outside the reusable ai-harness adapter.
Every public live attempt uses `runPublicModelRequest`, which first reserves
one visitor request and either one or two global calls in a hosted Redis store.
The current mapping endpoint reserves one call. The callback permits only the
reserved number of attempts; future routed proposals reserve two calls before
any routing attempt, counting once per visitor. Routing and the mutation demo
remain planned. Manual evaluation calls ai-harness directly and bypasses this
public budget. Fixture and encrypted-receipt replay do not call the limiter.

Use built-in fetch with Upstash Redis REST and one Lua EVAL on the primary to
read, check and reserve both counters with absolute expiry. No SDK dependency
or in-memory production fallback is added. Store timeout is three seconds,
including response consumption; prohibit redirects and retries and accept only
the small closed numeric response. Unexpected errors are discarded.

Trust only Vercel's platform environment and single valid
`x-vercel-forwarded-for` IP. Reject other hosts or absent/ambiguous IPs. Normalize
IPv6 spellings and HMAC the IP with a server secret and KST day. Store only that
daily digest key, request count and global reserved-call count. The application
never stores or logs raw IPs. Keys expire at the next 00:00 KST. The Redis clock
rejects a reservation from another day, and the application refuses expired
grants and further attempts. Reservations count when granted, even if the
provider fails or a second attempt is unused. Do not refund ambiguous failures.

The visitor default is 15; the global cap is mandatory configuration. Missing
configuration, unsupported identity, unavailable store or either exceeded cap
fails closed before the callback with HTTP 422 `REVIEW_REQUIRED` and a fixed
reason. Before parsing or reserving, the mapping route requires JSON content
type and rejects any supplied foreign/opaque Origin. No-Origin JSON clients
remain supported; browser cross-origin requests require an ungranted CORS
preflight. Case Replay validates a mapping review response before displaying
its issue messages and ignores responses from an invalidated request.
Existing mapping, approval and receipt contracts and canonical replay
hashes do not change. Recorded runs remain usable without live calls.

## Limits and operations

These are IP budgets, not accounts. Shared IPs share quotas, changed IPs can
change visitors, and daily HMACs are pseudonymous. All spending functions must
share the database, limits and secret. Use dedicated non-evicting storage; a
flush, eviction or mid-day secret rotation can reset counters. Key expiry does
not establish deletion from platform/store logs or backups; operators must
disable key/body logs and prevent counter backups past the KST day.

The cap bounds conservative reserved attempts, not currency or token use.
An attempt started before midnight may finish afterwards. Clock disagreement
at the boundary stops calls rather than extending a day. Other hosting needs
a reviewed trusted-IP adapter; local public requests have no bypass. No live
provider, hosted Redis or Vercel configuration is validated by these tests.

## Verification

Run `pnpm check` and `pnpm build`. Fake-store tests cover under-limit requests,
visitor and global exhaustion, concurrent visitors, routed accounting, daily
HMAC/expiry rollover, store failure and expired/exhausted reservations. Mocked
REST tests cover command encoding, decision/error validation, bounded bodies
and timeouts. Route tests prove denial precedes model transport and recorded
replay makes no additional reservation; client graph checks keep configuration
and limiter code off the browser.
