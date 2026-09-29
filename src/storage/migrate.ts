/**
 * Tiny hand-rolled SQL migration runner. Deliberately engine-agnostic: it
 * only calls the `query` function it's given, so the same runner and the
 * same migration files apply to PGlite in the browser now and `pg` against
 * server Postgres later (see docs/decisions/0006-migrations.md).
 */

export interface Migration {
  /** Sequence number from the filename (`0001_init.sql` -> 1); primary key of `schema_migrations`. */
  version: number
  /** Slug from the filename (`0001_init.sql` -> "init"), recorded for humans reading `schema_migrations`. */
  name: string
  sql: string
}

export interface QueryResult {
  rows: Array<Record<string, unknown>>
}

/** Runs one round of SQL and reports back any rows it produced. */
export type QueryFn = (sql: string) => Promise<QueryResult>

export interface MigrateResult {
  /** Migrations applied by this call, in version order. Empty if the schema was already current. */
  applied: Migration[]
}

const MIGRATIONS_TABLE = 'schema_migrations'

/**
 * Applies every migration in `migrations` that isn't already recorded in
 * `schema_migrations`, in ascending version order, regardless of the order
 * they're passed in. Running this twice against the same database is a
 * no-op the second time.
 */
export async function migrate(query: QueryFn, migrations: Migration[]): Promise<MigrateResult> {
  migrations.forEach(assertValidMigration)
  const sorted = sortByVersion(migrations)
  assertUniqueVersions(sorted)

  await query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      version integer PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const { rows } = await query(`SELECT version FROM ${MIGRATIONS_TABLE}`)
  const alreadyApplied = new Set(rows.map((row) => Number(row.version)))

  const applied: Migration[] = []
  for (const migration of sorted) {
    if (alreadyApplied.has(migration.version)) {
      continue
    }

    try {
      // version and name are interpolated only because assertValidMigration has already
      // restricted them to an integer and [a-z0-9_]; QueryFn has no parameter binding.
      await query(`
        BEGIN;
        ${migration.sql}
        INSERT INTO ${MIGRATIONS_TABLE} (version, name)
          VALUES (${migration.version}, '${migration.name}');
        COMMIT;
      `)
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
    applied.push(migration)
  }

  return { applied }
}

function sortByVersion(migrations: Migration[]): Migration[] {
  return [...migrations].sort((a, b) => a.version - b.version)
}

function assertUniqueVersions(migrations: Migration[]): void {
  const seen = new Set<number>()
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`)
    }
    seen.add(migration.version)
  }
}

const MIGRATION_NAME_PATTERN = /^[a-z0-9_]+$/

function assertValidMigration(migration: Migration): void {
  if (!Number.isSafeInteger(migration.version) || migration.version < 1) {
    throw new Error(`Invalid migration version: ${migration.version}`)
  }
  if (!MIGRATION_NAME_PATTERN.test(migration.name)) {
    throw new Error(`Invalid migration name (expected [a-z0-9_]+): ${migration.name}`)
  }
}
