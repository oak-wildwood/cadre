# migrations

Forward-only SQL migrations, one file per change: `NNNN_<slug>.sql`, four-digit version prefix,
lowercase slug. No down-migrations — see `docs/decisions/0006-migrations.md` for why and for the
runner that applies these (`src/storage/migrate.ts`).

These files must run unmodified against both PGlite (browser) and Postgres (server) — no
dialect-specific SQL.
