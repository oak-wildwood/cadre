# 0006 — Migration runner

**Status:** accepted
**Date:** 2026-09-23

## Decision

Schema changes are plain, numbered SQL files under `migrations/NNNN_<slug>.sql`, forward-only,
applied by a small hand-rolled runner (`src/storage/migrate.ts`). The runner takes any
`(sql: string) => Promise<{ rows }>` function and a list of `{ version, name, sql }` migrations;
it creates and reads a `schema_migrations` table itself, applies whatever isn't recorded there
yet in ascending version order, and is a no-op on a database that's already current. Loading
`.sql` files off disk (`src/storage/migrationFiles.ts`) is a separate, Node-only module — the
runner itself never touches the filesystem, so the same function drives PGlite in the browser
today and `pg` against server Postgres in Phase 2, off the same files, unchanged.

Drizzle (or another migration tool) was the alternative the issue raised. Rejected for now:
this schema has one table with a handful of `bytea` columns and a singleton settings row — no
generated query builder or ORM layer is buying anything yet, and adding one means trusting its
PGlite-and-Postgres parity instead of plain SQL, which is the one thing this phase (README
principle 5) needs to be certain about. Hand-rolled is a few dozen lines and every line is
inspectable. This can be revisited with its own decision record if the schema grows enough
that hand-written SQL becomes the bottleneck.
