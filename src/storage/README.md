# storage

Repository-interface implementations (PGlite in the browser, Postgres on the server). UI and
domain code depend on the interface in `src/domain/`, never on an adapter directly.

## Migrations

Schema lives in `migrations/NNNN_<slug>.sql` at the repo root, forward-only. `migrate.ts` is the
runner: give it a `query(sql)` function and the migration list, and it tracks what's applied in
a `schema_migrations` table it manages itself — safe to call every time the app starts.
`migrationFiles.ts` loads those `.sql` files off disk and is Node-only (`node:fs`); it's for
tests and server tooling, never imported from browser code. See
`docs/decisions/0006-migrations.md` for why this is hand-rolled rather than Drizzle.
