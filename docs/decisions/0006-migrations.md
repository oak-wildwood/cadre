# 0006 — Migration runner: hand-rolled, not Drizzle

**Status:** accepted
**Date:** 2026-09-27

## Decision

Migrations are plain, numbered SQL files under `migrations/NNNN_<slug>.sql`, forward-only.
`src/storage/migrate.ts` is a small hand-rolled runner: it takes a single `query(sql)` function
and an array of `{ version, name, sql }` migrations, creates a `schema_migrations` table if
needed, and applies whichever versions aren't yet recorded there, in ascending version order.
`query` is intentionally the same one-argument shape PGlite's `exec()` and `pg`'s
`client.query()` already have, so the same runner and the same `.sql` files work against both
without an adapter-specific migration format.

## Why, and what threat it addresses

AGENTS.md rule 5 makes the repository interface the migration boundary between browser (PGlite)
and server (Postgres): the same schema has to exist on both sides, unmodified, or "migrating
between them is a re-encryption, not a rewrite" (README principle 5) stops being true. Drizzle
was considered — it was named in the issue as an acceptable alternative — but its migration
tracking and its dialect-specific drivers (`drizzle-orm/pglite` vs `drizzle-orm/node-postgres`)
would mean either two migration sets or a custom driver bridging them, which is more moving parts
than the ~70-line runner this replaces. Keeping migrations as plain SQL also means every
statement that shapes the encrypted-PII schema (`members`, its `*_enc`/`*_bidx` columns) is
readable directly, not generated through an ORM's DSL — smaller surface for anyone auditing what
touches that table, which matters for a project whose entire premise is that this schema is
sensitive (README's "compromised server" and "legal compulsion" threat-model rows).

## Alternatives considered

- **Drizzle ORM** — rejected for now per the reasoning above; revisit if a later phase needs
  Drizzle's query builder for reasons beyond migrations.
- **Parameterized `query(sql, params)` for the runner's own bookkeeping** — rejected; PGlite's
  `query()` (parameterized) only accepts a single statement, while a migration body can have
  several, so the runner needs `exec()`-style multi-statement execution regardless. Keeping
  `Query` single-argument avoids needing both call shapes, and the one place the runner builds
  SQL itself (`schema_migrations` bookkeeping) uses a version/name character-set check instead of
  parameters to close the injection risk that interpolation would otherwise open.

## Consequences

Every migration file must be plain SQL runnable by both PGlite and Postgres — no dialect-specific
syntax. An adapter wiring this runner in (the PGlite/Postgres repository issues) must route
`query(sql)` through its driver's multi-statement execution path (`db.exec()` for PGlite; plain
`client.query(sql)` for `pg`), not the parameterized one.
