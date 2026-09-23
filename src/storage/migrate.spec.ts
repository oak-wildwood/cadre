import { PGlite } from '@electric-sql/pglite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { migrate, type Migration, type QueryFn } from './migrate'
import { loadMigrationsFromDisk, parseMigrationFilename } from './migrationFiles'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(HERE, '..', '..', 'migrations')

describe('migrate', () => {
  let db: PGlite
  let query: QueryFn

  beforeEach(() => {
    db = new PGlite()
    query = async (sql) => {
      const results = await db.exec(sql)
      return results[results.length - 1] ?? { rows: [] }
    }
  })

  afterEach(async () => {
    await db.close()
  })

  it('applies migrations/0001_init.sql, creating the members and settings tables', async () => {
    const migrations = loadMigrationsFromDisk(MIGRATIONS_DIR)

    const result = await migrate(query, migrations)

    expect(result.applied.map((m) => m.version)).toEqual([1])

    const { rows: memberColumns } = await query(`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'members'
    `)
    const columnNames = memberColumns.map((row) => row.column_name).sort()
    expect(columnNames).toEqual(
      [
        'id',
        'role',
        'created_at',
        'updated_at',
        'expires_at',
        'display_name_enc',
        'display_name_bidx',
        'email_enc',
        'email_bidx',
        'phone_enc',
        'phone_bidx',
        'notes_enc',
        'notes_bidx',
      ].sort(),
    )

    const { rows: settingsRows } = await query(`SELECT * FROM settings`)
    expect(settingsRows).toEqual([])
  })

  it('running the migrations twice is a no-op the second time', async () => {
    const migrations = loadMigrationsFromDisk(MIGRATIONS_DIR)

    const first = await migrate(query, migrations)
    expect(first.applied.map((m) => m.version)).toEqual([1])

    const second = await migrate(query, migrations)
    expect(second.applied).toEqual([])

    const { rows } = await query(`SELECT version FROM schema_migrations ORDER BY version`)
    expect(rows.map((r) => r.version)).toEqual([1])
  })

  it('applies migrations in version order regardless of input order, proven by a dummy migration', async () => {
    // This migration only succeeds if `members` already exists, so it
    // proves 0001 really ran before it rather than merely being recorded
    // in the returned order.
    const dummyMigration: Migration = {
      version: 2,
      name: 'dummy_depends_on_members',
      sql: `ALTER TABLE members ADD COLUMN dummy_marker boolean NOT NULL DEFAULT true;`,
    }
    const initMigration = loadMigrationsFromDisk(MIGRATIONS_DIR).find((m) => m.version === 1)!

    // Passed in reverse order on purpose.
    const result = await migrate(query, [dummyMigration, initMigration])

    expect(result.applied.map((m) => m.version)).toEqual([1, 2])

    const { rows } = await query(`SELECT dummy_marker FROM members`)
    expect(rows).toEqual([])

    const { rows: recorded } = await query(`SELECT version, name FROM schema_migrations ORDER BY version`)
    expect(recorded).toEqual([
      { version: 1, name: 'init' },
      { version: 2, name: 'dummy_depends_on_members' },
    ])
  })

  it('rejects duplicate versions', async () => {
    const migrations: Migration[] = [
      { version: 1, name: 'a', sql: 'SELECT 1' },
      { version: 1, name: 'b', sql: 'SELECT 1' },
    ]

    await expect(migrate(query, migrations)).rejects.toThrow(/duplicate/i)
  })
})

describe('parseMigrationFilename', () => {
  it('parses version and name from NNNN_slug.sql', () => {
    expect(parseMigrationFilename('0001_init.sql')).toEqual({ version: 1, name: 'init' })
    expect(parseMigrationFilename('0012_add_role_index.sql')).toEqual({
      version: 12,
      name: 'add_role_index',
    })
  })

  it('rejects filenames that do not match the pattern', () => {
    expect(() => parseMigrationFilename('init.sql')).toThrow()
  })
})
