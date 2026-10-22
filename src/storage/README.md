# storage

Repository-interface implementations (PGlite in the browser, Postgres on the server). UI and
domain code depend on the interface in `src/domain/`, never on an adapter directly.

## Migrations

Schema changes are forward-only SQL files in `migrations/`, applied by `src/storage/migrate.ts`
(see `docs/decisions/0006-migrations.md`). Add the next `NNNN_<slug>.sql`; never edit an applied one.
