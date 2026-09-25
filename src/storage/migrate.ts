export interface Migration {
  readonly version: number
  readonly name: string
  readonly sql: string
}

export interface MigrateResult {
  /**
   * Names of migrations applied during this call, in the order applied.
   * Empty if none were pending.
   */
  readonly applied: readonly string[]
}

/**
 * Runs SQL against the target database. A single call may contain multiple
 * `;`-separated statements (Postgres's simple query protocol runs those as
 * one implicit transaction), which is how `migrate` gets atomicity per
 * migration without managing transaction state across separate calls.
 * `@electric-sql/pglite`'s `db.exec` and `pg`'s `Client.query` (called with
 * a plain string, no parameters) both already behave this way, which is
 * what lets the same runner target either.
 */
export type QueryFn = (sql: string) => Promise<unknown>

const CREATE_SCHEMA_MIGRATIONS = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version integer PRIMARY KEY,
    name text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  );
`

/**
 * Applies every migration in `migrations` not yet recorded in
 * `schema_migrations`, in ascending `version` order regardless of the order
 * they're passed in. Safe to call repeatedly — migrations already recorded
 * are skipped, so a second call with the same list applies nothing.
 *
 * Each migration's SQL and its `schema_migrations` bookkeeping row are sent
 * to `query` together, in one call, so a failure partway through a
 * migration leaves neither applied (see `QueryFn`'s doc comment) rather
 * than recording a migration that only partially ran.
 */
export async function migrate(
  query: QueryFn,
  migrations: readonly Migration[],
): Promise<MigrateResult> {
  validateMigrations(migrations)

  await query(CREATE_SCHEMA_MIGRATIONS)

  const appliedResult = await query('SELECT version FROM schema_migrations;')
  const alreadyApplied = new Set(rowsOf(appliedResult).map((row) => Number(row.version)))

  const pending = migrations
    .filter((migration) => !alreadyApplied.has(migration.version))
    .sort((a, b) => a.version - b.version)

  const applied: string[] = []
  for (const migration of pending) {
    const record =
      `INSERT INTO schema_migrations (version, name) ` +
      `VALUES (${migration.version}, '${escapeLiteral(migration.name)}');`
    await query(`${migration.sql}\n${record}`)
    applied.push(migration.name)
  }

  return { applied }
}

function validateMigrations(migrations: readonly Migration[]): void {
  const seen = new Set<number>()
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version)) {
      throw new Error(
        `Migration version must be an integer, got ${migration.version} (${migration.name})`,
      )
    }
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`)
    }
    seen.add(migration.version)
  }
}

function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Normalizes the two result shapes `QueryFn` implementations realistically
 * return for a single-statement `SELECT`: an object with a `rows` array
 * (`pg`'s `QueryResult`, PGlite's `db.query` result), or an array of those
 * (PGlite's `db.exec`, one entry per statement — the last entry is this
 * call's `SELECT`).
 */
function rowsOf(result: unknown): readonly Record<string, unknown>[] {
  const target = Array.isArray(result) ? result.at(-1) : result
  const rows = (target as { rows?: unknown } | undefined)?.rows
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []
}
