# storage

Repository-interface implementations (PGlite in the browser, Postgres on the server). UI and
domain code depend on the interface in `src/domain/`, never on an adapter directly.

`PGliteRepository.ts` is the browser adapter; see "The browser store" in `docs/dev.md`. It
encrypts through `src/crypto/memberFields.ts` and writes `*_bidx` with `src/crypto/blindIndex.ts`.
Blind indexes follow record 0008: equality only, per-field normalization, no index for a value
that normalizes to empty. On open, the repository compares the store's
`settings.blind_index_rules_version` with `BLIND_INDEX_RULES_VERSION` and rebuilds every index if
they differ (refusing a store from newer rules). The export bundle format in
`src/crypto/interimExportBundle.ts` is still interim (#14).

## Migrations

Schema lives in `migrations/NNNN_<slug>.sql` at the repo root, forward-only. `migrate.ts` is the
runner: give it a `query(sql)` function and the migration list, and it tracks what's applied in
a `schema_migrations` table it manages itself — safe to call every time the app starts.
`migrationFiles.ts` loads those `.sql` files off disk and is Node-only (`node:fs`); it's for
tests and server tooling, never imported from browser code. See
`docs/decisions/0006-migrations.md` for why this is hand-rolled rather than Drizzle.
