/**
 * Runs a query string (possibly several `;`-separated statements, no bind
 * parameters) and returns the rows of the last statement. Deliberately this
 * small so the same runner works over PGlite (`db.exec`) now and `pg` later.
 */
export type QueryFn = (sql: string) => Promise<Record<string, unknown>[]>

export interface Migration {
  version: number
  name: string
  sql: string
}

const FILE_RE = /(?:^|\/)(\d{4})_([a-z0-9_]+)\.sql$/

/** Parses `migrations/NNNN_<slug>.sql` paths into ordered Migrations. */
export function toMigrations(files: Record<string, string>): Migration[] {
  const out = Object.entries(files).map(([path, sql]) => {
    const m = FILE_RE.exec(path)
    if (!m) throw new Error(`invalid migration file name: ${path}`)
    return { version: Number(m[1]), name: m[2], sql }
  })
  out.sort((a, b) => a.version - b.version)
  return out
}

/**
 * Applies every not-yet-applied migration in version order and returns the
 * versions applied by this call. Forward-only: there is no down migration.
 * Each migration and its `schema_migrations` row commit in one transaction.
 */
export async function migrate(query: QueryFn, migrations: Migration[]): Promise<number[]> {
  const sorted = [...migrations].sort((a, b) => a.version - b.version)
  sorted.forEach((m, i) => {
    if (!Number.isInteger(m.version) || m.version < 1) {
      throw new Error(`invalid migration version: ${m.version}`)
    }
    if (!/^[a-z0-9_]+$/.test(m.name)) throw new Error(`invalid migration name: ${m.name}`)
    if (i > 0 && sorted[i - 1].version === m.version) {
      throw new Error(`duplicate migration version: ${m.version}`)
    }
  })

  await query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version integer PRIMARY KEY,
       name text NOT NULL,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  )
  const rows = await query('SELECT version, name FROM schema_migrations ORDER BY version')
  const applied = new Map(rows.map((r) => [Number(r.version), String(r.name)]))

  const ran: number[] = []
  for (const m of sorted) {
    const prior = applied.get(m.version)
    if (prior !== undefined) {
      if (prior !== m.name) {
        throw new Error(`migration ${m.version} was applied as "${prior}", now named "${m.name}"`)
      }
      continue
    }
    await query(
      `BEGIN;\n${m.sql}\n;INSERT INTO schema_migrations (version, name) VALUES (${m.version}, '${m.name}');\nCOMMIT;`,
    )
    ran.push(m.version)
  }
  return ran
}
