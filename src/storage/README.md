# storage

Repository-interface implementations (PGlite in the browser, Postgres on the server). UI and
domain code depend on the interface in `src/domain/`, never on an adapter directly.

`migrate.ts` is the forward-only SQL migration runner both adapters will run at startup — see
[`docs/decisions/0006-migration-runner.md`](../../docs/decisions/0006-migration-runner.md). It
takes a `query(sql)` function so the same runner and the same files in `../../migrations/` apply
to PGlite now and Postgres later. It tracks applied versions in a `schema_migrations` table, so
calling it again with an already-applied migration is a no-op. No adapter (`PGliteRepository`,
`PostgresRepository`) exists yet; that's a separate issue.
