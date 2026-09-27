import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface Migration {
  version: string
  name: string
  sql: string
}

export interface QueryResult<Row = Record<string, unknown>> {
  rows: Row[]
}

/**
 * Runs `sql` — which may be several `;`-separated statements, since a
 * migration file's body can contain more than one — and resolves to the
 * rows of its last statement. `pg`'s `client.query(sql)` already behaves
 * this way for a plain (no bind parameters) string; a PGlite adapter should
 * route through `db.exec()` rather than `db.query()`, since PGlite's
 * `query()` only accepts a single statement. Kept single-argument (no bind
 * parameters) so the runner never needs to build a parameterized query.
 */
export type Query = (sql: string) => Promise<QueryResult>

const MIGRATION_ID_PATTERN = /^\d{4}_[a-z0-9-]+$/
const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z0-9-]+)\.sql$/

const CREATE_SCHEMA_MIGRATIONS_TABLE = `
  create table if not exists schema_migrations (
    version text primary key,
    name text not null,
    applied_at timestamptz not null default now()
  )
`

/**
 * Applies every migration in `migrations` whose version isn't yet recorded
 * in `schema_migrations`, in ascending version order, and records each as
 * it's applied. Safe to call repeatedly: migrations already recorded are
 * skipped, so a second run against the same migrations is a no-op.
 *
 * Returns the migrations that were actually applied by this call.
 */
export async function migrate(
  query: Query,
  migrations: readonly Migration[],
): Promise<Migration[]> {
  for (const migration of migrations) {
    assertValidId(migration.version, migration.name)
  }

  await query(CREATE_SCHEMA_MIGRATIONS_TABLE)

  const { rows } = await query('select version from schema_migrations')
  const applied = new Set(rows.map((row) => String(row.version)))

  const pending = [...migrations]
    .sort((a, b) => a.version.localeCompare(b.version))
    .filter((migration) => !applied.has(migration.version))

  const newlyApplied: Migration[] = []
  for (const migration of pending) {
    await query(migration.sql)
    await query(
      `insert into schema_migrations (version, name) values ('${migration.version}', '${migration.name}')`,
    )
    newlyApplied.push(migration)
  }
  return newlyApplied
}

/** Reads and parses every `NNNN_<slug>.sql` file in `dir`, sorted by version. */
export function loadMigrations(dir: string): Migration[] {
  return readdirSync(dir)
    .map((file) => MIGRATION_FILE_PATTERN.exec(file))
    .filter((match): match is RegExpExecArray => match !== null)
    .sort((a, b) => a[1]!.localeCompare(b[1]!))
    .map((match) => {
      const [file, version, name] = match as [string, string, string]
      return { version, name, sql: readFileSync(join(dir, file), 'utf8') }
    })
}

/**
 * Version and name are interpolated into the `schema_migrations` insert
 * (see `migrate` above) rather than passed as query parameters, because the
 * shared `Query` type is a single-argument `(sql) => ...` to stay
 * compatible with both PGlite's and `pg`'s plain `query(sql)` call for
 * running a migration's (potentially multi-statement) body. Restricting the
 * character set here closes the injection risk that interpolation would
 * otherwise open.
 */
function assertValidId(version: string, name: string): void {
  if (!MIGRATION_ID_PATTERN.test(`${version}_${name}`)) {
    throw new Error(`Invalid migration version/name: ${version}_${name}`)
  }
}
