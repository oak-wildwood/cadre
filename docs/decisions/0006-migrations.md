# 0006 — SQL migration runner

**Status:** accepted
**Date:** 2026-09-24

## Decision

Migrations are hand-rolled, not Drizzle. Numbered, forward-only SQL files live under
`migrations/NNNN_<slug>.sql`; a small runner (`src/storage/migrate.ts`) applies them by calling
a caller-supplied `query(sql, params)` function — the same shape PGlite's and `pg`'s own query
methods already have — and tracks applied versions in a `schema_migrations` table it creates
itself on first run. `0001_init.sql` adds `members` and `settings`.

## Why, and what threat it addresses

The repository interface (`docs/decisions/0005-repository-interface.md`) is the actual
migration boundary between PGlite and Postgres (AGENTS.md rule 5); the runner only needs to be
"a function of `query` that both engines can supply," so there's no real capability Drizzle
would add here. What it would add is a schema-builder DSL between "what I wrote" and "what DDL
actually runs" — a cost, not a convenience, for a schema this small and this security-sensitive.
The "Compromised server" and "Legal compulsion" rows of the threat model (README summary) turn
on specific, auditable column facts: which fields are `bytea` ciphertext, which get a `bytea`
blind-index column, and that those blind indexes are equality-only (AGENTS.md's blind-index
invariant). Reading plain `CREATE TABLE`/`CREATE INDEX` statements makes those facts checkable
by inspection; reading them back out of a TypeScript schema-builder call is one more translation
a reviewer has to trust. Hand-rolled SQL keeps that translation step at zero.

## Alternatives considered

- **Drizzle**, targeting both PGlite and Postgres from one schema (the issue's suggested
  alternative) — rejected for now. Drizzle's own migrations are SQL under the hood, generated
  from a TypeScript schema; for a schema this small, writing that SQL directly is no more work
  and is what actually gets reviewed against the threat model. Revisit if the schema grows
  enough that duplicating DDL per engine becomes the real burden — that hasn't happened at one
  migration file.
- **`node-pg-migrate` or another `pg`-specific migration framework** — rejected: it assumes the
  `pg` driver specifically. PGlite's query method is shaped closely enough like `pg`'s that a
  ~40-line runner covers both without a new dependency, which is what "tiny" in the issue meant.

## Consequences

Schema changes are forward-only: a new `NNNN_<slug>.sql` file, never an edit to one already
merged, and no down-migrations. `migrate.ts` itself must stay free of Node-only APIs (no
`node:fs`) so it stays safe to bundle into the browser PGlite adapter later; reading migration
files off disk is a separate module (`loadMigrations.ts`) for exactly that reason, used by tests
today and by a server-side (`pg`) adapter later.
