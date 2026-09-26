import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Runs SQL text against the underlying store. Must accept multi-statement
 * SQL (a migration file is typically several `CREATE TABLE`/`CREATE INDEX`
 * statements) — e.g. PGlite's `db.exec`, or `pg`'s `client.query` called with
 * a plain string (no params) so it goes through the simple query protocol.
 */
export type Query = (sql: string) => Promise<unknown>

export interface Migration {
  /** Migration order. Applied lowest to highest, independent of input order. */
  version: number
  name: string
  sql: string
}

export interface MigrateResult {
  /** Migrations applied during this call, in the order they ran. Empty when already up to date. */
  applied: Migration[]
}

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  name text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`

const FILENAME_PATTERN = /^(\d+)_(.+)\.sql$/

/**
 * Forward-only migration runner. Tracks applied versions in a
 * `schema_migrations` table so repeated calls are a no-op for migrations
 * already applied — safe to call on every startup.
 */
export async function migrate(query: Query, migrations: Migration[]): Promise<MigrateResult> {
  await query(MIGRATIONS_TABLE_SQL)

  const appliedVersions = await getAppliedVersions(query)
  const pending = [...migrations]
    .sort((a, b) => a.version - b.version)
    .filter((m) => !appliedVersions.has(m.version))

  const applied: Migration[] = []
  for (const migration of pending) {
    await query(migration.sql)
    await query(
      `INSERT INTO schema_migrations (version, name) VALUES (${migration.version}, '${escapeLiteral(migration.name)}');`,
    )
    applied.push(migration)
  }

  return { applied }
}

/** Reads `NNNN_<slug>.sql` files from a migrations directory (Node-only; for build/test use, not the browser bundle). */
export function loadMigrations(dir: string): Migration[] {
  return readdirSync(dir)
    .map((filename) => {
      const match = FILENAME_PATTERN.exec(filename)
      if (!match) return null
      const [, version, name] = match
      return {
        version: Number(version),
        name,
        sql: readFileSync(join(dir, filename), 'utf-8'),
      } as Migration
    })
    .filter((m): m is Migration => m !== null)
}

async function getAppliedVersions(query: Query): Promise<Set<number>> {
  const result = await query('SELECT version FROM schema_migrations;')
  return new Set(extractRows(result).map((row) => Number(row.version)))
}

/** Normalizes the two result shapes drivers return: a single `{ rows }` (e.g. `pg`, PGlite's `query`) or an array of them (PGlite's `exec`, one per statement). */
function extractRows(result: unknown): Array<Record<string, unknown>> {
  const results = Array.isArray(result) ? result : [result]
  const last = results.at(-1) as { rows?: Array<Record<string, unknown>> } | undefined
  return last?.rows ?? []
}

function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''")
}
