import { PGlite } from '@electric-sql/pglite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { SensitiveField } from '../domain/member'
import { migrate, type Migration, type QueryFn } from './migrate'
import { loadMigrationsFromDisk, parseMigrationFilename } from './migrationFiles'

const HERE = dirname(fileURLToPath(import.meta.url))
const DISK_MIGRATIONS = loadMigrationsFromDisk(join(HERE, '..', '..', 'migrations'))

// Typed against SensitiveField so a new field without a column mapping is a type error; the
// assertions below then require its `_enc`/`_bidx` columns and index to exist in the schema.
const SENSITIVE_COLUMNS: Record<SensitiveField, string> = {
  displayName: 'display_name',
  email: 'email',
  phone: 'phone',
  notes: 'notes',
}
const SENSITIVE_COLUMN_PREFIXES = Object.values(SENSITIVE_COLUMNS)

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
    const result = await migrate(query, DISK_MIGRATIONS)

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
        ...SENSITIVE_COLUMN_PREFIXES.flatMap((column) => [`${column}_enc`, `${column}_bidx`]),
      ].sort(),
    )

    const { rows: settingsRows } = await query(`SELECT * FROM settings`)
    expect(settingsRows).toEqual([])
  })

  it('indexes expires_at and every blind-index column', async () => {
    await migrate(query, DISK_MIGRATIONS)

    const { rows } = await query(`SELECT indexdef FROM pg_indexes WHERE tablename = 'members'`)
    const indexedColumns = rows.map((row) => /\((\w+)\)$/.exec(String(row.indexdef))?.[1])

    for (const column of ['expires_at', ...SENSITIVE_COLUMN_PREFIXES.map((c) => `${c}_bidx`)]) {
      expect(indexedColumns).toContain(column)
    }
  })

  it('running the migrations twice is a no-op the second time', async () => {
    const first = await migrate(query, DISK_MIGRATIONS)
    expect(first.applied.map((m) => m.version)).toEqual([1])

    const second = await migrate(query, DISK_MIGRATIONS)
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
    const initMigration = DISK_MIGRATIONS.find((m) => m.version === 1)!

    // Passed in reverse order on purpose.
    const result = await migrate(query, [dummyMigration, initMigration])

    expect(result.applied.map((m) => m.version)).toEqual([1, 2])

    const { rows } = await query(`SELECT dummy_marker FROM members`)
    expect(rows).toEqual([])

    const { rows: recorded } = await query(
      `SELECT version, name FROM schema_migrations ORDER BY version`,
    )
    expect(recorded).toEqual([
      { version: 1, name: 'init' },
      { version: 2, name: 'dummy_depends_on_members' },
    ])
  })

  it('rolls back a failing migration, leaves it unrecorded, and keeps the connection usable', async () => {
    const broken: Migration = {
      version: 1,
      name: 'broken',
      sql: `CREATE TABLE half_done (id integer); SELECT * FROM table_that_does_not_exist;`,
    }

    await expect(migrate(query, [broken])).rejects.toThrow()

    const { rows: tables } = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'half_done'`,
    )
    expect(tables).toEqual([])

    const retry = await migrate(query, DISK_MIGRATIONS)
    expect(retry.applied.map((m) => m.version)).toEqual([1])
  })

  it('rejects duplicate versions', async () => {
    const migrations: Migration[] = [
      { version: 1, name: 'a', sql: 'SELECT 1' },
      { version: 1, name: 'b', sql: 'SELECT 1' },
    ]

    await expect(migrate(query, migrations)).rejects.toThrow(/duplicate/i)
  })

  it.each([
    { version: 1, name: "init'); DROP TABLE members; --" },
    { version: 1, name: 'Has-Caps' },
    { version: 0, name: 'zero' },
    { version: 1.5, name: 'fractional' },
    { version: Number.NaN, name: 'nan' },
  ])('rejects an unsafe version or name before running any SQL: %o', async (bad) => {
    await expect(migrate(query, [{ ...bad, sql: 'SELECT 1' }])).rejects.toThrow(
      /invalid migration/i,
    )

    const { rows } = await query(
      `SELECT table_name FROM information_schema.tables WHERE table_name = 'schema_migrations'`,
    )
    expect(rows).toEqual([])
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
