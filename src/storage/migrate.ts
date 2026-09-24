/**
 * Forward-only SQL migration runner. Works against any engine whose driver exposes a
 * `query(sql, params)` shaped like PGlite's or `pg`'s — see AGENTS.md rule 5: this is the
 * migration boundary, so the runner itself must stay engine-agnostic.
 */

export interface Migration {
  /** Sort key and dedup key, e.g. `'0001'` from `0001_init.sql`. */
  version: string
  /** Slug from the filename, e.g. `'init'` from `0001_init.sql`. Stored for auditing only. */
  name: string
  sql: string
}

export interface QueryResult<Row = Record<string, unknown>> {
  rows: Row[]
}

/**
 * A single call with no `params` may contain multiple `;`-separated statements (needed to
 * run a whole migration file); a call with `params` is a single parameterized statement.
 * Both PGlite (`query` vs `exec`) and `pg` (simple vs extended protocol) draw this same line.
 */
export type Query = <Row = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
) => Promise<QueryResult<Row>>

export interface MigrateResult {
  /** Versions applied by this call, in the order they ran. Empty when already up to date. */
  applied: string[]
}

const BOOTSTRAP_SQL = `
  create table if not exists schema_migrations (
    version text primary key,
    name text not null,
    applied_at timestamptz not null default now()
  )
`

export async function migrate(
  query: Query,
  migrations: readonly Migration[],
): Promise<MigrateResult> {
  await query(BOOTSTRAP_SQL)

  const { rows } = await query<{ version: string }>('select version from schema_migrations')
  const alreadyApplied = new Set(rows.map((row) => row.version))

  const ordered = [...migrations].sort((a, b) => a.version.localeCompare(b.version))
  const applied: string[] = []

  for (const migration of ordered) {
    if (alreadyApplied.has(migration.version)) continue

    await query(migration.sql)
    await query('insert into schema_migrations (version, name) values ($1, $2)', [
      migration.version,
      migration.name,
    ])
    applied.push(migration.version)
  }

  return { applied }
}
