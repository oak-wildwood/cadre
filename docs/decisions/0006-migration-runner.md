# 0006 — Hand-rolled migration runner over Drizzle

**Status:** accepted
**Date:** 2026-09-26

## Decision

`src/storage/migrate.ts` is a small hand-rolled runner, not Drizzle. It takes a `query(sql)`
function and a list of `{ version, name, sql }` migrations, applies whichever aren't yet
recorded in a `schema_migrations` table (lowest version first, regardless of input order), and
records each as it runs. Migrations themselves are plain numbered SQL files in `migrations/`
(`NNNN_<slug>.sql`), loaded by `loadMigrations()`. The runner has no PGlite- or `pg`-specific
code; it only needs its `query` argument to run arbitrary (possibly multi-statement) SQL text
and return something with `.rows` — true of PGlite's `exec` and `pg`'s `query` alike.

The issue allowed Drizzle if it could target both PGlite and Postgres from the same migration
files. It can generate SQL for both dialects, but from a single TypeScript schema, not from one
set of `.sql` files each engine runs unmodified — so choosing it would mean writing the schema
in Drizzle's DSL instead of SQL, and trusting its dialect-specific codegen to produce equivalent
DDL for both engines rather than literally running the same statements. That's a heavier
dependency and a layer of trust for a runner whose entire job — track a version number, run SQL
in order once — fits in under 100 lines. It stays off the "never write cryptographic primitives"
list this project is otherwise strict about (AGENTS.md rule 1); a migration runner is bookkeeping,
not a security primitive, so hand-rolling it here isn't the kind of risk that rule exists for.

## Why, and what threat it addresses

README principle 5 — "the same app runs against Postgres-in-the-browser and
Postgres-on-a-server, so migrating between them is a re-encryption, not a rewrite" — only holds
if both engines apply literally the same schema. Running the identical `.sql` files through the
identical runner against PGlite today and Postgres in Phase 2 is what makes that true by
construction rather than by two schemas happening to stay in sync. That portability is what the
"compromised server" and "legal compulsion" rows of the threat model (README summary) lean on:
minimal retention and crypto-shredding (`expires_at`, `purgeExpired`) have to behave identically
on whichever engine is running, and a schema drift between a hand-tuned Postgres migration and a
Drizzle-generated PGlite one is exactly the kind of divergence that would undermine that
guarantee silently.
