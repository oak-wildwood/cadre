# 0006 — Migration runner

**Status:** accepted
**Date:** 2026-09-25

## Decision

Schema changes are numbered SQL files under `migrations/NNNN_<slug>.sql`, forward-only, applied
by a hand-rolled runner (`migrate()` in `src/storage/migrate.ts`) rather than Drizzle. The
runner takes a `QueryFn` — `(sql: string) => Promise<unknown>`, the shape `@electric-sql/pglite`'s
`db.exec` and `pg`'s `Client.query` already share — so the same ~70-line function applies
migrations to PGlite now and Postgres later with no adapter-specific branch. It tracks applied
versions in a `schema_migrations` table it creates itself, and sends each migration's SQL and
its `schema_migrations` bookkeeping row to `query` in a single call: Postgres's simple query
protocol runs a multi-statement string as one implicit transaction, so a failure partway through
a migration leaves neither the schema change nor its bookkeeping row committed, without the
runner managing `BEGIN`/`COMMIT` state across separate calls itself.

`0001_init.sql` (also this issue) is the first migration: a `members` table and an org-level
`settings` table. `members`' sensitive columns follow `SensitiveField` in `src/domain/member.ts`
(the interim source of truth until `sensitiveFields.ts` lands) — one `*_enc` `bytea` column per
sensitive field and one `*_bidx` `bytea` column per blind-indexed field, plus an index on
`expires_at` and on each `*_bidx` column.

## Why, and what threat it addresses

The repository interface (`docs/decisions/0005-repository-interface.md`) is what makes migrating
an org from browser to server a re-encryption instead of a rewrite (README principle 5); the
schema both engines read is the other half of that promise; a schema that a small org's own
maintainers can read start to finish in one file, with no ORM-specific migration-state format or
codegen step between the SQL and what runs, is what makes it *auditable* by the org running it —
not just correct. That matters more here than a typical CRUD app: the "compromised server" and
"legal compulsion" rows of the threat model (README summary) assume the operator may need to
prove to itself, without trusting a vendor's tooling, exactly what's in its own database schema.
Drizzle was the named alternative in the issue this decision comes from, and it can target both
PGlite and Postgres from one migration folder (`drizzle-orm/pglite/migrator` and
`drizzle-orm/node-postgres/migrator` both apply the same `.sql` files) — so it isn't ruled out on
technical grounds. It's ruled out because it's a new dependency whose migration-tracking table,
locking behavior, and file-discovery conventions this project would then need to trust and keep
working across two runtimes, for a job a self-contained function already does: read a list of
`{version, name, sql}`, skip what's already in `schema_migrations`, apply the rest in order.

**Bookkeeping is sent in the same call as the migration's SQL, not wrapped in explicit
`BEGIN`/`COMMIT` around separate calls,** because that leans on a guarantee Postgres's wire
protocol already provides (a multi-statement simple-query message is one implicit transaction)
instead of the runner assuming two `QueryFn` calls in a row necessarily share connection and
transaction state — an assumption that would tie the runner to how a specific `QueryFn`
implementation happens to be wired up, which is exactly the kind of adapter-specific coupling the
repository interface exists to avoid.

## Alternatives considered

- **Drizzle** — technically possible (see above); rejected for the dependency and its own
  migration-tracking surface, not for a technical gap.
- **Explicit `BEGIN`/`COMMIT`/`ROLLBACK` issued as separate `query()` calls per migration** —
  rejected; correct only if the caller's `QueryFn` preserves transaction state across calls on
  the same connection, which the runner has no way to verify and shouldn't need to assume.
- **`CREATE TABLE IF NOT EXISTS` / idempotent DDL in every migration file, instead of tracking
  applied versions** — rejected; it hides drift (a table with the wrong columns because a later
  migration failed silently) instead of surfacing it, and doesn't give ordering guarantees for
  migrations that aren't pure `CREATE`s.

## Consequences

A future migration that needs data transformation (not just DDL) works the same way — its SQL
runs in the same single `query` call as its bookkeeping row, so it gets the same atomicity. The
runner has no rollback-a-single-migration command; forward-only means fixing a bad migration
means writing a new one, which is the same trade-off `schema_migrations`-tracked forward-only
migrations make in most frameworks. Loading `.sql` files off disk (via `node:fs`) is deliberately
not part of `migrate.ts` — it takes an in-memory `Migration[]`, not a directory path — so the
function itself stays free of Node-only imports and works unmodified once a browser-side loader
(bundling `migrations/*.sql` for PGlite) exists; that loader is out of scope here and left for
the issue that adds the PGlite adapter.
