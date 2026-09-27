# storage

Repository-interface implementations (PGlite in the browser, Postgres on the server). UI and
domain code depend on the interface in `src/domain/`, never on an adapter directly.

`migrate.ts` is the migration runner shared by every adapter — see
`../../migrations/README.md` and `docs/decisions/0006-migrations.md`. No adapter exists yet.
