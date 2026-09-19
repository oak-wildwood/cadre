# 0005 — Repository interface

**Status:** accepted
**Date:** 2026-09-17

## Decision

`LedgerRepository`, defined in `src/domain/LedgerRepository.ts`, is the single interface all
storage code implements: `create`, `read`, `update`, `delete`, `list`, `findByBlindIndex`,
`purgeExpired`, `exportEncrypted`, `importEncrypted`. UI and application code depend only on
this interface, never on `PGliteRepository` or `PostgresRepository` directly. Every
implementation must pass the same `repository.contract.spec.ts` unchanged — a
`describeRepositoryContract(factory)` helper that adapter test files import and call with their
own factory. This PR ships the interface, the domain types it's built from (`Member`,
`NewMember`, `MemberPatch`, `MemberId`, `SensitiveField`, `ListQuery`, `Page`), the contract
spec, and a test-only `InMemoryRepository` fake that is the first thing to pass it. No PGlite or
Postgres code is part of this decision or this PR.

Sensitivity is not encoded in these types. `Member` has no "encrypted" variant — the interface's
job is the shape of the data, not which fields get encrypted at rest. That classification lives
in `sensitiveFields.ts` (a separate issue); the adapter is what refuses to put a sensitive field
where plaintext would land (a `list` filter, a log line, a cache key).

## Why, and what threat it addresses

The whole premise of the README's principle 5 ("the same app runs against Postgres-in-the-browser
and Postgres-on-a-server, so migrating between them is a re-encryption, not a rewrite") only
holds if there is exactly one interface and both storage engines are adapters behind it. Two
interfaces — or one interface with an escape hatch for "just this one query, direct to the
driver" — is how migration code ends up special-casing one engine's behavior, which is exactly
the coupling this phase exists to prevent (AGENTS.md rule 5). Contract tests are what make that
enforceable rather than aspirational: an adapter that passes the same test file as every other
adapter cannot silently drift in behavior (e.g. `delete` leaving a tombstone on one engine but
not the other), which matters because "coherent, recoverable-by-nobody-but-the-org" behavior
(the project's framing, see the README) has to be identical regardless of which storage the org
is currently running.

**`findByBlindIndex` is on the interface, not folded into `list`'s filter, because the two need
different guarantees.** `list`'s filter is restricted to structural, non-sensitive fields
(`expiresAt`, ordering by timestamps) and can be a loose, general-purpose query shape — nothing
about it touches ciphertext. `findByBlindIndex` is the only sanctioned way to look up a member by
a sensitive field, and it is deliberately narrow: equality only, against an HMAC of a normalized
value, per AGENTS.md's blind-index invariant ("do not improve search by indexing substrings or
prefixes of encrypted fields; that leaks the plaintext structure"). If it lived inside a general
`list({ filter })` shape, it would be one step away from someone adding `contains` or `startsWith`
support to that same filter object later, for a legitimate-looking search feature, without
realizing they'd just built a plaintext-structure leak on top of "encrypted" storage. A separate,
narrowly-typed method with a name that says "blind index" makes that mistake need a deliberate
interface change instead of a one-line filter addition — the "compromised server" and "legal
compulsion" rows of the threat model (README summary) are exactly what a leaked field structure
would undermine.

**`exportEncrypted`/`importEncrypted` are on the interface, not a separate service layered on top
of `list`+`create`, because export/import is the browser→server migration path this whole phase
is building toward** (roadmap phase 5, `datamig`), and because "exports are encrypted by default"
is a project invariant (AGENTS.md), not an option an export UI might expose. Making it a method
every adapter implements means every adapter is required to produce and consume the same bundle
format, which is what makes migration a re-encryption rather than a bespoke ETL script per
engine pair. If export/import lived outside the interface as a standalone utility that walked
`list()` pages, it could technically work today, but nothing would stop a future adapter from
being usable for CRUD while quietly failing to round-trip through export/import — the contract
spec's round-trip-into-a-fresh-repository test exists specifically to catch that.

## Alternatives considered

- **Separate `SearchableRepository` interface with a general filter DSL** — rejected; a filter
  object expressive enough for real search needs is also expressive enough to accidentally leak
  plaintext structure through blind indexes, which is the exact mistake the blind-index invariant
  exists to prevent.
- **Export/import as a standalone module operating on `list`/`create`** — rejected; decouples
  the bundle format from the adapter, so a new adapter could implement CRUD correctly while
  producing an export bundle no other adapter's import could read, with no test catching it until
  a real migration.
- **Encoding sensitivity in the `Member` type itself** (e.g. a branded `Encrypted<T>` wrapper) —
  deferred to the `sensitiveFields.ts` issue; mixing that concern into this interface now would
  couple the migration-boundary shape to a classification scheme that hasn't been designed yet.
- **No shared contract spec; each adapter writes its own tests** — rejected; without one contract
  file every adapter implements, "passes the same tests" degrades into "passes tests someone
  wrote for that adapter," which is what let PGlite- and Postgres-only behavior drift apart in the
  first place.

## Consequences

Adding a PGlite or Postgres adapter later means implementing `LedgerRepository` and running
`describeRepositoryContract` against it — no interface change should be needed for phases 2
("Server data layer") through 5 ("Migration CLI") unless a genuinely new capability is required,
in which case the change happens here, with its own decision record update, not as a per-adapter
divergence. `sensitiveFields.ts` will need to slot `SensitiveField` and adapter-side encryption
in without changing this file's public shape. The `InMemoryRepository` fake in
`repository.contract.spec.ts` is test-only, uses no real cryptography, and must never be reused
outside test code — the file name and its doc comment are the only guardrail against that today.
