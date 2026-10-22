# 0006 — SQL migrations and a hand-rolled runner

**Status:** accepted

## Decision

The schema lives in forward-only SQL files, `migrations/NNNN_<slug>.sql`, applied by a small
runner in `src/storage/migrate.ts`. The runner takes a `query(sql)` function and a list of
`{ version, name, sql }`, records applied versions in `schema_migrations`, skips what is already
applied, and runs each migration plus its bookkeeping row in one transaction. Drizzle was not
used.

## Why

The same files must run against PGlite in the browser and Postgres on the server (README
principle 5; AGENTS.md rule 5), so the migration boundary has to be plain SQL plus a one-function
driver seam. A runner this size is cheaper to audit than an ORM's migrator, adds no dependency
to the browser bundle, and keeps the schema's sensitivity classification (`*_enc` / `*_bidx`
columns) visible in reviewable SQL rather than generated. It involves no cryptography.

## Consequences

- No down migrations; fixing a mistake means a new migration.
- Applied migrations must not be renamed or renumbered (the runner errors on a name mismatch);
  editing an applied file's SQL is not detected, so don't.
- Migration SQL is sent as one multi-statement string without bind parameters, so a driver
  adapter must support that (PGlite `exec`; `pg` simple query).
- Column names in `0001_init.sql` follow the interim `SensitiveField` type; when
  `sensitiveFields.ts` lands it must match them, with any change made via a new migration.
