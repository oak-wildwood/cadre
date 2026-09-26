import { join } from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadMigrations, migrate, type Migration, type Query } from './migrate'

const migrationsDir = join(process.cwd(), 'migrations')

describe('migrate', () => {
  let db: PGlite
  let query: Query

  beforeEach(() => {
    db = new PGlite()
    query = (sql) => db.exec(sql)
  })

  afterEach(async () => {
    await db.close()
  })

  it('applies the real migrations to a fresh database', async () => {
    const migrations = loadMigrations(migrationsDir)
    expect(migrations.length).toBeGreaterThan(0)

    const result = await migrate(query, migrations)

    expect(result.applied.map((m) => m.name)).toEqual(migrations.map((m) => m.name))

    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';",
    )
    const tableNames = tables.rows.map((r) => r.table_name)
    expect(tableNames).toEqual(expect.arrayContaining(['members', 'settings', 'schema_migrations']))
  })

  it('is idempotent: running the same migrations twice applies nothing the second time', async () => {
    const migrations = loadMigrations(migrationsDir)

    const first = await migrate(query, migrations)
    expect(first.applied.length).toBe(migrations.length)

    const second = await migrate(query, migrations)
    expect(second.applied).toEqual([])

    const applied = await db.query<{ version: number }>('SELECT version FROM schema_migrations;')
    expect(applied.rows.length).toBe(migrations.length)
  })

  it('applies migrations in version order regardless of input order, proven by a second migration', async () => {
    const real = loadMigrations(migrationsDir)
    const dummy: Migration = {
      version: Math.max(...real.map((m) => m.version)) + 1,
      name: 'dummy',
      sql: 'CREATE TABLE dummy_marker (id integer PRIMARY KEY);',
    }

    // Deliberately out of order: the dummy migration (highest version) first.
    const result = await migrate(query, [dummy, ...[...real].reverse()])

    expect(result.applied.map((m) => m.version)).toEqual(
      [...real, dummy].map((m) => m.version).sort((a, b) => a - b),
    )

    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';",
    )
    expect(tables.rows.map((r) => r.table_name)).toEqual(expect.arrayContaining(['dummy_marker']))

    // Running again with the same set (still out of order) is a no-op.
    const second = await migrate(query, [dummy, ...[...real].reverse()])
    expect(second.applied).toEqual([])
  })
})
